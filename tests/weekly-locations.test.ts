import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { buildWorkbookBuffer, PRODUCTIVITY_HEADERS } from "./helpers/xlsx";
import { createPerson } from "@/server/services/person.service";
import { createSplitWithWeeks, activateSplit, listSplitWeeks } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { saveWriterEntries } from "@/server/services/writer-entry.service";
import { confirmProductivityImport } from "@/server/services/productivity-import.service";
import { computeWeeklyResults } from "@/server/services/weekly-results.service";
import { publishWeek } from "@/server/services/publish-week.service";
import { createProfession } from "@/server/services/profession.service";
import {
  upsertWeekLocation,
  deleteWeekLocation,
  getWeekLocation,
  findFutureLocationsUsingKpi,
} from "@/server/services/location.service";
import { listProfileCardsForPerson } from "@/server/services/participant-profile.service";
import { getPersonSplitDetail, getPersonHistory } from "@/server/services/individual-results.service";
import { weekLocationFormSchema } from "@/server/validation/location";
import { currentCalendarDate, addCalendarDays, isoWeekday, formatCalendarDate } from "@/lib/dates";
import { DomainError } from "@/lib/errors";

/**
 * Localizaciones semanales (`0.8.5` / MVP-2C, seccion 30 del encargo).
 * Las pruebas de ventana temporal derivan sus fechas de "hoy" con los
 * helpers puros de `src/lib/dates.ts` en vez de fechas fijas, para no
 * depender de si la semana ya paso o no llegara nunca a pasar; nunca usan
 * `sleep` ni modifican el reloj.
 */

function mondayOfCurrentWeek(): Date {
  const today = currentCalendarDate();
  return addCalendarDays(today, -(isoWeekday(today) - 1));
}

/** Lunes de una semana `weeksAhead` semanas despues de la actual (siempre futura si weeksAhead >= 1). */
function futureMonday(weeksAhead: number): Date {
  return addCalendarDays(mondayOfCurrentWeek(), weeksAhead * 7);
}

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

async function createSplitStartingOn(startDate: Date, numberOfWeeks = 3) {
  return createSplitWithWeeks(testDb, {
    name: "Split de localizaciones",
    description: undefined,
    startDate: formatCalendarDate(startDate),
    numberOfWeeks,
  });
}

async function activateSolutionHunter(splitId: string) {
  await updateKpiConfig(testDb, splitId, "SOLUTION_HUNTER", {
    isActive: true,
    baseMax: 70,
    multiplierN1: 1,
    parameters: { pointsPerResolvedTicket: 1 },
  });
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Validacion del formulario (weekLocationFormSchema)", () => {
  it("acepta un nombre, un KPI del catalogo y un porcentaje permitido", () => {
    const result = weekLocationFormSchema.safeParse({ name: "Nebulosa", kpiCode: "SOLUTION_HUNTER", bonusPercent: "30" });
    expect(result.success).toBe(true);
  });

  it("rechaza un nombre vacio o demasiado largo", () => {
    expect(weekLocationFormSchema.safeParse({ name: "   ", kpiCode: "SOLUTION_HUNTER", bonusPercent: "30" }).success).toBe(false);
    expect(
      weekLocationFormSchema.safeParse({ name: "x".repeat(81), kpiCode: "SOLUTION_HUNTER", bonusPercent: "30" }).success,
    ).toBe(false);
  });

  it("rechaza 0, 15, 60 y decimales fuera del conjunto cerrado", () => {
    for (const bonusPercent of ["0", "15", "60", "30.5"]) {
      expect(weekLocationFormSchema.safeParse({ name: "Nebulosa", kpiCode: "SOLUTION_HUNTER", bonusPercent }).success).toBe(false);
    }
  });

  it("rechaza un KPI que no pertenece al catalogo", () => {
    expect(weekLocationFormSchema.safeParse({ name: "Nebulosa", kpiCode: "INVENTADO", bonusPercent: "30" }).success).toBe(false);
  });
});

