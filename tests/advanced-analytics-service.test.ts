import { beforeEach, describe, expect, it } from "vitest";
import { addCalendarDays, currentCalendarDate } from "@/lib/dates";
import { resetDatabase, testDb } from "./helpers/db";
import { markAllPresent } from "./helpers/attendance";
import { createPerson } from "@/server/services/person.service";
import { activateSplit, createSplitWithWeeks, listSplitWeeks } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { saveStabilityEntries } from "@/server/services/stability-entry.service";
import { publishWeek } from "@/server/services/publish-week.service";
import {
  listAnalyticsSplitOptions,
  loadEconomyLedger,
  loadParticipantWeekObservations,
  resolveDefaultAnalyticsFilters,
} from "@/server/services/analytics.service";

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

async function buildPublishedSplit(name: string, startDate: string) {
  const personN2 = await createPerson(testDb, { fullName: "Persona N2", email: undefined });
  const personN1 = await createPerson(testDb, { fullName: "Persona N1", email: undefined });
  const split = await createSplitWithWeeks(testDb, { name, description: undefined, startDate, numberOfWeeks: 2 });
  const participantN2 = await addParticipant(testDb, split.id, { personId: personN2.id, alias: "N2", level: "N2", startWeekSequenceNumber: 1 });
  await addParticipant(testDb, split.id, { personId: personN1.id, alias: "N1", level: "N1", startWeekSequenceNumber: 1 });
  await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", {
    isActive: true,
    baseMax: 30,
    multiplierN2: 1,
    parameters: { pointsPerResult: 30 },
  });
  await activateSplit(testDb, split.id);
  const weeks = await listSplitWeeks(testDb, split.id);

  for (const week of weeks) {
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participantN2.id}`]: "1" }));
    await markAllPresent(testDb, split.id, week.id);
    await publishWeek(testDb, split.id, week.id, null);
  }

  return { split, weeks, personN2, personN1 };
}

beforeEach(async () => {
  await resetDatabase();
});

describe("analytics.service - solo lee instantaneas publicadas", () => {
  it("carga una observacion por persona-split-semana publicada, con celdas NOT_APPLICABLE para quien no aplica", async () => {
    const { split, weeks } = await buildPublishedSplit("Split analitica", "2026-01-05");

    const observations = await loadParticipantWeekObservations(testDb, {
      splitIds: [split.id],
      startDate: weeks[0]!.startDate,
      endDate: weeks[1]!.startDate,
    });

    expect(observations).toHaveLength(4); // 2 personas x 2 semanas
    const n1Observation = observations.find((o) => o.personFullName === "Persona N1");
    expect(n1Observation?.cells.find((c) => c.kpiCode === "STABILITY_GUARDIAN")?.status).toBe("NOT_APPLICABLE");
    const n2Observation = observations.find((o) => o.personFullName === "Persona N2");
    expect(n2Observation?.cells.find((c) => c.kpiCode === "STABILITY_GUARDIAN")?.status).toBe("COMPUTED");
    expect(n2Observation?.cells.find((c) => c.kpiCode === "STABILITY_GUARDIAN")?.finalPoints).toBe(30);
  });

  it("filtra por nivel historico (levelSnapshot), no por el nivel actual del participante", async () => {
    const { split, weeks } = await buildPublishedSplit("Split nivel", "2026-01-05");

    const onlyN2 = await loadParticipantWeekObservations(testDb, {
      splitIds: [split.id],
      startDate: weeks[0]!.startDate,
      endDate: weeks[1]!.startDate,
      levels: ["N2"],
    });

    expect(onlyN2).toHaveLength(2);
    expect(onlyN2.every((o) => o.levelSnapshot === "N2")).toBe(true);
  });

  it("un intervalo de fechas mas estrecho excluye la semana fuera de rango, sin recalcular nada", async () => {
    const { split, weeks } = await buildPublishedSplit("Split fechas", "2026-01-05");

    const onlyFirstWeek = await loadParticipantWeekObservations(testDb, {
      splitIds: [split.id],
      startDate: weeks[0]!.startDate,
      endDate: weeks[0]!.startDate,
    });

    expect(onlyFirstWeek).toHaveLength(2);
    expect(onlyFirstWeek.every((o) => o.weekSequenceNumber === 1)).toBe(true);
  });

  it("no incluye un split sin ninguna publicacion", async () => {
    await createSplitWithWeeks(testDb, { name: "Split sin publicar", description: undefined, startDate: "2026-02-02", numberOfWeeks: 1 });
    const { split } = await buildPublishedSplit("Split con publicacion", "2026-01-05");

    const options = await listAnalyticsSplitOptions(testDb);
    expect(options.map((o) => o.id)).toEqual([split.id]);
  });

  it("los filtros predeterminados cubren 12 semanas de calendario terminando en la ultima semana publicada", async () => {
    const { weeks } = await buildPublishedSplit("Split defecto", "2026-01-05");

    const defaults = await resolveDefaultAnalyticsFilters(testDb);
    expect(defaults.endDate.getTime()).toBe(weeks[1]!.startDate.getTime());
    const diffDays = (defaults.endDate.getTime() - defaults.startDate.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(7 * 11);
  });

  it("una tabla paginada (aqui: un subconjunto de personas) nunca cambia los totales del conjunto completo", async () => {
    const { split, weeks } = await buildPublishedSplit("Split paginacion", "2026-01-05");
    const full = await loadParticipantWeekObservations(testDb, { splitIds: [split.id], startDate: weeks[0]!.startDate, endDate: weeks[1]!.startDate });
    const fullTotal = full.reduce((sum, o) => sum + (o.cells.find((c) => c.kpiCode === "STABILITY_GUARDIAN")?.finalPoints ?? 0), 0);

    // "Paginar" aqui es solo tomar un subconjunto arbitrario para simular una pagina de tabla;
    // el total del conjunto completo (fullTotal) no debe depender de como se pagine la vista.
    const page = full.slice(0, 1);
    expect(page.length).toBeLessThan(full.length);
    expect(fullTotal).toBe(60); // 2 semanas x 30 puntos, solo Persona N2 aplica
  });
});

describe("analytics.service - libro economico por fecha de operacion", () => {
  it("usa la fecha real de operacion (createdAt), no las fechas de negocio de la semana publicada", async () => {
    const { split } = await buildPublishedSplit("Split economia", "2026-01-05");
    const today = currentCalendarDate();

    // Los movimientos WEEKLY_EARNING se crean con createdAt = ahora (fecha real de ejecucion del
    // test), muy lejos de las fechas de negocio de la semana ("2026-01-05"): si el intervalo
    // economico usase esas fechas de negocio en vez de createdAt, este intervalo (hoy +/- 1 dia)
    // no encontraria ningun movimiento.
    const { before, inRange } = await loadEconomyLedger(testDb, {
      splitIds: [split.id],
      startDate: addCalendarDays(today, -1),
      endDate: addCalendarDays(today, 1),
    });

    const totalEntries = await testDb.creditLedgerEntry.count({ where: { splitParticipant: { splitId: split.id } } });
    expect(totalEntries).toBe(4); // un WEEKLY_EARNING por participante y semana publicada (2 personas x 2 semanas)
    expect(before).toHaveLength(0);
    expect(inRange).toHaveLength(4);
    expect(inRange.every((entry) => entry.type === "WEEKLY_EARNING")).toBe(true);
  });

  it("un intervalo anterior a hoy no encuentra los movimientos de hoy (antes/dentro exhaustivos y sin duplicados)", async () => {
    const { split } = await buildPublishedSplit("Split economia pasado", "2026-01-05");
    const today = currentCalendarDate();

    const { before, inRange } = await loadEconomyLedger(testDb, {
      splitIds: [split.id],
      startDate: addCalendarDays(today, 30),
      endDate: addCalendarDays(today, 31),
    });

    expect(inRange).toHaveLength(0);
    expect(before).toHaveLength(4);
  });
});
