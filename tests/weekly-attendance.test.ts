import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { markAllPresent, markParticipantAbsent } from "./helpers/attendance";
import { createPerson } from "@/server/services/person.service";
import { createSplitWithWeeks, activateSplit, listSplitWeeks } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { saveStabilityEntries } from "@/server/services/stability-entry.service";
import { computeWeeklyResults } from "@/server/services/weekly-results.service";
import { publishWeek } from "@/server/services/publish-week.service";
import { computeSplitClassification } from "@/server/services/classification.service";
import { createFaction } from "@/server/services/faction.service";
import { computeFactionClassification } from "@/server/services/faction-classification.service";
import { buildSplitResultsPresentation } from "@/server/services/results-presentation.service";

/**
 * Integracion de asistencia semanal (`1.1.1`, ver
 * docs/WEEKLY_ATTENDANCE_AND_HOURS.md, secciones K2/K3 del encargo).
 * `STABILITY_GUARDIAN` (solo N2, `pointsPerResult: 1`) se usa como KPI de
 * control: `resultValue` es directamente los puntos, sin depender de un
 * Excel, para poder construir empates y rankings exactos.
 */

async function createDraftSplit(numberOfWeeks = 1) {
  return createSplitWithWeeks(testDb, { name: "Split asistencia", description: undefined, startDate: "2025-10-06", numberOfWeeks });
}

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

