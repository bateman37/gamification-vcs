import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { markAllPresent } from "./helpers/attendance";
import { createPerson } from "@/server/services/person.service";
import { createSplitWithWeeks, activateSplit, listSplitWeeks } from "@/server/services/split.service";
import { addParticipant, updateParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { saveStabilityEntries } from "@/server/services/stability-entry.service";
import { publishWeek } from "@/server/services/publish-week.service";
import { createFaction, deleteFaction, updateFaction, listFactionsForSplit } from "@/server/services/faction.service";
import { computeFactionClassification } from "@/server/services/faction-classification.service";
import { DomainError } from "@/lib/errors";

async function createDraftSplit(numberOfWeeks = 2) {
  return createSplitWithWeeks(testDb, { name: "Split de facciones", description: undefined, startDate: "2025-10-06", numberOfWeeks });
}

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

async function activateStabilityKpi(splitId: string) {
  await updateKpiConfig(testDb, splitId, "STABILITY_GUARDIAN", {
    isActive: true,
    baseMax: 1000,
    multiplierN2: 1,
    parameters: { pointsPerResult: 1 },
  });
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Facciones: modelo y unicidad", () => {
  it("no acepta dos nombres normalizados iguales dentro del mismo split", async () => {
    const split = await createDraftSplit();
    await createFaction(testDb, split.id, { name: "Alfa", color: "#ff0000" });
    await expect(createFaction(testDb, split.id, { name: "  alfa  ", color: "#00ff00" })).rejects.toBeInstanceOf(DomainError);
  });

  it("el mismo nombre normalizado puede repetirse en otro split", async () => {
    const splitA = await createDraftSplit();
    const splitB = await createDraftSplit();
    await createFaction(testDb, splitA.id, { name: "Alfa", color: "#ff0000" });
    await expect(createFaction(testDb, splitB.id, { name: "Alfa", color: "#00ff00" })).resolves.toBeTruthy();
  });

  it("rechaza un color que no sea hexadecimal #RRGGBB a nivel de base de datos", async () => {
    const split = await createDraftSplit();
    await expect(
      testDb.splitFaction.create({ data: { splitId: split.id, name: "Invalida", nameNormalized: "invalida", color: "rojo" } }),
    ).rejects.toThrow();
  });
});

