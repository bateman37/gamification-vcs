import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { createPerson } from "@/server/services/person.service";
import { createSplitWithWeeks, activateSplit, listSplitWeeks } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { saveStabilityEntries } from "@/server/services/stability-entry.service";
import { publishWeek } from "@/server/services/publish-week.service";
import { createFaction } from "@/server/services/faction.service";
import { buildSplitResultsPresentation } from "@/server/services/results-presentation.service";

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

async function activateStabilityKpi(splitId: string, baseMax = 1000) {
  await updateKpiConfig(testDb, splitId, "STABILITY_GUARDIAN", {
    isActive: true,
    baseMax,
    multiplierN2: 1,
    parameters: { pointsPerResult: 1 },
  });
}

beforeEach(async () => {
  await resetDatabase();
});

describe("buildSplitResultsPresentation: sin publicacion", () => {
  it("un split sin ninguna semana publicada devuelve un estado vacio (available: false)", async () => {
    const split = await createSplitWithWeeks(testDb, { name: "Split sin publicar", description: undefined, startDate: "2025-10-06", numberOfWeeks: 2 });
    const result = await buildSplitResultsPresentation(testDb, split.id);
    expect(result.available).toBe(false);
  });

  it("un split inexistente devuelve un estado vacio, nunca un error", async () => {
    const result = await buildSplitResultsPresentation(testDb, "00000000-0000-0000-0000-000000000000");
    expect(result.available).toBe(false);
  });
});

describe("buildSplitResultsPresentation: elige la ultima semana publicada", () => {
  it("con dos semanas, una publicada y otra completa pero sin publicar, presenta solo la publicada", async () => {
    const split = await createSplitWithWeeks(testDb, { name: "Split dos semanas", description: undefined, startDate: "2025-10-06", numberOfWeeks: 2 });
    const person = await createPerson(testDb, { fullName: "Persona Presentacion", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Presentado", level: "N2", startWeekSequenceNumber: 1 });
    await activateStabilityKpi(split.id);
    await activateSplit(testDb, split.id);
    const [week1, week2] = await listSplitWeeks(testDb, split.id);

    await saveStabilityEntries(testDb, split.id, week1!.id, form({ [`resultValue__${participant.id}`]: "10" }));
    await publishWeek(testDb, split.id, week1!.id, null);

    // La semana 2 tambien queda completa (mismo KPI activo, misma fila guardada) pero nunca se publica:
    // no deberia contar como "presentable" aunque un administrador ya pudiera verla en la previsualizacion.
    await saveStabilityEntries(testDb, split.id, week2!.id, form({ [`resultValue__${participant.id}`]: "20" }));

    const result = await buildSplitResultsPresentation(testDb, split.id);
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.data.weekSequenceNumber).toBe(1);
    expect(result.data.weeklyIndividualTop[0]!.points).toBe(10);
  });
});

describe("buildSplitResultsPresentation: fuentes oficiales, nunca recalculadas", () => {
  async function buildSimpleSplit() {
    const split = await createSplitWithWeeks(testDb, { name: "Split simple", description: undefined, startDate: "2025-10-06", numberOfWeeks: 1 });
    const persons = await Promise.all([1, 2, 3].map((n) => createPerson(testDb, { fullName: `Persona ${n}`, email: undefined })));
    const scores = [70, 50, 30];
    const participants = [];
    for (const [index, person] of persons.entries()) {
      participants.push(
        await addParticipant(testDb, split.id, { personId: person.id, alias: `Alias${index}`, level: "N2", startWeekSequenceNumber: 1 }),
      );
    }
    await activateStabilityKpi(split.id);
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    const entries: Record<string, string> = {};
    participants.forEach((participant, index) => (entries[`resultValue__${participant.id}`] = String(scores[index])));
    await saveStabilityEntries(testDb, split.id, week.id, form(entries));
    await publishWeek(testDb, split.id, week.id, null);
    return { split, week, participants };
  }

  it("la clasificacion semanal usa totalKpiPoints y weeklyRank ya publicados", async () => {
    const { split } = await buildSimpleSplit();
    const result = await buildSplitResultsPresentation(testDb, split.id);
    expect(result.available).toBe(true);
    if (!result.available) return;

    const published = await testDb.publishedParticipantWeeklyResult.findMany({ orderBy: { weeklyRank: "asc" } });
    expect(result.data.weeklyIndividualTop.map((entry) => entry.rank)).toEqual(published.map((row) => row.weeklyRank));
    expect(result.data.weeklyIndividualTop.map((entry) => entry.points)).toEqual(published.map((row) => row.totalKpiPoints.toNumber()));
  });

  it("la clasificacion general individual usa totalPositionPoints acumulados, no la suma de KPI", async () => {
    const { split } = await buildSimpleSplit();
    const result = await buildSplitResultsPresentation(testDb, split.id);
    expect(result.available).toBe(true);
    if (!result.available) return;

    const first = result.data.generalIndividualTop[0]!;
    const published = await testDb.publishedParticipantWeeklyResult.findFirst({ where: { aliasSnapshot: first.alias } });
    expect(first.points).toBe(published!.positionPoints);
    expect(first.points).not.toBe(published!.totalKpiPoints.toNumber());
  });

  it("el DTO no expone fullName ni email en ninguna fila", async () => {
    const { split } = await buildSimpleSplit();
    const result = await buildSplitResultsPresentation(testDb, split.id);
    expect(result.available).toBe(true);
    if (!result.available) return;

    for (const entry of [...result.data.weeklyIndividualTop, ...result.data.generalIndividualTop]) {
      expect(Object.keys(entry)).not.toContain("fullName");
      expect(Object.keys(entry)).not.toContain("email");
      // Solo la version (hash) del avatar, nunca los bytes.
      expect(typeof entry.avatarVersion === "string" || entry.avatarVersion === null).toBe(true);
    }
  });

  it("un split sin facciones omite por completo las fases de faccion", async () => {
    const { split } = await buildSimpleSplit();
    const result = await buildSplitResultsPresentation(testDb, split.id);
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.data.hasFactionData).toBe(false);
    expect(result.data.weeklyFactionTop).toEqual([]);
    expect(result.data.generalFactionTop).toEqual([]);
  });
});