async function addControlParticipant(splitId: string, alias: string) {
  const person = await createPerson(testDb, { fullName: `Persona ${alias}`, email: undefined });
  return addParticipant(testDb, splitId, { personId: person.id, alias, level: "N2", startWeekSequenceNumber: 1 });
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Asistencia prevalece sobre cualquier otro KPI (E1/E2)", () => {
  it("una persona ausente con datos positivos de otro origen recibe 0 puntos y estado ABSENT, nunca VAC", async () => {
    const split = await createDraftSplit();
    const present = await addControlParticipant(split.id, "Presente");
    const absent = await addControlParticipant(split.id, "Ausente");
    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 100, multiplierN2: 1, parameters: { pointsPerResult: 1 } });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    // Ambos tienen resultado de estabilidad guardado (dato positivo real para el ausente tambien).
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${present.id}`]: "50", [`resultValue__${absent.id}`]: "80" }));
    await markAllPresent(testDb, split.id, week.id);
    await markParticipantAbsent(testDb, split.id, week.id, absent.id);

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    expect(results.isComplete).toBe(true);
    const absentResult = results.participants.find((p) => p.splitParticipantId === absent.id)!;
    expect(absentResult.attendanceStatus).toBe("ABSENT");
    expect(absentResult.totalKpiPoints).toBe(0);
    expect(absentResult.applicableMaxPoints).toBeNull();
    expect(absentResult.kpiResults[0]).toMatchObject({ kpiCode: "STABILITY_GUARDIAN", status: "ABSENT", finalPoints: null });
    expect(absentResult.weeklyRank).toBeNull();

    const presentResult = results.participants.find((p) => p.splitParticipantId === present.id)!;
    expect(presentResult.attendanceStatus).toBe("PRESENT");
    expect(presentResult.totalKpiPoints).toBe(50);
    expect(presentResult.weeklyRank).toBe(1);
  });

  it("una persona presente con todos sus KPI a cero real sigue presente, nunca se confunde con ausencia", async () => {
    const split = await createDraftSplit();
    const participant = await addControlParticipant(split.id, "CeroReal");
    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 100, multiplierN2: 1, parameters: { pointsPerResult: 1 } });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "0" }));
    await markAllPresent(testDb, split.id, week.id);

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    const result = results.participants[0]!;
    expect(result.attendanceStatus).toBe("PRESENT");
    expect(result.kpiResults[0]).toMatchObject({ status: "COMPUTED", finalPoints: 0 });
    expect(result.weeklyRank).toBe(1);
  });
});

describe("Ranking semanal y ultima posicion efectiva (E3/E5)", () => {
  it("8 presentes sin empate final y 2 ausentes: los ausentes reciben la regla de la posicion 8 (I5)", async () => {
    const split = await createDraftSplit();
    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 1000, multiplierN2: 1, parameters: { pointsPerResult: 1 } });
    const scores = [100, 90, 80, 70, 60, 50, 40, 30];
    const presentParticipants = await Promise.all(scores.map((_, index) => addControlParticipant(split.id, `P${index + 1}`)));
    const absentParticipants = await Promise.all([addControlParticipant(split.id, "A1"), addControlParticipant(split.id, "A2")]);
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    const values: Record<string, string> = {};
    presentParticipants.forEach((p, index) => {
      values[`resultValue__${p.id}`] = String(scores[index]);
    });
    absentParticipants.forEach((p) => {
      values[`resultValue__${p.id}`] = "0";
    });
    await saveStabilityEntries(testDb, split.id, week.id, form(values));
    await markAllPresent(testDb, split.id, week.id);
    for (const absent of absentParticipants) {
      await markParticipantAbsent(testDb, split.id, week.id, absent.id);
    }

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    expect(results.presentParticipantCount).toBe(8);
    expect(results.absentParticipantCount).toBe(2);

    const byAlias = new Map(results.participants.map((p) => [p.alias, p]));
    for (let i = 0; i < 8; i++) {
      expect(byAlias.get(`P${i + 1}`)!.weeklyRank).toBe(i + 1);
    }
    const rulePoints = (await testDb.splitPositionPointRule.findUnique({ where: { splitId_position: { splitId: split.id, position: 8 } } }))!.points;
    for (const absent of absentParticipants) {
      const row = byAlias.get(absent.alias)!;
      expect(row.weeklyRank).toBeNull();
      expect(row.positionPointsRuleRank).toBe(8);
      expect(row.positionPoints).toBe(rulePoints);
    }
  });

  it("empate en la ultima posicion efectiva: los ausentes usan esa posicion real, no el numero de presentes (I6)", async () => {
    const split = await createDraftSplit();
    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 1000, multiplierN2: 1, parameters: { pointsPerResult: 1 } });
    // 8 presentes, los dos ultimos empatados: el ranking de competicion produce 1..6, 7, 7 (nunca llega a la posicion 8).
    const scores = [100, 90, 80, 70, 60, 50, 40, 40];
    const presentParticipants = await Promise.all(scores.map((_, index) => addControlParticipant(split.id, `P${index + 1}`)));
    const absent = await addControlParticipant(split.id, "Ausente");
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await testDb.splitPositionPointRule.update({ where: { splitId_position: { splitId: split.id, position: 7 } }, data: { points: 3 } });

    const values: Record<string, string> = { [`resultValue__${absent.id}`]: "0" };
    presentParticipants.forEach((p, index) => {
      values[`resultValue__${p.id}`] = String(scores[index]);
    });
    await saveStabilityEntries(testDb, split.id, week.id, form(values));
    await markAllPresent(testDb, split.id, week.id);
    await markParticipantAbsent(testDb, split.id, week.id, absent.id);

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    const byAlias = new Map(results.participants.map((p) => [p.alias, p]));
    expect(byAlias.get("P7")!.weeklyRank).toBe(7);
    expect(byAlias.get("P8")!.weeklyRank).toBe(7);

    const absentRow = byAlias.get("Ausente")!;
    expect(absentRow.positionPointsRuleRank).toBe(7);
    expect(absentRow.positionPoints).toBe(3);
  });

  it("toda la plantilla aplicable ausente: no hay ranking, todos reciben 0 puntos KPI y 0 puntos por posicion (I7)", async () => {
    const split = await createDraftSplit();
    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 100, multiplierN2: 1, parameters: { pointsPerResult: 1 } });
    const a = await addControlParticipant(split.id, "A");
    const b = await addControlParticipant(split.id, "B");
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${a.id}`]: "10", [`resultValue__${b.id}`]: "20" }));
    await markAllPresent(testDb, split.id, week.id);
    await markParticipantAbsent(testDb, split.id, week.id, a.id);
    await markParticipantAbsent(testDb, split.id, week.id, b.id);

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    expect(results.presentParticipantCount).toBe(0);
    expect(results.absentParticipantCount).toBe(2);
    for (const participant of results.participants) {
      expect(participant.weeklyRank).toBeNull();
      expect(participant.positionPointsRuleRank).toBeNull();
      expect(participant.positionPoints).toBe(0);
      expect(participant.totalKpiPoints).toBe(0);
      expect(participant.creditsEarned).toBe(0);
    }

    const published = await publishWeek(testDb, split.id, week.id, null);
    expect(published.alreadyPublished).toBe(false);
  });
});

