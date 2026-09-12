import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { createSplitWithWeeks, activateSplit, listSplitWeeks } from "@/server/services/split.service";
import { createPerson } from "@/server/services/person.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig, updateAllKpiConfigs } from "@/server/services/kpi.service";
import { saveStabilityEntries } from "@/server/services/stability-entry.service";
import { publishWeek } from "@/server/services/publish-week.service";
import { upsertWeekLocation } from "@/server/services/location.service";
import { parseAllKpiConfigsFromFormData } from "@/server/validation/kpi";
import { KPI_CATALOG_LIST, TOTAL_KPI_COUNT } from "@/domain/kpis/catalog";
import { currentCalendarDate, addCalendarDays, isoWeekday, formatCalendarDate } from "@/lib/dates";
import { DomainError } from "@/lib/errors";

/**
 * Guardado conjunto "Guardar todos los KPI" (`1.0.1`, parte H del encargo).
 * `parseAllKpiConfigsFromFormData` es una funcion pura de validacion (sin
 * base de datos ni sesion), probada directamente; `updateAllKpiConfigs` es
 * el servicio transaccional, probado igual que `updateKpiConfig` en
 * `tests/kpi.test.ts` y `tests/split-configuration-lock.test.ts`.
 */
function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

/** Construye una FormData con las diez entradas prefijadas `${kpiCode}__`, con los valores predeterminados del catalogo. */
function buildValidBulkFormValues(overrides: Record<string, string> = {}): Record<string, string> {
  const values: Record<string, string> = {};
  for (const entry of KPI_CATALOG_LIST) {
    const prefix = `${entry.code}__`;
    values[`${prefix}isActive`] = "on";
    values[`${prefix}baseMax`] = String(entry.defaultBaseMax);
    for (const level of ["N0", "N1", "N2"] as const) {
      const value = entry.defaultMultipliers[level];
      values[`${prefix}multiplier${level}`] = value === null ? "" : String(value);
    }
    for (const parameter of entry.parameters) {
      values[`${prefix}${parameter.key}`] = String(entry.defaultParameters[parameter.key]);
    }
  }
  return { ...values, ...overrides };
}

function futureMonday(weeksAhead: number): Date {
  const today = currentCalendarDate();
  const monday = addCalendarDays(today, -(isoWeekday(today) - 1));
  return addCalendarDays(monday, weeksAhead * 7);
}

async function createDraftSplit() {
  return createSplitWithWeeks(testDb, {
    name: "Split KPI conjunto",
    description: undefined,
    startDate: formatCalendarDate(futureMonday(0)),
    numberOfWeeks: 4,
  });
}

beforeEach(async () => {
  await resetDatabase();
});

describe("parseAllKpiConfigsFromFormData (funcion pura)", () => {
  it("con los diez KPI validos, devuelve las diez actualizaciones", () => {
    const result = parseAllKpiConfigsFromFormData(form(buildValidBulkFormValues()));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.updates).toHaveLength(TOTAL_KPI_COUNT);
    }
  });

  it("si un solo KPI es invalido, no devuelve ninguna actualizacion y el error va atado a su KPI y campo", () => {
    const values = buildValidBulkFormValues({ SOLUTION_HUNTER__baseMax: "no-es-un-numero" });
    const result = parseAllKpiConfigsFromFormData(form(values));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors["SOLUTION_HUNTER.baseMax"]).toBeTruthy();
      // Ningun otro KPI (valido) aparece como error: el fallo esta acotado al suyo.
      expect(Object.keys(result.fieldErrors).some((key) => key.startsWith("DATA_EXPLORER."))).toBe(false);
    }
  });

  it("un multiplicador vacio se mantiene como null (nivel no aplicable), nunca como error", () => {
    const values = buildValidBulkFormValues({ STABILITY_GUARDIAN__multiplierN0: "", STABILITY_GUARDIAN__multiplierN1: "" });
    const result = parseAllKpiConfigsFromFormData(form(values));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const stability = result.updates.find((update) => update.kpiCode === "STABILITY_GUARDIAN")!;
      expect(stability.input.multiplierN0).toBeUndefined();
      expect(stability.input.multiplierN1).toBeUndefined();
    }
  });
});

describe("updateAllKpiConfigs (servicio transaccional)", () => {
  it("guarda los diez KPI validos en una sola llamada", async () => {
    const split = await createDraftSplit();
    const result = parseAllKpiConfigsFromFormData(form(buildValidBulkFormValues()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await updateAllKpiConfigs(testDb, split.id, result.updates);

    const configs = await testDb.splitKpiConfig.findMany({ where: { splitId: split.id } });
    expect(configs.every((config) => config.isActive)).toBe(true);
  });

  it("si una entrada viola una regla de negocio, no persiste ninguna del lote (todo o nada)", async () => {
    const split = await createDraftSplit();
    await updateKpiConfig(testDb, split.id, "SOLUTION_HUNTER", {
      isActive: true,
      baseMax: 70,
      multiplierN0: 1,
      parameters: { pointsPerResolvedTicket: 1 },
    });
    // La ventana de una localizacion solo es editable antes de su startDate: se usa una semana futura del split.
    const futureWeek = (await listSplitWeeks(testDb, split.id))[1]!;
    await upsertWeekLocation(testDb, split.id, futureWeek.id, { name: "Base secreta", kpiCode: "SOLUTION_HUNTER", bonusPercent: 20 });

    const values = buildValidBulkFormValues({
      // Intenta desactivar SOLUTION_HUNTER (usado por la localizacion futura) junto al resto de KPI validos.
      SOLUTION_HUNTER__isActive: "off",
      DATA_EXPLORER__baseMax: "999",
    });
    const parsed = parseAllKpiConfigsFromFormData(form(values));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    await expect(updateAllKpiConfigs(testDb, split.id, parsed.updates)).rejects.toBeInstanceOf(DomainError);

    // DATA_EXPLORER tampoco se guardo: el rechazo de una entrada revierte todo el lote.
    const dataExplorer = await testDb.splitKpiConfig.findUniqueOrThrow({
      where: { splitId_kpiCode: { splitId: split.id, kpiCode: "DATA_EXPLORER" } },
    });
    expect(dataExplorer.baseMax.toNumber()).not.toBe(999);
  });

  it("el guardado conjunto tambien queda bloqueado tras la primera publicacion del split", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Conjunto", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Conjunto", level: "N2", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 30, multiplierN2: 1, parameters: { pointsPerResult: 30 } });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "1" }));
    await publishWeek(testDb, split.id, week.id, null);

    const parsed = parseAllKpiConfigsFromFormData(form(buildValidBulkFormValues()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await expect(updateAllKpiConfigs(testDb, split.id, parsed.updates)).rejects.toBeInstanceOf(DomainError);
  });

  it("el guardado conjunto se rechaza en un split cerrado", async () => {
    const split = await createDraftSplit();
    await testDb.split.update({ where: { id: split.id }, data: { status: "CLOSED" } });

    const parsed = parseAllKpiConfigsFromFormData(form(buildValidBulkFormValues()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await expect(updateAllKpiConfigs(testDb, split.id, parsed.updates)).rejects.toBeInstanceOf(DomainError);
  });
});
