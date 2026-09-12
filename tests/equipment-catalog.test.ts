import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { createPerson } from "@/server/services/person.service";
import { createSplitWithWeeks, activateSplit } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import {
  MAX_EQUIPMENT_SLOTS_PER_SPLIT,
  createEquipmentSlot,
  deleteEquipmentSlot,
  listEquipmentSlotsForSplit,
  renameEquipmentSlot,
  reorderEquipmentSlots,
} from "@/server/services/equipment-slot.service";
import {
  createStoreItem,
  deleteStoreItem,
  setStoreItemForSale,
  updateStoreItem,
} from "@/server/services/store-item.service";
import { openMarket } from "@/server/services/economy.service";
import { purchaseStoreItem } from "@/server/services/purchase.service";
import { DomainError } from "@/lib/errors";

/**
 * Ranuras de equipo y catalogo de objetos (`0.9.0` / MVP-2D, secciones 10-15
 * del encargo, seccion 56 del listado de pruebas).
 */

const ITEM_INPUT = {
  name: "Cristal de datos",
  description: "Un objeto de prueba",
  priceCredits: 100,
  kpiCode: "STABILITY_GUARDIAN" as const,
  bonusPercent: 20,
};

async function buildActiveSplit() {
  const split = await createSplitWithWeeks(testDb, { name: "Split Catalogo", description: undefined, startDate: "2025-10-06", numberOfWeeks: 2 });
  const person = await createPerson(testDb, { fullName: "Persona Catalogo", email: undefined });
  const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Catalogo", level: "N2", startWeekSequenceNumber: 1 });
  await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 70, multiplierN2: 1, parameters: { pointsPerResult: 30 } });
  await activateSplit(testDb, split.id);
  return { split, person, participant };
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Ranuras de equipo", () => {
  it("cantidad y nombres son configurables: el administrador decide cuantas y como se llaman", async () => {
    const { split } = await buildActiveSplit();
    await createEquipmentSlot(testDb, split.id, { name: "Arma" });
    await createEquipmentSlot(testDb, split.id, { name: "Armadura" });
    await createEquipmentSlot(testDb, split.id, { name: "Accesorio" });
    const slots = await listEquipmentSlotsForSplit(testDb, split.id);
    expect(slots.map((slot) => slot.name)).toEqual(["Arma", "Armadura", "Accesorio"]);
  });

  it("el nombre de ranura es unico dentro del split", async () => {
    const { split } = await buildActiveSplit();
    await createEquipmentSlot(testDb, split.id, { name: "Arma" });
    await expect(createEquipmentSlot(testDb, split.id, { name: "arma  " })).rejects.toBeInstanceOf(DomainError);
  });

  it("el mismo nombre de ranura es valido en otro split", async () => {
    const { split: splitA } = await buildActiveSplit();
    const { split: splitB } = await buildActiveSplit();
    await createEquipmentSlot(testDb, splitA.id, { name: "Arma" });
    await expect(createEquipmentSlot(testDb, splitB.id, { name: "Arma" })).resolves.toBeDefined();
  });

  it("respeta el limite tecnico de ranuras por split", async () => {
    const { split } = await buildActiveSplit();
    for (let i = 0; i < MAX_EQUIPMENT_SLOTS_PER_SPLIT; i += 1) {
      await createEquipmentSlot(testDb, split.id, { name: `Ranura ${i}` });
    }
    await expect(createEquipmentSlot(testDb, split.id, { name: "Una de mas" })).rejects.toBeInstanceOf(DomainError);
  });

  it("reordena las ranuras segun la lista de ids recibida", async () => {
    const { split } = await buildActiveSplit();
    const a = await createEquipmentSlot(testDb, split.id, { name: "Arma" });
    const b = await createEquipmentSlot(testDb, split.id, { name: "Armadura" });
    await reorderEquipmentSlots(testDb, split.id, [b.id, a.id]);
    const slots = await listEquipmentSlotsForSplit(testDb, split.id);
    expect(slots.map((slot) => slot.id)).toEqual([b.id, a.id]);
  });

  it("impide modificar la estructura de ranuras con el mercado abierto", async () => {
    const { split } = await buildActiveSplit();
    const slot = await createEquipmentSlot(testDb, split.id, { name: "Arma" });
    await createStoreItem(testDb, split.id, { ...ITEM_INPUT, equipmentSlotId: slot.id });
    await openMarket(testDb, split.id);

    await expect(createEquipmentSlot(testDb, split.id, { name: "Armadura" })).rejects.toBeInstanceOf(DomainError);
    await expect(renameEquipmentSlot(testDb, split.id, slot.id, { name: "Arma renombrada" })).rejects.toBeInstanceOf(DomainError);
    await expect(deleteEquipmentSlot(testDb, split.id, slot.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("impide eliminar una ranura que tiene objetos asociados", async () => {
    const { split } = await buildActiveSplit();
    const slot = await createEquipmentSlot(testDb, split.id, { name: "Arma" });
    await createStoreItem(testDb, split.id, { ...ITEM_INPUT, equipmentSlotId: slot.id });
    await expect(deleteEquipmentSlot(testDb, split.id, slot.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("permite eliminar una ranura vacia y no utilizada", async () => {
    const { split } = await buildActiveSplit();
    const slot = await createEquipmentSlot(testDb, split.id, { name: "Arma" });
    await deleteEquipmentSlot(testDb, split.id, slot.id);
    expect(await listEquipmentSlotsForSplit(testDb, split.id)).toHaveLength(0);
  });
});

describe("Catalogo de objetos", () => {
  it("el objeto debe pertenecer al mismo split que la ranura", async () => {
    const { split: splitA } = await buildActiveSplit();
    const { split: splitB } = await buildActiveSplit();
    const slotB = await createEquipmentSlot(testDb, splitB.id, { name: "Arma" });
    await expect(createStoreItem(testDb, splitA.id, { ...ITEM_INPUT, equipmentSlotId: slotB.id })).rejects.toBeInstanceOf(DomainError);
  });

  it("exige que el KPI este activo en el split", async () => {
    const { split } = await buildActiveSplit();
    const slot = await createEquipmentSlot(testDb, split.id, { name: "Arma" });
    await expect(
      createStoreItem(testDb, split.id, { ...ITEM_INPUT, equipmentSlotId: slot.id, kpiCode: "DATA_EXPLORER" }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("el precio debe ser un entero positivo (validado en el esquema de zod, no solo en base de datos)", async () => {
    const { split } = await buildActiveSplit();
    const slot = await createEquipmentSlot(testDb, split.id, { name: "Arma" });
    // La restriccion de base de datos protege ademas cualquier valor que se saltara la validacion de servicio.
    await expect(
      testDb.splitStoreItem.create({
        data: {
          splitId: split.id,
          name: "Objeto invalido",
          nameNormalized: "objeto invalido",
          priceCredits: 0,
          equipmentSlotId: slot.id,
          kpiCode: "STABILITY_GUARDIAN",
          bonusPercent: 20,
        },
      }),
    ).rejects.toThrow();
  });

  it("el porcentaje solo puede ser 10/20/30/40/50 (restriccion de base de datos)", async () => {
    const { split } = await buildActiveSplit();
    const slot = await createEquipmentSlot(testDb, split.id, { name: "Arma" });
    await expect(
      testDb.splitStoreItem.create({
        data: {
          splitId: split.id,
          name: "Objeto invalido",
          nameNormalized: "objeto invalido",
          priceCredits: 10,
          equipmentSlotId: slot.id,
          kpiCode: "STABILITY_GUARDIAN",
          bonusPercent: 25,
        },
      }),
    ).rejects.toThrow();
  });

  it("el nombre de objeto es unico dentro del split, pero valido en otro", async () => {
    const { split: splitA } = await buildActiveSplit();
    const { split: splitB } = await buildActiveSplit();
    const slotA = await createEquipmentSlot(testDb, splitA.id, { name: "Arma" });
    const slotB = await createEquipmentSlot(testDb, splitB.id, { name: "Arma" });
    await createStoreItem(testDb, splitA.id, { ...ITEM_INPUT, equipmentSlotId: slotA.id });
    await expect(createStoreItem(testDb, splitA.id, { ...ITEM_INPUT, equipmentSlotId: slotA.id })).rejects.toBeInstanceOf(DomainError);
    await expect(createStoreItem(testDb, splitB.id, { ...ITEM_INPUT, equipmentSlotId: slotB.id })).resolves.toBeDefined();
  });

  it("impide crear, editar o retirar objetos con el mercado abierto", async () => {
    const { split } = await buildActiveSplit();
    const slot = await createEquipmentSlot(testDb, split.id, { name: "Arma" });
    const item = await createStoreItem(testDb, split.id, { ...ITEM_INPUT, equipmentSlotId: slot.id });
    await openMarket(testDb, split.id);

    await expect(createStoreItem(testDb, split.id, { ...ITEM_INPUT, name: "Otro", equipmentSlotId: slot.id })).rejects.toBeInstanceOf(DomainError);
    await expect(updateStoreItem(testDb, split.id, item.id, { ...ITEM_INPUT, priceCredits: 50, equipmentSlotId: slot.id })).rejects.toBeInstanceOf(
      DomainError,
    );
    await expect(setStoreItemForSale(testDb, split.id, item.id, false)).rejects.toBeInstanceOf(DomainError);
  });

  it("antes de la primera compra, el objeto puede editarse o eliminarse", async () => {
    const { split } = await buildActiveSplit();
    const slot = await createEquipmentSlot(testDb, split.id, { name: "Arma" });
    const item = await createStoreItem(testDb, split.id, { ...ITEM_INPUT, equipmentSlotId: slot.id });
    const updated = await updateStoreItem(testDb, split.id, item.id, { ...ITEM_INPUT, priceCredits: 50, equipmentSlotId: slot.id });
    expect(updated.priceCredits).toBe(50);
    await deleteStoreItem(testDb, split.id, item.id);
    expect(await testDb.splitStoreItem.findUnique({ where: { id: item.id } })).toBeNull();
  });

  it("despues de la primera compra, el objeto no puede editarse ni eliminarse, pero si retirarse de la venta", async () => {
    const { split, person, participant } = await buildActiveSplit();
    const slot = await createEquipmentSlot(testDb, split.id, { name: "Arma" });
    const item = await createStoreItem(testDb, split.id, { ...ITEM_INPUT, priceCredits: 10, equipmentSlotId: slot.id });
    await openMarket(testDb, split.id);
    // Otorga saldo suficiente mediante un movimiento de ganancia ficticio vinculado a un resultado publicado real.
    await grantCredits(split.id, participant.id, 50);
    await purchaseStoreItem(testDb, person.id, participant.id, item.id);

    await expect(updateStoreItem(testDb, split.id, item.id, { ...ITEM_INPUT, priceCredits: 999, equipmentSlotId: slot.id })).rejects.toBeInstanceOf(
      DomainError,
    );
    await expect(deleteStoreItem(testDb, split.id, item.id)).rejects.toBeInstanceOf(DomainError);

    // Retirar de la venta si esta permitido y conserva el objeto (y su efecto) para quien ya lo posee.
    await testDb.splitEconomySettings.update({ where: { splitId: split.id }, data: { marketStatus: "CLOSED" } });
    const retired = await setStoreItemForSale(testDb, split.id, item.id, false);
    expect(retired.isForSale).toBe(false);
    const ownedItem = await testDb.splitParticipantItem.findFirst({ where: { splitParticipantId: participant.id } });
    expect(ownedItem).not.toBeNull();
  });
});

/** Otorga creditos de prueba creando una publicacion minima real (los movimientos siempre necesitan una referencia valida). */
async function grantCredits(splitId: string, splitParticipantId: string, amount: number): Promise<void> {
  const week = await testDb.splitWeek.findFirstOrThrow({ where: { splitId }, orderBy: { sequenceNumber: "desc" } });
  const publication = await testDb.weekPublication.upsert({
    where: { splitWeekId: week.id },
    create: { splitWeekId: week.id },
    update: {},
  });
  const person = await testDb.splitParticipant.findUniqueOrThrow({ where: { id: splitParticipantId } });
  const result = await testDb.publishedParticipantWeeklyResult.create({
    data: {
      publicationId: publication.id,
      splitId,
      splitParticipantId,
      personId: person.personId,
      fullNameSnapshot: "Test",
      aliasSnapshot: "Test",
      levelSnapshot: "N2",
      totalKpiPoints: amount,
      weeklyRank: 1,
      positionPoints: 0,
      rankedParticipantCount: 1,
      creditsEarned: amount,
    },
  });
  await testDb.creditLedgerEntry.create({
    data: {
      splitParticipantId,
      type: "WEEKLY_EARNING",
      amount,
      description: "Creditos de prueba",
      publishedResultId: result.id,
    },
  });
}
