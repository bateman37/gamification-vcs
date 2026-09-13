import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { createPerson } from "@/server/services/person.service";
import { createSplitWithWeeks, activateSplit } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { closeMarket, collectMarketOpenIssues, getEconomySettings, isMarketOpen, openMarket } from "@/server/services/economy.service";
import { createSlot } from "./helpers/equipment";
import { createStoreItem } from "@/server/services/store-item.service";
import { DomainError } from "@/lib/errors";

/**
 * Mercado del split (`0.9.0` / MVP-2D, parte B del encargo, secciones 54-55
 * del listado de pruebas).
 */

async function createDraftSplit(numberOfWeeks = 2) {
  return createSplitWithWeeks(testDb, {
    name: "Split de economia",
    description: undefined,
    startDate: "2025-10-06",
    numberOfWeeks,
  });
}

async function buildActiveSplitWithSlotAndItem() {
  const split = await createDraftSplit();
  const person = await createPerson(testDb, { fullName: "Persona Economia", email: undefined });
  await addParticipant(testDb, split.id, { personId: person.id, alias: "Eco", level: "N2", startWeekSequenceNumber: 1 });
  await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 70, multiplierN2: 1, parameters: { pointsPerResult: 30 } });
  await activateSplit(testDb, split.id);
  const slot = await createSlot(split.id, "ARTIFACT");
  const item = await createStoreItem(testDb, split.id, {
    name: "Cristal de datos",
    description: null,
    priceCredits: 100,
    equipmentSlotId: slot.id,
    kpiCode: "STABILITY_GUARDIAN",
    bonusPercent: 20,
  });
  return { split, person, slot, item };
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Estado inicial del mercado", () => {
  it("un split nuevo empieza con el mercado cerrado", async () => {
    const split = await createDraftSplit();
    const settings = await getEconomySettings(testDb, split.id);
    expect(settings.marketStatus).toBe("CLOSED");
    expect(await isMarketOpen(testDb, split.id)).toBe(false);
  });

  it("un split sin fila propia de SplitEconomySettings se trata igualmente como cerrado (defensivo)", async () => {
    const split = await createDraftSplit();
    await testDb.splitEconomySettings.deleteMany({ where: { splitId: split.id } });
    expect(await isMarketOpen(testDb, split.id)).toBe(false);
  });
});

describe("Requisitos para abrir el mercado", () => {
  it("no abre en un split DRAFT", async () => {
    const split = await createDraftSplit();
    await createSlot(split.id, "ARTIFACT");
    await expect(openMarket(testDb, split.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("no abre en un split CLOSED", async () => {
    const { split } = await buildActiveSplitWithSlotAndItem();
    await testDb.split.update({ where: { id: split.id }, data: { status: "CLOSED" } });
    await expect(openMarket(testDb, split.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("no abre sin ninguna ranura de equipo", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Sin Ranuras", email: undefined });
    await addParticipant(testDb, split.id, { personId: person.id, alias: "SinRanuras", level: "N2", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 70, multiplierN2: 1, parameters: { pointsPerResult: 30 } });
    await activateSplit(testDb, split.id);

    const issues = await collectMarketOpenIssues(testDb, split.id);
    expect(issues.some((issue) => issue.includes("ranura"))).toBe(true);
    await expect(openMarket(testDb, split.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("no abre sin ningun objeto disponible para comprar", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Sin Objetos", email: undefined });
    await addParticipant(testDb, split.id, { personId: person.id, alias: "SinObjetos", level: "N2", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 70, multiplierN2: 1, parameters: { pointsPerResult: 30 } });
    await activateSplit(testDb, split.id);
    await createSlot(split.id, "ARTIFACT");

    const issues = await collectMarketOpenIssues(testDb, split.id);
    expect(issues.some((issue) => issue.includes("objeto"))).toBe(true);
    await expect(openMarket(testDb, split.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("abre correctamente un split ACTIVE con al menos una ranura y un objeto valido", async () => {
    const { split } = await buildActiveSplitWithSlotAndItem();
    const settings = await openMarket(testDb, split.id);
    expect(settings.marketStatus).toBe("OPEN");
    expect(await isMarketOpen(testDb, split.id)).toBe(true);
  });
});

describe("Ciclo abierto/cerrado", () => {
  it("solo puede abrirse y cerrarse mientras el split no este cerrado, las veces que haga falta", async () => {
    const { split } = await buildActiveSplitWithSlotAndItem();
    await openMarket(testDb, split.id);
    await closeMarket(testDb, split.id);
    await openMarket(testDb, split.id);
    expect(await isMarketOpen(testDb, split.id)).toBe(true);
    await closeMarket(testDb, split.id);
    expect(await isMarketOpen(testDb, split.id)).toBe(false);
  });

  it("un split cerrado no permite ni abrir ni cerrar el mercado (solo lectura)", async () => {
    const { split } = await buildActiveSplitWithSlotAndItem();
    await openMarket(testDb, split.id);
    await testDb.split.update({ where: { id: split.id }, data: { status: "CLOSED" } });
    await expect(closeMarket(testDb, split.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("cerrar el mercado no elimina ranuras, objetos ni inventario", async () => {
    const { split, slot, item } = await buildActiveSplitWithSlotAndItem();
    await openMarket(testDb, split.id);
    await closeMarket(testDb, split.id);
    expect(await testDb.splitEquipmentSlot.findUnique({ where: { id: slot.id } })).not.toBeNull();
    expect(await testDb.splitStoreItem.findUnique({ where: { id: item.id } })).not.toBeNull();
  });
});

describe("Economia separada por split", () => {
  it("dos splits distintos tienen su propio estado de mercado, ranuras y objetos", async () => {
    const { split: splitA } = await buildActiveSplitWithSlotAndItem();
    const { split: splitB } = await buildActiveSplitWithSlotAndItem();
    await openMarket(testDb, splitA.id);

    expect(await isMarketOpen(testDb, splitA.id)).toBe(true);
    expect(await isMarketOpen(testDb, splitB.id)).toBe(false);

    const slotsA = await testDb.splitEquipmentSlot.findMany({ where: { splitId: splitA.id } });
    const slotsB = await testDb.splitEquipmentSlot.findMany({ where: { splitId: splitB.id } });
    expect(slotsA.map((slot) => slot.id)).not.toEqual(slotsB.map((slot) => slot.id));
  });

  it("el mismo nombre de objeto o ranura puede repetirse en splits distintos", async () => {
    const { split: splitA } = await buildActiveSplitWithSlotAndItem();
    const { split: splitB } = await buildActiveSplitWithSlotAndItem();
    // Ambos ya se llaman "Anillo"/"Cristal de datos" por el helper: si no lanzara, confirma que no hay conflicto entre splits.
    expect(await testDb.splitEquipmentSlot.count({ where: { splitId: splitA.id, name: "Anillo" } })).toBe(1);
    expect(await testDb.splitEquipmentSlot.count({ where: { splitId: splitB.id, name: "Anillo" } })).toBe(1);
  });
});