describe("Facciones: asignacion de participantes", () => {
  it("no asigna una faccion de otro split", async () => {
    const splitA = await createDraftSplit();
    const splitB = await createDraftSplit();
    const factionOfB = await createFaction(testDb, splitB.id, { name: "DeOtroSplit", color: "#123456" });
    const person = await createPerson(testDb, { fullName: "Persona Cruzada", email: undefined });

    await expect(
      addParticipant(testDb, splitA.id, { personId: person.id, alias: "Cruzada", level: "N1", startWeekSequenceNumber: 1, factionId: factionOfB.id }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("exige faccion en cuanto el split ya tiene alguna creada", async () => {
    const split = await createDraftSplit();
    await createFaction(testDb, split.id, { name: "Alfa", color: "#111111" });
    const person = await createPerson(testDb, { fullName: "Sin Faccion", email: undefined });

    await expect(
      addParticipant(testDb, split.id, { personId: person.id, alias: "SinFaccion", level: "N1", startWeekSequenceNumber: 1 }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("no exige faccion en un split que todavia no tiene ninguna (compatibilidad con splits sin facciones)", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Legacy", email: undefined });
    await expect(
      addParticipant(testDb, split.id, { personId: person.id, alias: "Legacy", level: "N1", startWeekSequenceNumber: 1 }),
    ).resolves.toBeTruthy();
  });

  it("permite editar la faccion de un participante existente, validando que pertenezca al split", async () => {
    const split = await createDraftSplit();
    const factionA = await createFaction(testDb, split.id, { name: "Alfa", color: "#111111" });
    const factionB = await createFaction(testDb, split.id, { name: "Beta", color: "#222222" });
    const person = await createPerson(testDb, { fullName: "Reasignable", email: undefined });
    const participant = await addParticipant(testDb, split.id, {
      personId: person.id, alias: "Reasignable", level: "N1", startWeekSequenceNumber: 1, factionId: factionA.id,
    });

    const updated = await updateParticipant(testDb, participant.id, { alias: "Reasignable", level: "N1", factionId: factionB.id });
    expect(updated.factionId).toBe(factionB.id);
  });
});

describe("Facciones: activacion del split", () => {
  it("no activa con menos de dos facciones", async () => {
    const split = await createDraftSplit();
    await createFaction(testDb, split.id, { name: "Unica", color: "#111111" });
    const person = await createPerson(testDb, { fullName: "Uno", email: undefined });
    const faction = (await listFactionsForSplit(testDb, split.id))[0]!;
    await addParticipant(testDb, split.id, { personId: person.id, alias: "Uno", level: "N1", startWeekSequenceNumber: 1, factionId: faction.id });
    await activateStabilityKpi(split.id);

    await expect(activateSplit(testDb, split.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("no activa si algun participante no tiene faccion asignada", async () => {
    const split = await createDraftSplit();
    await createFaction(testDb, split.id, { name: "Alfa", color: "#111111" });
    await createFaction(testDb, split.id, { name: "Beta", color: "#222222" });
    const person = await createPerson(testDb, { fullName: "SinAsignar", email: undefined });
    // Insercion directa: antes de que el split tuviera facciones no se exigia asignacion.
    await testDb.splitParticipant.create({
      data: { splitId: split.id, personId: person.id, alias: "SinAsignar", aliasNormalized: "sinasignar", level: "N1", startWeekSequenceNumber: 1 },
    });
    await activateStabilityKpi(split.id);

    await expect(activateSplit(testDb, split.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("no activa si una faccion tiene menos de tres participantes aplicables desde la primera semana", async () => {
    const split = await createDraftSplit();
    const factionA = await createFaction(testDb, split.id, { name: "Alfa", color: "#111111" });
    const factionB = await createFaction(testDb, split.id, { name: "Beta", color: "#222222" });
    for (let i = 0; i < 3; i += 1) {
      const person = await createPerson(testDb, { fullName: `Alfa ${i}`, email: undefined });
      await addParticipant(testDb, split.id, { personId: person.id, alias: `Alfa${i}`, level: "N1", startWeekSequenceNumber: 1, factionId: factionA.id });
    }
    for (let i = 0; i < 2; i += 1) {
      const person = await createPerson(testDb, { fullName: `Beta ${i}`, email: undefined });
      await addParticipant(testDb, split.id, { personId: person.id, alias: `Beta${i}`, level: "N1", startWeekSequenceNumber: 1, factionId: factionB.id });
    }
    await activateStabilityKpi(split.id);

    await expect(activateSplit(testDb, split.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("activa correctamente con dos facciones completas de tres participantes cada una", async () => {
    const split = await createDraftSplit();
    const factionA = await createFaction(testDb, split.id, { name: "Alfa", color: "#111111" });
    const factionB = await createFaction(testDb, split.id, { name: "Beta", color: "#222222" });
    for (const faction of [factionA, factionB]) {
      for (let i = 0; i < 3; i += 1) {
        const person = await createPerson(testDb, { fullName: `${faction.name} ${i}`, email: undefined });
        await addParticipant(testDb, split.id, { personId: person.id, alias: `${faction.name}${i}`, level: "N1", startWeekSequenceNumber: 1, factionId: faction.id });
      }
    }
    await activateStabilityKpi(split.id);

    await expect(activateSplit(testDb, split.id)).resolves.toBeTruthy();
  });
});

describe("Facciones: administracion", () => {
  it("no elimina una faccion con participantes asignados", async () => {
    const split = await createDraftSplit();
    const faction = await createFaction(testDb, split.id, { name: "Alfa", color: "#111111" });
    const person = await createPerson(testDb, { fullName: "Con Faccion", email: undefined });
    await addParticipant(testDb, split.id, { personId: person.id, alias: "ConFaccion", level: "N1", startWeekSequenceNumber: 1, factionId: faction.id });

    await expect(deleteFaction(testDb, split.id, faction.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("elimina una faccion vacia mientras el split no tiene publicaciones", async () => {
    const split = await createDraftSplit();
    const faction = await createFaction(testDb, split.id, { name: "Vacia", color: "#111111" });
    await expect(deleteFaction(testDb, split.id, faction.id)).resolves.toBeUndefined();
  });
});

describe("Facciones: publicacion, congelacion y clasificacion", () => {
  async function buildTwoFactionSplit() {
    const split = await createDraftSplit();
    const factionA = await createFaction(testDb, split.id, { name: "Alfa", color: "#ff0000" });
    const factionB = await createFaction(testDb, split.id, { name: "Beta", color: "#0000ff" });

    const scoresA = [60, 50, 40];
    const scoresB = [30, 20, 10];
    const participantsA = [];
    const participantsB = [];

    for (let i = 0; i < 3; i += 1) {
      const personA = await createPerson(testDb, { fullName: `Alfa ${i}`, email: undefined });
      const participantA = await addParticipant(testDb, split.id, {
        personId: personA.id, alias: `Alfa${i}`, level: "N2", startWeekSequenceNumber: 1, factionId: factionA.id,
      });
      participantsA.push(participantA);

      const personB = await createPerson(testDb, { fullName: `Beta ${i}`, email: undefined });
      const participantB = await addParticipant(testDb, split.id, {
        personId: personB.id, alias: `Beta${i}`, level: "N2", startWeekSequenceNumber: 1, factionId: factionB.id,
      });
      participantsB.push(participantB);
    }

    await activateStabilityKpi(split.id);
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    const entries: Record<string, string> = {};
    participantsA.forEach((participant, index) => (entries[`resultValue__${participant.id}`] = String(scoresA[index])));
    participantsB.forEach((participant, index) => (entries[`resultValue__${participant.id}`] = String(scoresB[index])));
    await saveStabilityEntries(testDb, split.id, week.id, form(entries));

    return { split, factionA, factionB, week };
  }

  it("la publicacion congela faccion, nombre, color y puntos del momento; la suma usa exactamente los tres mejores", async () => {
    const { split, factionA, week } = await buildTwoFactionSplit();
    await markAllPresent(testDb, split.id, week.id);
    await publishWeek(testDb, split.id, week.id, null);

    const classification = await computeFactionClassification(testDb, split.id);
    expect(classification.hasFactionData).toBe(true);
    const weekEntry = classification.weekClassifications.get(week.id)!;
    const alfaEntry = weekEntry.entries.find((entry) => entry.factionId === factionA.id)!;
    expect(alfaEntry.weeklyScore).toBe(15 + 11 + 8);
    expect(alfaEntry.weeklyRank).toBe(1);
    expect(alfaEntry.name).toBe("Alfa");
    expect(alfaEntry.color).toBe("#ff0000");

    const rows = await testDb.publishedParticipantWeeklyResult.findMany({ where: { factionId: factionA.id } });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.factionNameSnapshot === "Alfa" && row.factionColorSnapshot === "#ff0000")).toBe(true);
  });

  it("renombrar o cambiar el color de la faccion despues de publicar no cambia el snapshot de la semana ya publicada", async () => {
    const { split, factionA, week } = await buildTwoFactionSplit();
    await markAllPresent(testDb, split.id, week.id);
    await publishWeek(testDb, split.id, week.id, null);

    await updateFaction(testDb, split.id, factionA.id, { name: "Alfa Renombrada", color: "#00ff00" });

    const classification = await computeFactionClassification(testDb, split.id);
    const weekEntry = classification.weekClassifications.get(week.id)!;
    const alfaEntry = weekEntry.entries.find((entry) => entry.factionId === factionA.id)!;
    // La semana ya publicada conserva el nombre/color con los que se publico.
    expect(alfaEntry.name).toBe("Alfa");
    expect(alfaEntry.color).toBe("#ff0000");
    // La clasificacion acumulada (y la administracion) usan el nombre/color actuales.
    const accumulatedEntry = classification.accumulated.find((entry) => entry.factionId === factionA.id)!;
    expect(accumulatedEntry.name).toBe("Alfa Renombrada");
    expect(accumulatedEntry.color).toBe("#00ff00");
  });

  it("reasignar la faccion de un participante despues de publicar no cambia la clasificacion historica", async () => {
    const { split, factionA, factionB, week } = await buildTwoFactionSplit();
    await markAllPresent(testDb, split.id, week.id);
    await publishWeek(testDb, split.id, week.id, null);

    const beforeClassification = await computeFactionClassification(testDb, split.id);
    const beforeAlfaScore = beforeClassification.weekClassifications.get(week.id)!.entries.find((entry) => entry.factionId === factionA.id)!.weeklyScore;

    const someAlfaParticipant = await testDb.splitParticipant.findFirstOrThrow({ where: { splitId: split.id, factionId: factionA.id } });
    await updateParticipant(testDb, someAlfaParticipant.id, { alias: someAlfaParticipant.alias, level: someAlfaParticipant.level, factionId: factionB.id });

    const afterClassification = await computeFactionClassification(testDb, split.id);
    const afterAlfaScore = afterClassification.weekClassifications.get(week.id)!.entries.find((entry) => entry.factionId === factionA.id)!.weeklyScore;
    expect(afterAlfaScore).toBe(beforeAlfaScore);
  });

  it("una faccion con menos de tres participantes aplicables esa semana bloquea la publicacion", async () => {
    const split = await createDraftSplit();
    const factionA = await createFaction(testDb, split.id, { name: "Alfa", color: "#111111" });
    const factionB = await createFaction(testDb, split.id, { name: "Beta", color: "#222222" });

    for (let i = 0; i < 3; i += 1) {
      const person = await createPerson(testDb, { fullName: `Alfa ${i}`, email: undefined });
      await addParticipant(testDb, split.id, { personId: person.id, alias: `Alfa${i}`, level: "N2", startWeekSequenceNumber: 1, factionId: factionA.id });
    }
    for (let i = 0; i < 3; i += 1) {
      const person = await createPerson(testDb, { fullName: `Beta ${i}`, email: undefined });
      await addParticipant(testDb, split.id, { personId: person.id, alias: `Beta${i}`, level: "N2", startWeekSequenceNumber: 1, factionId: factionB.id });
    }
    await activateStabilityKpi(split.id);
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    // Deja fuera a un participante de Beta (solo 2 con dato): la semana sigue completa (STABILITY_GUARDIAN acepta vacio como 0),
    // asi que forzamos el escenario incompleto de facciones incorporando un tercer participante en una semana posterior.
    const betaParticipants = await testDb.splitParticipant.findMany({ where: { splitId: split.id, factionId: factionB.id } });
    await testDb.splitParticipant.update({ where: { id: betaParticipants[0]!.id }, data: { startWeekSequenceNumber: 2 } });

    const entries: Record<string, string> = {};
    const allParticipants = await testDb.splitParticipant.findMany({ where: { splitId: split.id, startWeekSequenceNumber: 1 } });
    for (const participant of allParticipants) entries[`resultValue__${participant.id}`] = "10";
    await saveStabilityEntries(testDb, split.id, week.id, form(entries));
    await markAllPresent(testDb, split.id, week.id);

    await expect(publishWeek(testDb, split.id, week.id, null)).rejects.toBeInstanceOf(DomainError);
    expect(await testDb.weekPublication.count()).toBe(0);
  });

  it("publicaciones anteriores sin snapshot de faccion (split sin facciones) no se recalculan ni se incluyen en la clasificacion", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Legacy", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Legacy", level: "N2", startWeekSequenceNumber: 1 });
    await activateStabilityKpi(split.id);
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "10" }));
    await markAllPresent(testDb, split.id, week.id);
    await publishWeek(testDb, split.id, week.id, null);

    const classification = await computeFactionClassification(testDb, split.id);
    expect(classification.hasFactionData).toBe(false);
    expect(classification.accumulated).toHaveLength(0);
  });
});
