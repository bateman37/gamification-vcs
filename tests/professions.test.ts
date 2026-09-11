import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { createPerson } from "@/server/services/person.service";
import { createSplitWithWeeks, activateSplit, listSplitWeeks } from "@/server/services/split.service";
import { addParticipant, updateParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { saveStabilityEntries } from "@/server/services/stability-entry.service";
import { publishWeek } from "@/server/services/publish-week.service";
import { computeWeeklyResults } from "@/server/services/weekly-results.service";
import { createProfession, deleteProfession, updateProfession } from "@/server/services/profession.service";
import { getPersonHistory, getPersonSplitDetail } from "@/server/services/individual-results.service";
import { DomainError } from "@/lib/errors";

/**
 * Profesiones, bonus del +20 %, publicacion inmutable y rotulo semanal del
 * historico (`0.8.0` / MVP-2B, secciones 32.1, 32.2, 32.3 y 32.4 del
 * encargo).
 */

const PROFESSION_A = {
  name: "Mecanico",
  kpiCodeA: "STABILITY_GUARDIAN",
  kpiCodeB: "ENTHUSIASTIC_STUDENT",
  availableN0: false,
  availableN1: false,
  availableN2: true,
} as const;

async function createDraftSplit(numberOfWeeks = 2, startDate = "2025-10-06") {
  return createSplitWithWeeks(testDb, { name: "Split de profesiones", description: undefined, startDate, numberOfWeeks });
}

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

/** Guardian de la Estabilidad con `pointsPerResult = 1` y multiplicador N2 = 1: resultValue = puntos base. */
async function activateStabilityKpi(splitId: string, baseMax = 70) {
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

describe("Profesiones: modelo y validacion", () => {
  it("crea una profesion con nombre, dos KPI y niveles validos", async () => {
    const split = await createDraftSplit();
    const profession = await createProfession(testDb, split.id, PROFESSION_A);
    expect(profession.name).toBe("Mecanico");
    expect(profession.kpiCodeA).toBe("STABILITY_GUARDIAN");
    expect(profession.availableN2).toBe(true);
  });

  it("rechaza un nombre duplicado normalizado dentro del mismo split", async () => {
    const split = await createDraftSplit();
    await createProfession(testDb, split.id, PROFESSION_A);
    await expect(createProfession(testDb, split.id, { ...PROFESSION_A, name: "  mecanico  " })).rejects.toBeInstanceOf(DomainError);
  });

  it("permite el mismo nombre en otro split", async () => {
    const splitA = await createDraftSplit();
    const splitB = await createDraftSplit();
    await createProfession(testDb, splitA.id, PROFESSION_A);
    await expect(createProfession(testDb, splitB.id, PROFESSION_A)).resolves.toBeTruthy();
  });

  it("rechaza dos KPI iguales tambien a nivel de base de datos", async () => {
    const split = await createDraftSplit();
    await expect(
      testDb.splitProfession.create({
        data: {
          splitId: split.id,
          name: "Invalida",
          nameNormalized: "invalida",
          kpiCodeA: "STABILITY_GUARDIAN",
          kpiCodeB: "STABILITY_GUARDIAN",
          availableN2: true,
        },
      }),
    ).rejects.toThrow();
  });

  it("rechaza una profesion sin ningun nivel disponible a nivel de base de datos", async () => {
    const split = await createDraftSplit();
    await expect(
      testDb.splitProfession.create({
        data: { splitId: split.id, name: "Sin niveles", nameNormalized: "sin niveles", kpiCodeA: "STABILITY_GUARDIAN", kpiCodeB: "ENTHUSIASTIC_STUDENT" },
      }),
    ).rejects.toThrow();
  });

  it("rechaza editar o eliminar una profesion de otro split", async () => {
    const splitA = await createDraftSplit();
    const splitB = await createDraftSplit();
    const professionOfB = await createProfession(testDb, splitB.id, PROFESSION_A);

    await expect(updateProfession(testDb, splitA.id, professionOfB.id, PROFESSION_A)).rejects.toBeInstanceOf(DomainError);
    await expect(deleteProfession(testDb, splitA.id, professionOfB.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("rechaza eliminar una profesion con participantes asignados", async () => {
    const split = await createDraftSplit();
    const profession = await createProfession(testDb, split.id, PROFESSION_A);
    const person = await createPerson(testDb, { fullName: "Con Profesion", email: undefined });
    await addParticipant(testDb, split.id, {
      personId: person.id, alias: "ConProfesion", level: "N2", startWeekSequenceNumber: 1, professionId: profession.id,
    });

    await expect(deleteProfession(testDb, split.id, profession.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("rechaza una edicion de niveles que dejaria invalida la profesion de algun participante", async () => {
    const split = await createDraftSplit();
    const profession = await createProfession(testDb, split.id, PROFESSION_A);
    const person = await createPerson(testDb, { fullName: "Nivel Dos", email: undefined });
    await addParticipant(testDb, split.id, {
      personId: person.id, alias: "NivelDos", level: "N2", startWeekSequenceNumber: 1, professionId: profession.id,
    });

    await expect(
      updateProfession(testDb, split.id, profession.id, { ...PROFESSION_A, availableN2: false, availableN0: true }),
    ).rejects.toBeInstanceOf(DomainError);

    // La asignacion no se ha limpiado en silencio.
    const stillAssigned = await testDb.splitParticipant.findFirstOrThrow({ where: { splitId: split.id } });
    expect(stillAssigned.professionId).toBe(profession.id);
  });

  it("permite crear una profesion cuyos KPI todavia estan inactivos", async () => {
    const split = await createDraftSplit();
    await expect(createProfession(testDb, split.id, PROFESSION_A)).resolves.toBeTruthy();
  });
});

describe("Profesiones: asignacion", () => {
  it("un split sin profesiones deja al participante sin profesion y publica con normalidad", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Sin Profesiones", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "SinProf", level: "N2", startWeekSequenceNumber: 1 });
    expect(participant.professionId).toBeNull();

    await activateStabilityKpi(split.id);
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "50" }));

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    expect(results.usesProfessions).toBe(false);
    expect(results.blockingIssues).toHaveLength(0);
    await expect(publishWeek(testDb, split.id, week.id, null)).resolves.toBeTruthy();

    const published = await testDb.publishedParticipantWeeklyResult.findFirstOrThrow({ where: { splitId: split.id } });
    expect(published.splitUsedProfessions).toBe(false);
    expect(published.professionId).toBeNull();
  });

  it("antes de publicar, el administrador puede dejar la profesion vacia y asignarla despues", async () => {
    const split = await createDraftSplit();
    const profession = await createProfession(testDb, split.id, PROFESSION_A);
    const person = await createPerson(testDb, { fullName: "Eligira Despues", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Despues", level: "N2", startWeekSequenceNumber: 1 });
    expect(participant.professionId).toBeNull();

    const updated = await updateParticipant(testDb, participant.id, { alias: "Despues", level: "N2", professionId: profession.id });
    expect(updated.professionId).toBe(profession.id);
  });

  it("rechaza una profesion de otro split y una no disponible para el nivel", async () => {
    const splitA = await createDraftSplit();
    const splitB = await createDraftSplit();
    const professionOfB = await createProfession(testDb, splitB.id, PROFESSION_A);
    const professionOfA = await createProfession(testDb, splitA.id, PROFESSION_A);
    const person = await createPerson(testDb, { fullName: "Cruzada", email: undefined });

    await expect(
      addParticipant(testDb, splitA.id, { personId: person.id, alias: "Cruzada", level: "N2", startWeekSequenceNumber: 1, professionId: professionOfB.id }),
    ).rejects.toBeInstanceOf(DomainError);

    // PROFESSION_A solo esta disponible para N2.
    await expect(
      addParticipant(testDb, splitA.id, { personId: person.id, alias: "Cruzada", level: "N0", startWeekSequenceNumber: 1, professionId: professionOfA.id }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("bloquea la publicacion si un participante aplicable sigue sin profesion", async () => {
    const split = await createDraftSplit();
    await createProfession(testDb, split.id, PROFESSION_A);
    const person = await createPerson(testDb, { fullName: "Sin Elegir", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "SinElegir", level: "N2", startWeekSequenceNumber: 1 });
    await activateStabilityKpi(split.id);
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "50" }));

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    expect(results.blockingIssues.some((issue) => issue.includes("SinElegir"))).toBe(true);
    await expect(publishWeek(testDb, split.id, week.id, null)).rejects.toBeInstanceOf(DomainError);
    expect(await testDb.weekPublication.count()).toBe(0);
  });
});

describe("Profesiones: bloqueo desde la primera publicacion", () => {
  async function publishFirstWeek() {
    const split = await createDraftSplit();
    const profession = await createProfession(testDb, split.id, PROFESSION_A);
    const person = await createPerson(testDb, { fullName: "Primera", email: undefined });
    const participant = await addParticipant(testDb, split.id, {
      personId: person.id, alias: "Primera", level: "N2", startWeekSequenceNumber: 1, professionId: profession.id,
    });
    await activateStabilityKpi(split.id);
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "50" }));
    await publishWeek(testDb, split.id, week.id, null);
    return { split, profession, participant, week };
  }

  it("no permite crear, editar ni eliminar profesiones despues de publicar", async () => {
    const { split, profession } = await publishFirstWeek();

    await expect(createProfession(testDb, split.id, { ...PROFESSION_A, name: "Nueva" })).rejects.toBeInstanceOf(DomainError);
    await expect(updateProfession(testDb, split.id, profession.id, { ...PROFESSION_A, name: "Renombrada" })).rejects.toBeInstanceOf(DomainError);
    await expect(deleteProfession(testDb, split.id, profession.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("no permite que el administrador cambie ni vacie la profesion despues de publicar", async () => {
    const { split, participant } = await publishFirstWeek();
    const other = await testDb.splitProfession.create({
      data: { splitId: split.id, name: "Otra", nameNormalized: "otra", kpiCodeA: "STABILITY_GUARDIAN", kpiCodeB: "EXPERT_APPRENTICE", availableN2: true },
    });

    await expect(
      updateParticipant(testDb, participant.id, { alias: "Primera", level: "N2", professionId: other.id }),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(updateParticipant(testDb, participant.id, { alias: "Primera", level: "N2" })).rejects.toBeInstanceOf(DomainError);
  });

  it("rechaza cambiar el nivel a uno incompatible con la profesion congelada, sin eliminarla", async () => {
    const { participant, profession } = await publishFirstWeek();
    await expect(
      updateParticipant(testDb, participant.id, { alias: "Primera", level: "N0", professionId: profession.id }),
    ).rejects.toBeInstanceOf(DomainError);

    const unchanged = await testDb.splitParticipant.findUniqueOrThrow({ where: { id: participant.id } });
    expect(unchanged.professionId).toBe(profession.id);
    expect(unchanged.level).toBe("N2");
  });

  it("un alta posterior a la primera publicacion exige profesion en el propio alta", async () => {
    const { split, profession } = await publishFirstWeek();
    const person = await createPerson(testDb, { fullName: "Nueva Incorporacion", email: undefined });

    await expect(
      addParticipant(testDb, split.id, { personId: person.id, alias: "Nueva", level: "N2", startWeekSequenceNumber: 2 }),
    ).rejects.toBeInstanceOf(DomainError);

    const created = await addParticipant(testDb, split.id, {
      personId: person.id, alias: "Nueva", level: "N2", startWeekSequenceNumber: 2, professionId: profession.id,
    });
    expect(created.professionId).toBe(profession.id);
  });

  it("un split sin profesiones publicado sigue sin exigir profesion en un alta posterior", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Legacy", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Legacy", level: "N2", startWeekSequenceNumber: 1 });
    await activateStabilityKpi(split.id);
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "10" }));
    await publishWeek(testDb, split.id, week.id, null);

    const other = await createPerson(testDb, { fullName: "Otra Legacy", email: undefined });
    await expect(
      addParticipant(testDb, split.id, { personId: other.id, alias: "OtraLegacy", level: "N2", startWeekSequenceNumber: 2 }),
    ).resolves.toBeTruthy();
  });
});

describe("Profesiones: calculo, publicacion e historico", () => {
  async function buildSplitWithProfession(options: { resultValue: string; baseMax?: number }) {
    const split = await createDraftSplit();
    const profession = await createProfession(testDb, split.id, PROFESSION_A);
    const person = await createPerson(testDb, { fullName: "Con Bonus", email: undefined });
    const participant = await addParticipant(testDb, split.id, {
      personId: person.id, alias: "ConBonus", level: "N2", startWeekSequenceNumber: 1, professionId: profession.id,
    });
    await activateStabilityKpi(split.id, options.baseMax ?? 70);
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: options.resultValue }));
    return { split, profession, person, participant, week };
  }

  it("50 con maximo 70 produce 60 y 80 con maximo 70 produce 84 en el motor agregado", async () => {
    const below = await buildSplitWithProfession({ resultValue: "50" });
    const belowResults = await computeWeeklyResults(testDb, below.split.id, below.week.id);
    const belowCell = belowResults.participants[0]!.kpiResults.find((kpi) => kpi.kpiCode === "STABILITY_GUARDIAN")!;
    expect(belowCell.basePointsBeforeProfession).toBe(50);
    expect(belowCell.professionBonusPoints).toBe(10);
    expect(belowCell.finalPoints).toBe(60);
    expect(belowResults.participants[0]!.totalKpiPoints).toBe(60);

    await resetDatabase();

    const capped = await buildSplitWithProfession({ resultValue: "80" });
    const cappedResults = await computeWeeklyResults(testDb, capped.split.id, capped.week.id);
    const cappedCell = cappedResults.participants[0]!.kpiResults.find((kpi) => kpi.kpiCode === "STABILITY_GUARDIAN")!;
    expect(cappedCell.capped).toBe(true);
    expect(cappedCell.basePointsBeforeProfession).toBe(70);
    expect(cappedCell.professionBonusPoints).toBe(14);
    expect(cappedCell.finalPoints).toBe(84);
    // applicableMaxPoints sigue siendo el maximo base, no uno inflado por profesion.
    expect(cappedResults.participants[0]!.applicableMaxPoints).toBe(70);
  });

  it("no bonifica un KPI ajeno a la profesion ni un resultado cero", async () => {
    const split = await createDraftSplit();
    const profession = await createProfession(testDb, split.id, {
      ...PROFESSION_A, kpiCodeA: "ENTHUSIASTIC_STUDENT", kpiCodeB: "EXPERT_APPRENTICE",
    });
    const person = await createPerson(testDb, { fullName: "Otro KPI", email: undefined });
    const participant = await addParticipant(testDb, split.id, {
      personId: person.id, alias: "OtroKpi", level: "N2", startWeekSequenceNumber: 1, professionId: profession.id,
    });
    await activateStabilityKpi(split.id);
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "50" }));

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    const cell = results.participants[0]!.kpiResults.find((kpi) => kpi.kpiCode === "STABILITY_GUARDIAN")!;
    expect(cell.professionApplied).toBe(false);
    expect(cell.professionBonusPoints).toBe(0);
    expect(cell.finalPoints).toBe(50);

    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "0" }));
    const zeroResults = await computeWeeklyResults(testDb, split.id, week.id);
    const zeroCell = zeroResults.participants[0]!.kpiResults.find((kpi) => kpi.kpiCode === "STABILITY_GUARDIAN")!;
    expect(zeroCell.finalPoints).toBe(0);
    expect(zeroCell.professionBonusPoints).toBe(0);
  });

  it("el bonus modifica total, ranking y puntos por posicion una sola vez", async () => {
    const split = await createDraftSplit();
    const profession = await createProfession(testDb, split.id, PROFESSION_A);
    const withBonusPerson = await createPerson(testDb, { fullName: "Con Bonus", email: undefined });
    const withoutBonusPerson = await createPerson(testDb, { fullName: "Sin Bonus", email: undefined });
    // Mismo dato base (50); solo uno tiene la profesion que potencia Guardian.
    const withBonus = await addParticipant(testDb, split.id, {
      personId: withBonusPerson.id, alias: "ZConBonus", level: "N2", startWeekSequenceNumber: 1, professionId: profession.id,
    });
    const otherProfession = await testDb.splitProfession.create({
      data: { splitId: split.id, name: "Otra", nameNormalized: "otra", kpiCodeA: "ENTHUSIASTIC_STUDENT", kpiCodeB: "EXPERT_APPRENTICE", availableN2: true },
    });
    const withoutBonus = await addParticipant(testDb, split.id, {
      personId: withoutBonusPerson.id, alias: "ASinBonus", level: "N2", startWeekSequenceNumber: 1, professionId: otherProfession.id,
    });
    await activateStabilityKpi(split.id);
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(
      testDb,
      split.id,
      week.id,
      form({ [`resultValue__${withBonus.id}`]: "50", [`resultValue__${withoutBonus.id}`]: "55" }),
    );

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    const bonusEntry = results.participants.find((participant) => participant.splitParticipantId === withBonus.id)!;
    const plainEntry = results.participants.find((participant) => participant.splitParticipantId === withoutBonus.id)!;

    // 50 + 20 % = 60 supera a 55: el bonus decide el ranking, aplicado una sola vez.
    expect(bonusEntry.totalKpiPoints).toBe(60);
    expect(plainEntry.totalKpiPoints).toBe(55);
    expect(bonusEntry.weeklyRank).toBe(1);
    expect(plainEntry.weeklyRank).toBe(2);
    expect(bonusEntry.positionPoints).toBe(15);
    expect(plainEntry.positionPoints).toBe(11);

    // Recalcular no vuelve a aplicar el bonus.
    const again = await computeWeeklyResults(testDb, split.id, week.id);
    expect(again.participants.find((participant) => participant.splitParticipantId === withBonus.id)!.totalKpiPoints).toBe(60);

    await publishWeek(testDb, split.id, week.id, null);
    const publishedBonus = await testDb.publishedParticipantWeeklyResult.findFirstOrThrow({ where: { splitParticipantId: withBonus.id } });
    expect(publishedBonus.totalKpiPoints.toNumber()).toBe(60);
    expect(publishedBonus.positionPoints).toBe(15);
  });

  it("la publicacion congela profesion y desglose del bonus, y un cambio posterior de alias no los altera", async () => {
    const { split, profession, participant, week, person } = await buildSplitWithProfession({ resultValue: "80" });
    await publishWeek(testDb, split.id, week.id, null);

    const published = await testDb.publishedParticipantWeeklyResult.findFirstOrThrow({
      where: { splitParticipantId: participant.id },
      include: { kpiResults: true },
    });
    expect(published.splitUsedProfessions).toBe(true);
    expect(published.professionId).toBe(profession.id);
    expect(published.professionNameSnapshot).toBe("Mecanico");
    expect(published.professionKpiCodeA).toBe("STABILITY_GUARDIAN");
    expect(published.professionBonusPercent).toBe(20);

    const kpiResult = published.kpiResults.find((result) => result.kpiCode === "STABILITY_GUARDIAN")!;
    expect(kpiResult.basePointsBeforeProfession!.toNumber()).toBe(70);
    expect(kpiResult.professionBonusPoints!.toNumber()).toBe(14);
    expect(kpiResult.finalPoints!.toNumber()).toBe(84);
    expect(kpiResult.professionApplied).toBe(true);
    expect(kpiResult.professionNameSnapshot).toBe("Mecanico");

    // Cambiar el alias despues no reescribe el snapshot.
    await testDb.splitParticipant.update({ where: { id: participant.id }, data: { alias: "Renombrado", aliasNormalized: "renombrado" } });
    const stillFrozen = await testDb.publishedParticipantWeeklyResult.findFirstOrThrow({ where: { splitParticipantId: participant.id } });
    expect(stillFrozen.aliasSnapshot).toBe("ConBonus");
    expect(stillFrozen.professionNameSnapshot).toBe("Mecanico");

    const detail = await getPersonSplitDetail(testDb, person.id, split.id);
    expect(detail!.weeks[0]!.profession!.name).toBe("Mecanico");
    expect(detail!.weeks[0]!.professionBonusTotal).toBe(14);
  });

  it("una publicacion sin profesiones sigue siendo legible y no suma bonus en el historico", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Legacy", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Legacy", level: "N2", startWeekSequenceNumber: 1 });
    await activateStabilityKpi(split.id);
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "50" }));
    await publishWeek(testDb, split.id, week.id, null);

    const detail = await getPersonSplitDetail(testDb, person.id, split.id);
    expect(detail!.weeks[0]!.splitUsedProfessions).toBe(false);
    expect(detail!.weeks[0]!.profession).toBeNull();
    expect(detail!.weeks[0]!.professionBonusTotal).toBe(0);

    const history = await getPersonHistory(testDb, person.id, { year: "todos", splitId: "todos", grouping: "semana" });
    expect(history.groups[0]!.professionBonusSum).toBe(0);
  });

  it("el historico suma los professionBonusPoints publicados, no los recalcula", async () => {
    const { split, profession, person, week } = await buildSplitWithProfession({ resultValue: "80" });
    await publishWeek(testDb, split.id, week.id, null);

    // Un cambio posterior de la definicion (forzado directamente en base de datos, ya que el servicio lo bloquea)
    // no debe alterar el bonus ya publicado.
    await testDb.splitProfession.update({ where: { id: profession.id }, data: { kpiCodeA: "EXPERT_APPRENTICE" } });

    const history = await getPersonHistory(testDb, person.id, { year: "todos", splitId: "todos", grouping: "semana" });
    expect(history.groups).toHaveLength(1);
    expect(history.groups[0]!.professionBonusSum).toBe(14);
    expect(history.groups[0]!.sumKpiPoints).toBe(84);
    const kpiBreakdown = history.groups[0]!.perKpi.find((entry) => entry.kpiCode === "STABILITY_GUARDIAN")!;
    expect(kpiBreakdown.professionBonusSum).toBe(14);
    expect(kpiBreakdown.sum).toBe(84);
  });
});

