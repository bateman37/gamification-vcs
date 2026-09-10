import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { createPerson } from "@/server/services/person.service";
import { createSplitWithWeeks, activateSplit } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import {
  countActiveKpiConfigs,
  listKpiConfigsForSplit,
  updateKpiConfig,
} from "@/server/services/kpi.service";
import { buildKpiConfigSchema } from "@/server/validation/kpi";
import { KPI_CATALOG, KPI_CATALOG_LIST, KPI_CODES, TOTAL_KPI_COUNT } from "@/domain/kpis/catalog";
import { DomainError } from "@/lib/errors";

async function createDraftSplit(name = "Split de prueba") {
  return createSplitWithWeeks(testDb, {
    name,
    description: undefined,
    startDate: "2025-10-06",
    numberOfWeeks: 4,
  });
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Catalogo de KPI", () => {
  it("contiene exactamente diez codigos unicos", () => {
    expect(KPI_CODES).toHaveLength(10);
    expect(new Set(KPI_CODES).size).toBe(10);
    expect(TOTAL_KPI_COUNT).toBe(10);
  });

  it("tiene los valores predeterminados de Split 8 para Cazador de soluciones", () => {
    const entry = KPI_CATALOG.SOLUTION_HUNTER;
    expect(entry.name).toBe("Cazador de soluciones");
    expect(entry.defaultBaseMax).toBe(70);
    expect(entry.defaultMultipliers).toEqual({ N0: 2.5, N1: 1, N2: 1.85 });
    expect(entry.defaultParameters).toEqual({ pointsPerResolvedTicket: 1 });
  });

  it("Guardian de la Estabilidad solo aplica a N2 por defecto", () => {
    const entry = KPI_CATALOG.STABILITY_GUARDIAN;
    expect(entry.defaultMultipliers).toEqual({ N0: null, N1: null, N2: 1 });
  });
});

describe("Creacion de configuraciones al crear un split", () => {
  it("crea diez configuraciones inactivas con los valores de Split 8", async () => {
    const split = await createSplitWithWeeks(testDb, {
      name: "Split nuevo",
      description: undefined,
      startDate: "2025-10-06",
      numberOfWeeks: 2,
    });

    const configs = await listKpiConfigsForSplit(testDb, split.id);
    expect(configs).toHaveLength(10);
    expect(configs.every((config) => config.isActive === false)).toBe(true);
    expect(configs.map((config) => config.kpiCode)).toEqual(KPI_CATALOG_LIST.map((entry) => entry.code));

    const solutionHunter = configs.find((config) => config.kpiCode === "SOLUTION_HUNTER");
    expect(solutionHunter?.baseMax.toNumber()).toBe(70);
    expect(solutionHunter?.multiplierN0?.toNumber()).toBe(2.5);
  });
});

describe("Aislamiento de configuracion entre splits", () => {
  it("dos splits conservan configuraciones distintas del mismo KPI", async () => {
    const splitA = await createDraftSplit("Split A");
    const splitB = await createDraftSplit("Split B");

    await updateKpiConfig(testDb, splitA.id, "SOLUTION_HUNTER", {
      isActive: true,
      baseMax: 90,
      multiplierN0: 3,
      multiplierN1: 1,
      multiplierN2: 2,
      parameters: { pointsPerResolvedTicket: 2 },
    });

    const configsA = await listKpiConfigsForSplit(testDb, splitA.id);
    const configsB = await listKpiConfigsForSplit(testDb, splitB.id);
    const kpiA = configsA.find((c) => c.kpiCode === "SOLUTION_HUNTER");
    const kpiB = configsB.find((c) => c.kpiCode === "SOLUTION_HUNTER");

    expect(kpiA?.baseMax.toNumber()).toBe(90);
    expect(kpiA?.isActive).toBe(true);
    expect(kpiB?.baseMax.toNumber()).toBe(70);
    expect(kpiB?.isActive).toBe(false);
  });
});