describe("Modelo y reglas de servicio", () => {
  it("crea una localizacion con nombre, KPI activo y porcentaje permitido", async () => {
    const split = await createSplitStartingOn(futureMonday(1));
    await activateSolutionHunter(split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    const location = await upsertWeekLocation(testDb, split.id, week.id, { name: "Nebulosa", kpiCode: "SOLUTION_HUNTER", bonusPercent: 30 });
    expect(location.name).toBe("Nebulosa");
    expect(location.bonusPercent).toBe(30);
  });

  it("permite el mismo nombre en otra semana", async () => {
    const split = await createSplitStartingOn(futureMonday(1));
    await activateSolutionHunter(split.id);
    const [week1, week2] = await listSplitWeeks(testDb, split.id);

    await upsertWeekLocation(testDb, split.id, week1!.id, { name: "Nebulosa", kpiCode: "SOLUTION_HUNTER", bonusPercent: 30 });
    const second = await upsertWeekLocation(testDb, split.id, week2!.id, { name: "Nebulosa", kpiCode: "SOLUTION_HUNTER", bonusPercent: 20 });
    expect(second.name).toBe("Nebulosa");
  });

  it("rechaza un KPI que no esta activo en el split", async () => {
    const split = await createSplitStartingOn(futureMonday(1));
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await expect(
      upsertWeekLocation(testDb, split.id, week.id, { name: "Nebulosa", kpiCode: "SOLUTION_HUNTER", bonusPercent: 30 }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("rechaza una semana perteneciente a otro split", async () => {
    const splitA = await createSplitStartingOn(futureMonday(1));
    const splitB = await createSplitStartingOn(futureMonday(1));
    await activateSolutionHunter(splitA.id);
    const weekOfB = (await listSplitWeeks(testDb, splitB.id))[0]!;

    await expect(
      upsertWeekLocation(testDb, splitA.id, weekOfB.id, { name: "Nebulosa", kpiCode: "SOLUTION_HUNTER", bonusPercent: 30 }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("impide dos localizaciones en la misma semana: la segunda llamada actualiza, no duplica", async () => {
    const split = await createSplitStartingOn(futureMonday(1));
    await activateSolutionHunter(split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    await upsertWeekLocation(testDb, split.id, week.id, { name: "Nebulosa", kpiCode: "SOLUTION_HUNTER", bonusPercent: 30 });
    await upsertWeekLocation(testDb, split.id, week.id, { name: "Otra", kpiCode: "SOLUTION_HUNTER", bonusPercent: 40 });

    expect(await testDb.splitWeekLocation.count({ where: { splitWeekId: week.id } })).toBe(1);
    const { location } = await getWeekLocation(testDb, split.id, week.id);
    expect(location).toMatchObject({ name: "Otra", bonusPercent: 40 });
  });

  it("una semana sin localizacion continua siendo valida (no es un error)", async () => {
    const split = await createSplitStartingOn(futureMonday(1));
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    const { location, window } = await getWeekLocation(testDb, split.id, week.id);
    expect(location).toBeNull();
    expect(window.status).toBe("PROXIMA");
  });
});

describe("Ventana temporal", () => {
  it("permite crear, editar y eliminar antes de startDate", async () => {
    const split = await createSplitStartingOn(futureMonday(1));
    await activateSolutionHunter(split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    await upsertWeekLocation(testDb, split.id, week.id, { name: "Nebulosa", kpiCode: "SOLUTION_HUNTER", bonusPercent: 30 });
    await upsertWeekLocation(testDb, split.id, week.id, { name: "Nebulosa II", kpiCode: "SOLUTION_HUNTER", bonusPercent: 40 });
    await deleteWeekLocation(testDb, split.id, week.id);
    expect(await testDb.splitWeekLocation.count({ where: { splitWeekId: week.id } })).toBe(0);
  });

  it("bloquea las tres operaciones desde que la semana ya ha comenzado", async () => {
    // Semana que empezo este lunes: "ya ha comenzado" en cualquier dia de la semana en curso.
    const split = await createSplitStartingOn(mondayOfCurrentWeek(), 1);
    await activateSolutionHunter(split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    await expect(
      upsertWeekLocation(testDb, split.id, week.id, { name: "Nebulosa", kpiCode: "SOLUTION_HUNTER", bonusPercent: 30 }),
    ).rejects.toBeInstanceOf(DomainError);

    // Crearla directamente para comprobar que tampoco se puede editar ni eliminar ya creada.
    await testDb.splitWeekLocation.create({ data: { splitWeekId: week.id, name: "Nebulosa", kpiCode: "SOLUTION_HUNTER", bonusPercent: 30 } });
    await expect(
      upsertWeekLocation(testDb, split.id, week.id, { name: "Otra", kpiCode: "SOLUTION_HUNTER", bonusPercent: 40 }),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(deleteWeekLocation(testDb, split.id, week.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("bloquea siempre una semana publicada", async () => {
    const split = await createSplitStartingOn(futureMonday(1));
    const person = await createPerson(testDb, { fullName: "Persona Publicable", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Publicable", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "STAR_WRITER", {
      isActive: true, baseMax: 70, multiplierN1: 1, parameters: { approvedArticlePoints: 10, negativeArticlePoints: 10, proposalPoints: 5 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    await upsertWeekLocation(testDb, split.id, week.id, { name: "Nebulosa", kpiCode: "STAR_WRITER", bonusPercent: 30 });
    await saveWriterEntries(
      testDb,
      split.id,
      week.id,
      form({ [`deliveredArticles__${participant.id}`]: "1", [`undeliveredArticles__${participant.id}`]: "0", [`proposedArticles__${participant.id}`]: "0" }),
    );

    await publishWeek(testDb, split.id, week.id, null);

    await expect(
      upsertWeekLocation(testDb, split.id, week.id, { name: "Otra", kpiCode: "SOLUTION_HUNTER", bonusPercent: 40 }),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(deleteWeekLocation(testDb, split.id, week.id)).rejects.toBeInstanceOf(DomainError);

    const { window } = await getWeekLocation(testDb, split.id, week.id);
    expect(window.status).toBe("PUBLICADA");
  });

  it("bloquea mutaciones en un split cerrado", async () => {
    const split = await createSplitStartingOn(futureMonday(1));
    await activateSolutionHunter(split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await testDb.split.update({ where: { id: split.id }, data: { status: "CLOSED" } });

    await expect(
      upsertWeekLocation(testDb, split.id, week.id, { name: "Nebulosa", kpiCode: "SOLUTION_HUNTER", bonusPercent: 30 }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe("Integridad de KPI", () => {
  it("no permite desactivar un KPI usado por una localizacion futura, e informa de la semana afectada", async () => {
    const split = await createSplitStartingOn(futureMonday(1));
    await activateSolutionHunter(split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await upsertWeekLocation(testDb, split.id, week.id, { name: "Nebulosa", kpiCode: "SOLUTION_HUNTER", bonusPercent: 30 });

    await expect(
      updateKpiConfig(testDb, split.id, "SOLUTION_HUNTER", { isActive: false, baseMax: 70, multiplierN1: 1, parameters: { pointsPerResolvedTicket: 1 } }),
    ).rejects.toThrow(/semana 1/);

    // La localizacion no se borra ni se cambia en silencio.
    const { location } = await getWeekLocation(testDb, split.id, week.id);
    expect(location).not.toBeNull();

    const affected = await findFutureLocationsUsingKpi(testDb, split.id, "SOLUTION_HUNTER");
    expect(affected).toEqual([{ sequenceNumber: 1, locationName: "Nebulosa" }]);
  });

  it("permite desactivar el KPI si no lo usa ninguna localizacion futura", async () => {
    const split = await createSplitStartingOn(futureMonday(1));
    await activateSolutionHunter(split.id);
    await expect(
      updateKpiConfig(testDb, split.id, "SOLUTION_HUNTER", { isActive: false, baseMax: 70, multiplierN1: 1, parameters: { pointsPerResolvedTicket: 1 } }),
    ).resolves.toBeDefined();
  });
});

describe("Calculo: composicion no encadenada con profesion", () => {
  async function buildParticipantWithDeliveredArticles(splitId: string, weekId: string, delivered: number, level: "N1" = "N1") {
    const person = await createPerson(testDb, { fullName: `Persona ${delivered}`, email: undefined });
    const participant = await addParticipant(testDb, splitId, { personId: person.id, alias: `P${delivered}`, level, startWeekSequenceNumber: 1 });
    const split = await testDb.split.findUniqueOrThrow({ where: { id: splitId } });
    if (split.status === "DRAFT") await activateSplit(testDb, splitId);
    await saveWriterEntries(
      testDb,
      splitId,
      weekId,
      form({
        [`deliveredArticles__${participant.id}`]: String(delivered),
        [`undeliveredArticles__${participant.id}`]: "0",
        [`proposedArticles__${participant.id}`]: "0",
      }),
    );
    return participant;
  }

  it("base 50 con localizacion 30 % produce 65 (solo localizacion, sin tope)", async () => {
    const split = await createSplitStartingOn(futureMonday(1));
    // STAR_WRITER: baseMax alto para no capar; 5 entregados x 10 x multiplicador 1 = 50.
    await updateKpiConfig(testDb, split.id, "STAR_WRITER", {
      isActive: true, baseMax: 100, multiplierN1: 1, parameters: { approvedArticlePoints: 10, negativeArticlePoints: 10, proposalPoints: 5 },
    });
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await upsertWeekLocation(testDb, split.id, week.id, { name: "Nebulosa", kpiCode: "STAR_WRITER", bonusPercent: 30 });
    const participant = await buildParticipantWithDeliveredArticles(split.id, week.id, 5);

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    const row = results.participants.find((p) => p.splitParticipantId === participant.id)!;
    const cell = row.kpiResults.find((k) => k.kpiCode === "STAR_WRITER")!;
    expect(cell.basePointsBeforeProfession).toBe(50);
    expect(cell.locationBonusPoints).toBe(15);
    expect(cell.locationApplied).toBe(true);
    expect(cell.finalPoints).toBe(65);
  });

  it("base limitada a 70 con localizacion 30 % produce 91 (puede superar el maximo base)", async () => {
    const split = await createSplitStartingOn(futureMonday(1));
    // 8 entregados x 10 x 1 = 80, limitado al maximo de 70.
    await updateKpiConfig(testDb, split.id, "STAR_WRITER", {
      isActive: true, baseMax: 70, multiplierN1: 1, parameters: { approvedArticlePoints: 10, negativeArticlePoints: 10, proposalPoints: 5 },
    });
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await upsertWeekLocation(testDb, split.id, week.id, { name: "Nebulosa", kpiCode: "STAR_WRITER", bonusPercent: 30 });
    const participant = await buildParticipantWithDeliveredArticles(split.id, week.id, 8);

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    const cell = results.participants.find((p) => p.splitParticipantId === participant.id)!.kpiResults.find((k) => k.kpiCode === "STAR_WRITER")!;
    expect(cell.basePointsBeforeProfession).toBe(70);
    expect(cell.capped).toBe(true);
    expect(cell.locationBonusPoints).toBe(21);
    expect(cell.finalPoints).toBe(91);
  });

  it("base 70 con profesion 20 % y localizacion 30 % sobre el mismo KPI producen 105, no 109,20", async () => {
    const split = await createSplitStartingOn(futureMonday(1));
    await updateKpiConfig(testDb, split.id, "STAR_WRITER", {
      isActive: true, baseMax: 70, multiplierN1: 1, parameters: { approvedArticlePoints: 10, negativeArticlePoints: 10, proposalPoints: 5 },
    });
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await upsertWeekLocation(testDb, split.id, week.id, { name: "Nebulosa", kpiCode: "STAR_WRITER", bonusPercent: 30 });

    const profession = await createProfession(testDb, split.id, {
      name: "Mecanico",
      kpiCodeA: "STAR_WRITER",
      kpiCodeB: "SOLUTION_HUNTER",
      availableN0: true,
      availableN1: true,
      availableN2: true,
    });
    const person = await createPerson(testDb, { fullName: "Persona Mecanico", email: undefined });
    const participant = await addParticipant(testDb, split.id, {
      personId: person.id,
      alias: "ConProfesion",
      level: "N1",
      startWeekSequenceNumber: 1,
      professionId: profession.id,
    });
    await activateSplit(testDb, split.id);
    await saveWriterEntries(
      testDb,
      split.id,
      week.id,
      form({
        [`deliveredArticles__${participant.id}`]: "8",
        [`undeliveredArticles__${participant.id}`]: "0",
        [`proposedArticles__${participant.id}`]: "0",
      }),
    );

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    const cell = results.participants.find((p) => p.splitParticipantId === participant.id)!.kpiResults.find((k) => k.kpiCode === "STAR_WRITER")!;
    expect(cell.basePointsBeforeProfession).toBe(70);
    expect(cell.professionBonusPoints).toBe(14);
    expect(cell.locationBonusPoints).toBe(21);
    expect(cell.finalPoints).toBe(105);
    expect(cell.finalPoints).not.toBeCloseTo(109.2);
  });

  it("localizacion en un KPI y profesion en otro aplican de forma independiente", async () => {
    const split = await createSplitStartingOn(futureMonday(1));
    await updateKpiConfig(testDb, split.id, "STAR_WRITER", {
      isActive: true, baseMax: 70, multiplierN1: 1, parameters: { approvedArticlePoints: 10, negativeArticlePoints: 10, proposalPoints: 5 },
    });
    await activateSolutionHunter(split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    // La localizacion potencia STAR_WRITER; la profesion (creada mas abajo) potencia SOLUTION_HUNTER.
    await upsertWeekLocation(testDb, split.id, week.id, { name: "Nebulosa", kpiCode: "STAR_WRITER", bonusPercent: 50 });

    const profession = await createProfession(testDb, split.id, {
      name: "Explorador",
      kpiCodeA: "SOLUTION_HUNTER",
      kpiCodeB: "DATA_EXPLORER",
      availableN0: true,
      availableN1: true,
      availableN2: true,
    });
    const person = await createPerson(testDb, { fullName: "Persona Combinada", email: undefined });
    const participant = await addParticipant(testDb, split.id, {
      personId: person.id,
      alias: "Combinada",
      level: "N1",
      startWeekSequenceNumber: 1,
      professionId: profession.id,
    });
    // Otra persona del split, presente en el archivo de Productividad para que la carga se pueda
    // confirmar (exige al menos un participante encontrado); "Combinada" se deja fuera a proposito.
    const decoyPerson = await createPerson(testDb, { fullName: "Persona Decoy", email: undefined });
    await addParticipant(testDb, split.id, { personId: decoyPerson.id, alias: "Decoy", level: "N1", startWeekSequenceNumber: 1 });
    await activateSplit(testDb, split.id);
    await saveWriterEntries(
      testDb,
      split.id,
      week.id,
      form({
        [`deliveredArticles__${participant.id}`]: "8",
        [`undeliveredArticles__${participant.id}`]: "0",
        [`proposedArticles__${participant.id}`]: "0",
      }),
    );
    // Productividad confirmada pero sin fila para "Combinada": SOLUTION_HUNTER queda VAC para
    // ella (carga confirmada, ausencia de participante, ver docs/DECISIONS.md), no "no cargado".
    const productivityBuffer = await buildWorkbookBuffer([PRODUCTIVITY_HEADERS, ["Persona Decoy", 1, 0, 0, 0, 0, 1, 0]]);
    await confirmProductivityImport(testDb, split.id, week.id, { buffer: productivityBuffer, originalFilename: "productividad.xlsx" });

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    const row = results.participants.find((p) => p.splitParticipantId === participant.id)!;
    const writerCell = row.kpiResults.find((k) => k.kpiCode === "STAR_WRITER")!;
    const hunterCell = row.kpiResults.find((k) => k.kpiCode === "SOLUTION_HUNTER")!;

    expect(writerCell.locationApplied).toBe(true);
    expect(writerCell.professionApplied).toBe(false);
    // SOLUTION_HUNTER esta VAC para esta persona: la profesion no bonifica un VAC.
    expect(hunterCell.status).toBe("VAC");
    expect(hunterCell.professionApplied).toBe(false);
  });

  it("un resultado VAC no recibe bonus de localizacion", async () => {
    const split = await createSplitStartingOn(futureMonday(1));
    await activateSolutionHunter(split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await upsertWeekLocation(testDb, split.id, week.id, { name: "Nebulosa", kpiCode: "SOLUTION_HUNTER", bonusPercent: 50 });

    const person = await createPerson(testDb, { fullName: "Persona VAC", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Vac", level: "N1", startWeekSequenceNumber: 1 });
    // Otra persona presente en el archivo para que la carga se pueda confirmar; "Persona VAC" se deja fuera a proposito.
    const decoyPerson = await createPerson(testDb, { fullName: "Persona Decoy", email: undefined });
    await addParticipant(testDb, split.id, { personId: decoyPerson.id, alias: "Decoy", level: "N1", startWeekSequenceNumber: 1 });
    await activateSplit(testDb, split.id);
    const buffer = await buildWorkbookBuffer([PRODUCTIVITY_HEADERS, ["Persona Decoy", 1, 0, 0, 0, 0, 1, 0]]);
    await confirmProductivityImport(testDb, split.id, week.id, { buffer, originalFilename: "productividad.xlsx" });

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    const cell = results.participants.find((p) => p.splitParticipantId === participant.id)!.kpiResults.find((k) => k.kpiCode === "SOLUTION_HUNTER")!;
    expect(cell.status).toBe("VAC");
    expect(cell.locationApplied).toBe(false);
    expect(cell.locationBonusPoints).toBeNull();
  });

  it("un resultado 'No aplica' no recibe bonus de localizacion", async () => {
    const split = await createSplitStartingOn(futureMonday(1));
    // Guardian de la Estabilidad solo aplica a N2 por defecto (multiplierN0/N1 nulos).
    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", {
      isActive: true, baseMax: 30, multiplierN2: 1, parameters: { pointsPerResult: 30 },
    });
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await upsertWeekLocation(testDb, split.id, week.id, { name: "Nebulosa", kpiCode: "STABILITY_GUARDIAN", bonusPercent: 50 });

    const person = await createPerson(testDb, { fullName: "Persona N1", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "N1", level: "N1", startWeekSequenceNumber: 1 });
    await activateSplit(testDb, split.id);

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    const cell = results.participants.find((p) => p.splitParticipantId === participant.id)!.kpiResults.find((k) => k.kpiCode === "STABILITY_GUARDIAN")!;
    expect(cell.status).toBe("NOT_APPLICABLE");
    expect(cell.locationApplied).toBe(false);
  });

  it("un resultado igual a cero no recibe bonus de localizacion", async () => {
    const split = await createSplitStartingOn(futureMonday(1));
    await updateKpiConfig(testDb, split.id, "STAR_WRITER", {
      isActive: true, baseMax: 70, multiplierN1: 1, parameters: { approvedArticlePoints: 10, negativeArticlePoints: 10, proposalPoints: 5 },
    });
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await upsertWeekLocation(testDb, split.id, week.id, { name: "Nebulosa", kpiCode: "STAR_WRITER", bonusPercent: 50 });
    const person = await createPerson(testDb, { fullName: "Persona Cero", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Cero", level: "N1", startWeekSequenceNumber: 1 });
    await activateSplit(testDb, split.id);
    await saveWriterEntries(
      testDb,
      split.id,
      week.id,
      form({
        [`deliveredArticles__${participant.id}`]: "0",
        [`undeliveredArticles__${participant.id}`]: "0",
        [`proposedArticles__${participant.id}`]: "0",
      }),
    );

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    const cell = results.participants.find((p) => p.splitParticipantId === participant.id)!.kpiResults.find((k) => k.kpiCode === "STAR_WRITER")!;
    expect(cell.status).toBe("COMPUTED");
    expect(cell.finalPoints).toBe(0);
    expect(cell.locationApplied).toBe(false);
    expect(cell.locationBonusPoints).toBe(0);
  });

  it("un resultado negativo no recibe bonus de localizacion (nunca lo empeora)", async () => {
    const split = await createSplitStartingOn(futureMonday(1));
    await updateKpiConfig(testDb, split.id, "STAR_WRITER", {
      isActive: true, baseMax: 70, multiplierN1: 1, parameters: { approvedArticlePoints: 10, negativeArticlePoints: 10, proposalPoints: 5 },
    });
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await upsertWeekLocation(testDb, split.id, week.id, { name: "Nebulosa", kpiCode: "STAR_WRITER", bonusPercent: 50 });
    const person = await createPerson(testDb, { fullName: "Persona Negativa", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Negativa", level: "N1", startWeekSequenceNumber: 1 });
    await activateSplit(testDb, split.id);
    await saveWriterEntries(
      testDb,
      split.id,
      week.id,
      form({
        [`deliveredArticles__${participant.id}`]: "0",
        [`undeliveredArticles__${participant.id}`]: "5",
        [`proposedArticles__${participant.id}`]: "0",
      }),
    );

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    const cell = results.participants.find((p) => p.splitParticipantId === participant.id)!.kpiResults.find((k) => k.kpiCode === "STAR_WRITER")!;
    expect(cell.finalPoints).toBeLessThan(0);
    expect(cell.locationApplied).toBe(false);
    expect(cell.locationBonusPoints).toBe(0);
  });

  it("applicableMaxPoints no se incrementa por la localizacion", async () => {
    const split = await createSplitStartingOn(futureMonday(1));
    await updateKpiConfig(testDb, split.id, "STAR_WRITER", {
      isActive: true, baseMax: 70, multiplierN1: 1, parameters: { approvedArticlePoints: 10, negativeArticlePoints: 10, proposalPoints: 5 },
    });
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await upsertWeekLocation(testDb, split.id, week.id, { name: "Nebulosa", kpiCode: "STAR_WRITER", bonusPercent: 50 });
    const participant = await buildParticipantWithDeliveredArticles(split.id, week.id, 8);

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    const row = results.participants.find((p) => p.splitParticipantId === participant.id)!;
    expect(row.applicableMaxPoints).toBe(70);
    expect(row.totalKpiPoints).toBeGreaterThan(70);
  });
});

describe("Publicacion e historico", () => {
  async function buildReadySplitWithLocation() {
    const split = await createSplitStartingOn(futureMonday(1));
    await updateKpiConfig(testDb, split.id, "STAR_WRITER", {
      isActive: true, baseMax: 70, multiplierN1: 1, parameters: { approvedArticlePoints: 10, negativeArticlePoints: 10, proposalPoints: 5 },
    });
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await upsertWeekLocation(testDb, split.id, week.id, { name: "Nebulosa de Andromeda", kpiCode: "STAR_WRITER", bonusPercent: 30 });

    const person = await createPerson(testDb, { fullName: "Persona Publicacion", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Publicacion", level: "N1", startWeekSequenceNumber: 1 });
    await activateSplit(testDb, split.id);
    await saveWriterEntries(
      testDb,
      split.id,
      week.id,
      form({
        [`deliveredArticles__${participant.id}`]: "8",
        [`undeliveredArticles__${participant.id}`]: "0",
        [`proposedArticles__${participant.id}`]: "0",
      }),
    );
    return { split, week, person, participant };
  }

  it("congela nombre, KPI y porcentaje de la localizacion, y el desglose por KPI", async () => {
    const { split, week, person } = await buildReadySplitWithLocation();
    await publishWeek(testDb, split.id, week.id, null);

    const publication = await testDb.weekPublication.findUnique({ where: { splitWeekId: week.id }, include: { participantResults: { include: { kpiResults: true } } } });
    expect(publication).toMatchObject({
      locationNameSnapshot: "Nebulosa de Andromeda",
      locationKpiCodeSnapshot: "STAR_WRITER",
      locationBonusPercentSnapshot: 30,
    });
    const kpiResult = publication!.participantResults[0]!.kpiResults.find((k) => k.kpiCode === "STAR_WRITER")!;
    expect(kpiResult.locationApplied).toBe(true);
    expect(kpiResult.locationBonusPoints?.toNumber()).toBe(21);

    const detail = await getPersonSplitDetail(testDb, person.id, split.id);
    expect(detail!.weeks[0]!.location).toMatchObject({ name: "Nebulosa de Andromeda", kpiName: "Redactor estrella", bonusPercent: 30 });
  });

  it("una semana sin localizacion se publica normalmente, sin campos de localizacion", async () => {
    const split = await createSplitStartingOn(futureMonday(1));
    const person = await createPerson(testDb, { fullName: "Persona Sin Localizacion", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "SinLocalizacion", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "STAR_WRITER", {
      isActive: true, baseMax: 70, multiplierN1: 1, parameters: { approvedArticlePoints: 10, negativeArticlePoints: 10, proposalPoints: 5 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveWriterEntries(
      testDb,
      split.id,
      week.id,
      form({ [`deliveredArticles__${participant.id}`]: "1", [`undeliveredArticles__${participant.id}`]: "0", [`proposedArticles__${participant.id}`]: "0" }),
    );

    await publishWeek(testDb, split.id, week.id, null);
    const publication = await testDb.weekPublication.findUnique({ where: { splitWeekId: week.id } });
    expect(publication!.locationNameSnapshot).toBeNull();
    expect(publication!.locationBonusPercentSnapshot).toBeNull();
  });

  it("una publicacion anterior a 0.8.5 (sin campos de localizacion) sigue siendo legible", async () => {
    // Simula una publicacion antigua actualizando directamente sus campos a null, como quedarian con la migracion.
    const { split, week, person } = await buildReadySplitWithLocation();
    await publishWeek(testDb, split.id, week.id, null);
    await testDb.weekPublication.update({
      where: { splitWeekId: week.id },
      data: { locationNameSnapshot: null, locationKpiCodeSnapshot: null, locationBonusPercentSnapshot: null, locationId: null },
    });
    await testDb.publishedKpiResult.updateMany({
      where: { participantWeeklyResult: { publication: { splitWeekId: week.id } } },
      data: { locationBonusPoints: null, locationApplied: false },
    });

    const detail = await getPersonSplitDetail(testDb, person.id, split.id);
    expect(detail!.weeks[0]!.location).toBeNull();
    expect(detail!.weeks[0]!.kpiCells.find((cell) => cell.kpiCode === "STAR_WRITER")!.locationBonusPoints).toBeNull();
  });

  it("el historico suma unicamente los locationBonusPoints publicados", async () => {
    const { split, week, person } = await buildReadySplitWithLocation();
    await publishWeek(testDb, split.id, week.id, null);

    const history = await getPersonHistory(testDb, person.id, { year: "todos", splitId: "todos", grouping: "semana" });
    expect(history.groups).toHaveLength(1);
    expect(history.groups[0]!.locationBonusSum).toBe(21);
    const kpiBreakdown = history.groups[0]!.perKpi.find((entry) => entry.kpiCode === "STAR_WRITER")!;
    expect(kpiBreakdown.locationBonusSum).toBe(21);
    void split;
  });
});

describe("Fichas y autorizacion", () => {
  it("un participante aplicable ve la localizacion activa de la semana actual de su split activo", async () => {
    const split = await createSplitStartingOn(mondayOfCurrentWeek(), 2);
    await activateSolutionHunter(split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await testDb.splitWeekLocation.create({ data: { splitWeekId: week.id, name: "Nebulosa", kpiCode: "SOLUTION_HUNTER", bonusPercent: 30 } });

    const person = await createPerson(testDb, { fullName: "Persona Ficha", email: undefined });
    await addParticipant(testDb, split.id, { personId: person.id, alias: "Ficha", level: "N1", startWeekSequenceNumber: 1 });
    await activateSplit(testDb, split.id);

    const cards = await listProfileCardsForPerson(testDb, person.id);
    const card = cards.find((entry) => entry.splitId === split.id)!;
    expect(card.activeLocation).toMatchObject({ name: "Nebulosa", kpiName: "Cazador de soluciones", bonusPercent: 30 });
  });

  it("no ve como activa la localizacion de una semana futura", async () => {
    const split = await createSplitStartingOn(mondayOfCurrentWeek(), 2);
    await activateSolutionHunter(split.id);
    const [, week2] = await listSplitWeeks(testDb, split.id);
    await testDb.splitWeekLocation.create({ data: { splitWeekId: week2!.id, name: "Futura", kpiCode: "SOLUTION_HUNTER", bonusPercent: 30 } });

    const person = await createPerson(testDb, { fullName: "Persona Sin Activa", email: undefined });
    await addParticipant(testDb, split.id, { personId: person.id, alias: "SinActiva", level: "N1", startWeekSequenceNumber: 1 });
    await activateSplit(testDb, split.id);

    const cards = await listProfileCardsForPerson(testDb, person.id);
    expect(cards.find((entry) => entry.splitId === split.id)!.activeLocation).toBeNull();
  });

  it("un participante todavia no incorporado esa semana no la recibe como bonus activo", async () => {
    const split = await createSplitStartingOn(mondayOfCurrentWeek(), 2);
    await activateSolutionHunter(split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await testDb.splitWeekLocation.create({ data: { splitWeekId: week.id, name: "Nebulosa", kpiCode: "SOLUTION_HUNTER", bonusPercent: 30 } });

    const founder = await createPerson(testDb, { fullName: "Fundador", email: undefined });
    await addParticipant(testDb, split.id, { personId: founder.id, alias: "Fundador", level: "N1", startWeekSequenceNumber: 1 });
    await activateSplit(testDb, split.id);

    const latecomer = await createPerson(testDb, { fullName: "Incorporacion Tardia", email: undefined });
    await addParticipant(testDb, split.id, { personId: latecomer.id, alias: "Tardio", level: "N1", startWeekSequenceNumber: 2 });

    const cards = await listProfileCardsForPerson(testDb, latecomer.id);
    expect(cards.find((entry) => entry.splitId === split.id)!.activeLocation).toBeNull();
  });

  it("no ve una localizacion de otro split, aunque participe en ambos", async () => {
    const splitWithLocation = await createSplitStartingOn(mondayOfCurrentWeek(), 1);
    await activateSolutionHunter(splitWithLocation.id);
    const weekOfOther = (await listSplitWeeks(testDb, splitWithLocation.id))[0]!;
    await testDb.splitWeekLocation.create({ data: { splitWeekId: weekOfOther.id, name: "Ajena", kpiCode: "SOLUTION_HUNTER", bonusPercent: 30 } });

    const splitWithoutLocation = await createSplitStartingOn(mondayOfCurrentWeek(), 1);
    await activateSolutionHunter(splitWithoutLocation.id);

    const person = await createPerson(testDb, { fullName: "Persona Dos Splits", email: undefined });
    await addParticipant(testDb, splitWithLocation.id, { personId: person.id, alias: "EnLaAjena", level: "N1", startWeekSequenceNumber: 1 });
    await addParticipant(testDb, splitWithoutLocation.id, { personId: person.id, alias: "SinLocalizacion", level: "N1", startWeekSequenceNumber: 1 });
    await activateSplit(testDb, splitWithLocation.id);
    await activateSplit(testDb, splitWithoutLocation.id);

    const cards = await listProfileCardsForPerson(testDb, person.id);
    // Ve la localizacion de su propio split...
    expect(cards.find((entry) => entry.splitId === splitWithLocation.id)!.activeLocation).toMatchObject({ name: "Ajena" });
    // ...pero nunca la del otro split, en el que tambien participa.
    expect(cards.find((entry) => entry.splitId === splitWithoutLocation.id)!.activeLocation).toBeNull();
  });
});