describe("Resultados, general y facciones conservan la ausencia (K3)", () => {
  it("la ausencia sigue visible con sus puntos por posicion en la general; el top semanal la excluye; la faccion puede usar esos puntos", async () => {
    const split = await createDraftSplit();
    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 1000, multiplierN2: 1, parameters: { pointsPerResult: 1 } });
    const factionA = await createFaction(testDb, split.id, { name: "Alfa", color: "#ff0000" });
    const factionB = await createFaction(testDb, split.id, { name: "Beta", color: "#0000ff" });

    const person1 = await createPerson(testDb, { fullName: "Persona Uno", email: undefined });
    const person2 = await createPerson(testDb, { fullName: "Persona Dos", email: undefined });
    const personAbsent = await createPerson(testDb, { fullName: "Persona Ausente", email: undefined });
    const p1 = await addParticipant(testDb, split.id, { personId: person1.id, alias: "Uno", level: "N2", startWeekSequenceNumber: 1, factionId: factionA.id });
    const p2 = await addParticipant(testDb, split.id, { personId: person2.id, alias: "Dos", level: "N2", startWeekSequenceNumber: 1, factionId: factionA.id });
    const pAbsent = await addParticipant(testDb, split.id, {
      personId: personAbsent.id, alias: "Ausente", level: "N2", startWeekSequenceNumber: 1, factionId: factionA.id,
    });
    // Faccion Beta: solo rellena el requisito de "al menos 3 aplicables por faccion" para poder activar el split.
    const fillerParticipants = await Promise.all(
      ["Relleno1", "Relleno2", "Relleno3"].map(async (alias) => {
        const person = await createPerson(testDb, { fullName: `Persona ${alias}`, email: undefined });
        return addParticipant(testDb, split.id, { personId: person.id, alias, level: "N2", startWeekSequenceNumber: 1, factionId: factionB.id });
      }),
    );

    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    const stabilityValues: Record<string, string> = { [`resultValue__${p1.id}`]: "50", [`resultValue__${p2.id}`]: "30", [`resultValue__${pAbsent.id}`]: "0" };
    for (const filler of fillerParticipants) stabilityValues[`resultValue__${filler.id}`] = "0";
    await saveStabilityEntries(testDb, split.id, week.id, form(stabilityValues));
    await markAllPresent(testDb, split.id, week.id);
    await markParticipantAbsent(testDb, split.id, week.id, pAbsent.id);

    await publishWeek(testDb, split.id, week.id, null);

    // Clasificacion general: la ausencia conserva sus puntos por posicion (regla de la posicion 2, unica presente ademas de la 1).
    const classification = await computeSplitClassification(testDb, split.id);
    const absentEntry = classification.entries.find((entry) => entry.splitParticipantId === pAbsent.id)!;
    expect(absentEntry.totalPositionPoints).toBeGreaterThan(0);
    expect(absentEntry.weeklyRankByWeek.get(week.id)).toBeNull();

    // Facciones: los puntos por posicion de la ausencia son elegibles para el top 3 de su faccion.
    const factionClassification = await computeFactionClassification(testDb, split.id);
    expect(factionClassification.hasFactionData).toBe(true);
    const weekEntry = factionClassification.weekClassifications.get(week.id)!.entries[0]!;
    expect(weekEntry.topContributors.some((c) => c.splitParticipantId === pAbsent.id)).toBe(true);

    // Presentacion: el top semanal individual excluye a la ausencia (no tiene posicion efectiva).
    const presentation = await buildSplitResultsPresentation(testDb, split.id);
    expect(presentation.available).toBe(true);
    if (presentation.available) {
      expect(presentation.data.weeklyIndividualTop.some((row) => row.splitParticipantId === pAbsent.id)).toBe(false);
      expect(presentation.data.weeklyIndividualTop.some((row) => row.splitParticipantId === p1.id)).toBe(true);
      // La clasificacion general si conserva a la ausencia con sus puntos historicos.
      expect(presentation.data.generalIndividualFull.some((row) => row.splitParticipantId === pAbsent.id)).toBe(true);
    }
  });
});