describe("buildSplitResultsPresentation: facciones", () => {
  it("la clasificacion semanal de facciones usa weeklyScore y la general usa totalScore, ambos del servicio existente", async () => {
    const split = await createSplitWithWeeks(testDb, { name: "Split con facciones", description: undefined, startDate: "2025-10-06", numberOfWeeks: 1 });
    const factionA = await createFaction(testDb, split.id, { name: "Alfa", color: "#ff0000" });
    const factionB = await createFaction(testDb, split.id, { name: "Beta", color: "#0000ff" });

    const scoresA = [60, 50, 40];
    const scoresB = [30, 20, 10];
    const participantsA = [];
    const participantsB = [];
    for (let i = 0; i < 3; i += 1) {
      const personA = await createPerson(testDb, { fullName: `Alfa ${i}`, email: undefined });
      participantsA.push(
        await addParticipant(testDb, split.id, { personId: personA.id, alias: `Alfa${i}`, level: "N2", startWeekSequenceNumber: 1, factionId: factionA.id }),
      );
      const personB = await createPerson(testDb, { fullName: `Beta ${i}`, email: undefined });
      participantsB.push(
        await addParticipant(testDb, split.id, { personId: personB.id, alias: `Beta${i}`, level: "N2", startWeekSequenceNumber: 1, factionId: factionB.id }),
      );
    }
    await activateStabilityKpi(split.id);
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    const entries: Record<string, string> = {};
    participantsA.forEach((participant, index) => (entries[`resultValue__${participant.id}`] = String(scoresA[index])));
    participantsB.forEach((participant, index) => (entries[`resultValue__${participant.id}`] = String(scoresB[index])));
    await saveStabilityEntries(testDb, split.id, week.id, form(entries));
    await publishWeek(testDb, split.id, week.id, null);

    const result = await buildSplitResultsPresentation(testDb, split.id);
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.data.hasFactionData).toBe(true);

    const alfaWeekly = result.data.weeklyFactionTop.find((entry) => entry.name === "Alfa")!;
    expect(alfaWeekly.score).toBe(15 + 11 + 8);
    expect(alfaWeekly.rank).toBe(1);

    const alfaGeneral = result.data.generalFactionTop.find((entry) => entry.name === "Alfa")!;
    expect(alfaGeneral.score).toBe(alfaWeekly.score);
    expect(alfaGeneral.rank).toBe(1);
  });
});