describe("Desactivar y reactivar un KPI", () => {
  it("conserva los parametros anteriores", async () => {
    const split = await createDraftSplit();

    await updateKpiConfig(testDb, split.id, "DATA_EXPLORER", {
      isActive: true,
      baseMax: 80,
      multiplierN0: 1,
      multiplierN1: 1,
      multiplierN2: 1,
      parameters: { pointsPerCommentedTicket: 3 },
    });

    await updateKpiConfig(testDb, split.id, "DATA_EXPLORER", {
      isActive: false,
      baseMax: 80,
      multiplierN0: 1,
      multiplierN1: 1,
      multiplierN2: 1,
      parameters: { pointsPerCommentedTicket: 3 },
    });

    const reactivated = await updateKpiConfig(testDb, split.id, "DATA_EXPLORER", {
      isActive: true,
      baseMax: 80,
      multiplierN0: 1,
      multiplierN1: 1,
      multiplierN2: 1,
      parameters: { pointsPerCommentedTicket: 3 },
    });

    expect(reactivated.isActive).toBe(true);
    expect(reactivated.baseMax.toNumber()).toBe(80);
    expect(reactivated.parameters).toEqual({ pointsPerCommentedTicket: 3 });
  });
});

describe("Validacion de parametros de KPI", () => {
  it("rechaza un maximo base menor o igual que cero", () => {
    const schema = buildKpiConfigSchema("SOLUTION_HUNTER");
    const result = schema.safeParse({
      isActive: false,
      baseMax: "0",
      multiplierN0: "",
      multiplierN1: "",
      multiplierN2: "",
      parameters: { pointsPerResolvedTicket: "1" },
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un multiplicador negativo", () => {
    const schema = buildKpiConfigSchema("SOLUTION_HUNTER");
    const result = schema.safeParse({
      isActive: false,
      baseMax: "70",
      multiplierN0: "-1",
      multiplierN1: "",
      multiplierN2: "",
      parameters: { pointsPerResolvedTicket: "1" },
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un parametro propio no positivo o no numerico", () => {
    const schema = buildKpiConfigSchema("SOLUTION_HUNTER");
    const result = schema.safeParse({
      isActive: false,
      baseMax: "70",
      multiplierN0: "",
      multiplierN1: "",
      multiplierN2: "",
      parameters: { pointsPerResolvedTicket: "abc" },
    });
    expect(result.success).toBe(false);
  });

  it("rechaza propiedades desconocidas dentro de parameters", () => {
    const schema = buildKpiConfigSchema("SOLUTION_HUNTER");
    const result = schema.safeParse({
      isActive: false,
      baseMax: "70",
      multiplierN0: "",
      multiplierN1: "",
      multiplierN2: "",
      parameters: { pointsPerResolvedTicket: "1", formulaLibre: "1" },
    });
    expect(result.success).toBe(false);
  });

  it("un multiplicador vacio se interpreta como no aplicable, no como cero", () => {
    const schema = buildKpiConfigSchema("STABILITY_GUARDIAN");
    const result = schema.parse({
      isActive: true,
      baseMax: "30",
      multiplierN0: "",
      multiplierN1: "",
      multiplierN2: "1",
      parameters: { pointsPerResult: "30" },
    });
    expect(result.multiplierN0).toBeUndefined();
    expect(result.multiplierN1).toBeUndefined();
    expect(result.multiplierN2).toBe(1);
  });

  it("rechaza activar un KPI sin ningun multiplicador informado", () => {
    const schema = buildKpiConfigSchema("SOLUTION_HUNTER");
    const result = schema.safeParse({
      isActive: true,
      baseMax: "70",
      multiplierN0: "",
      multiplierN1: "",
      multiplierN2: "",
      parameters: { pointsPerResolvedTicket: "1" },
    });
    expect(result.success).toBe(false);
  });

  it("acepta coma decimal en la entrada y la normaliza", () => {
    const schema = buildKpiConfigSchema("ENTHUSIASTIC_STUDENT");
    const result = schema.parse({
      isActive: false,
      baseMax: "50",
      multiplierN0: "1",
      multiplierN1: "1",
      multiplierN2: "1",
      parameters: { pointsPerHour: "12,5" },
    });
    expect(result.parameters).toEqual({ pointsPerHour: 12.5 });
  });
});

describe("Activacion de split segun participantes y KPI activos", () => {
  it("no permite activar un split sin participantes aunque tenga un KPI activo", async () => {
    const split = await createDraftSplit();
    await updateKpiConfig(testDb, split.id, "SOLUTION_HUNTER", {
      isActive: true,
      baseMax: 70,
      multiplierN0: 2.5,
      multiplierN1: 1,
      multiplierN2: 1.85,
      parameters: { pointsPerResolvedTicket: 1 },
    });

    await expect(activateSplit(testDb, split.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("no permite activar un split con participante pero sin ningun KPI activo", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Sin KPI", email: undefined });
    await addParticipant(testDb, split.id, {
      personId: person.id,
      alias: "SinKpi",
      level: "N0",
      startWeekSequenceNumber: 1,
    });

    await expect(activateSplit(testDb, split.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("activa un split con participante y al menos un KPI activo", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Con KPI", email: undefined });
    await addParticipant(testDb, split.id, {
      personId: person.id,
      alias: "ConKpi",
      level: "N0",
      startWeekSequenceNumber: 1,
    });
    await updateKpiConfig(testDb, split.id, "SOLUTION_HUNTER", {
      isActive: true,
      baseMax: 70,
      multiplierN0: 2.5,
      multiplierN1: 1,
      multiplierN2: 1.85,
      parameters: { pointsPerResolvedTicket: 1 },
    });

    const activated = await activateSplit(testDb, split.id);
    expect(activated.status).toBe("ACTIVE");
    expect(await countActiveKpiConfigs(testDb, split.id)).toBe(1);
  });
});

describe("Edicion de KPI segun el estado del split", () => {
  it("permite configurar KPI en un split activo", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Activa", email: undefined });
    await addParticipant(testDb, split.id, {
      personId: person.id,
      alias: "Activo",
      level: "N0",
      startWeekSequenceNumber: 1,
    });
    await updateKpiConfig(testDb, split.id, "SOLUTION_HUNTER", {
      isActive: true,
      baseMax: 70,
      multiplierN0: 2.5,
      multiplierN1: 1,
      multiplierN2: 1.85,
      parameters: { pointsPerResolvedTicket: 1 },
    });
    await activateSplit(testDb, split.id);

    const updated = await updateKpiConfig(testDb, split.id, "DATA_EXPLORER", {
      isActive: true,
      baseMax: 75,
      multiplierN0: 1,
      multiplierN1: 1,
      multiplierN2: 1,
      parameters: { pointsPerCommentedTicket: 2 },
    });
    expect(updated.isActive).toBe(true);
    expect(updated.baseMax.toNumber()).toBe(75);
  });

  it("rechaza editar KPI en un split cerrado", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Cerrada", email: undefined });
    await addParticipant(testDb, split.id, {
      personId: person.id,
      alias: "Cerrado",
      level: "N0",
      startWeekSequenceNumber: 1,
    });
    await updateKpiConfig(testDb, split.id, "SOLUTION_HUNTER", {
      isActive: true,
      baseMax: 70,
      multiplierN0: 2.5,
      multiplierN1: 1,
      multiplierN2: 1.85,
      parameters: { pointsPerResolvedTicket: 1 },
    });
    await activateSplit(testDb, split.id);
    await testDb.split.update({ where: { id: split.id }, data: { status: "CLOSED" } });

    await expect(
      updateKpiConfig(testDb, split.id, "DATA_EXPLORER", {
        isActive: true,
        baseMax: 75,
        multiplierN0: 1,
        multiplierN1: 1,
        multiplierN2: 1,
        parameters: { pointsPerCommentedTicket: 2 },
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