describe("Historico general: rotulo semanal por fecha de inicio", () => {
  async function publishWeekOfSplit(splitName: string, startDate: string, personFullName: string, alias: string) {
    const split = await createSplitWithWeeks(testDb, { name: splitName, description: undefined, startDate, numberOfWeeks: 2 });
    const person = await createPerson(testDb, { fullName: personFullName, email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias, level: "N2", startWeekSequenceNumber: 1 });
    await activateStabilityKpi(split.id);
    await activateSplit(testDb, split.id);
    const weeks = await listSplitWeeks(testDb, split.id);
    for (const week of weeks) {
      await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "10" }));
      await publishWeek(testDb, split.id, week.id, null);
    }
    return { split, person };
  }

  it("muestra la fecha de inicio UTC en vez de 'Semana N' y ordena cronologicamente descendente", async () => {
    const { person } = await publishWeekOfSplit("Split fechas", "2026-09-07", "Fecha Uno", "FechaUno");

    const history = await getPersonHistory(testDb, person.id, { year: "todos", splitId: "todos", grouping: "semana" });
    expect(history.groups.map((group) => group.periodLabel)).toEqual(["14/09/2026", "07/09/2026"]);
    expect(history.groups.every((group) => !group.periodLabel.startsWith("Semana"))).toBe(true);
  });

  it("no fusiona dos semanas de splits distintos que empiezan el mismo dia, y muestra el nombre del split", async () => {
    const personA = await createPerson(testDb, { fullName: "Persona Comun", email: undefined });

    for (const splitName of ["Split A", "Split B"]) {
      const split = await createSplitWithWeeks(testDb, { name: splitName, description: undefined, startDate: "2026-09-07", numberOfWeeks: 1 });
      const participant = await addParticipant(testDb, split.id, { personId: personA.id, alias: `Alias ${splitName}`, level: "N2", startWeekSequenceNumber: 1 });
      await activateStabilityKpi(split.id);
      await activateSplit(testDb, split.id);
      const week = (await listSplitWeeks(testDb, split.id))[0]!;
      await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "10" }));
      await publishWeek(testDb, split.id, week.id, null);
    }

    const history = await getPersonHistory(testDb, personA.id, { year: "todos", splitId: "todos", grouping: "semana" });
    expect(history.groups).toHaveLength(2);
    expect(history.groups.every((group) => group.periodLabel === "07/09/2026")).toBe(true);
    expect(history.groups.map((group) => group.periodSecondaryLabel).sort()).toEqual(["Split A", "Split B"]);
  });

  it("las agrupaciones de mes y ano no cambian", async () => {
    const { person } = await publishWeekOfSplit("Split mes", "2026-09-07", "Fecha Mes", "FechaMes");

    const byMonth = await getPersonHistory(testDb, person.id, { year: "todos", splitId: "todos", grouping: "mes" });
    expect(byMonth.groups[0]!.periodLabel).toBe("septiembre 2026");
    expect(byMonth.groups[0]!.periodSecondaryLabel).toBeNull();

    const byYear = await getPersonHistory(testDb, person.id, { year: "todos", splitId: "todos", grouping: "año" });
    expect(byYear.groups[0]!.periodLabel).toBe("2026");
  });
});
