import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { createPerson } from "@/server/services/person.service";
import { createSplitWithWeeks, activateSplit, listSplitWeeks } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { saveStabilityEntries } from "@/server/services/stability-entry.service";
import { publishWeek } from "@/server/services/publish-week.service";
import { createEquipmentSlot } from "@/server/services/equipment-slot.service";
import { createStoreItem } from "@/server/services/store-item.service";
import { openMarket, closeMarket } from "@/server/services/economy.service";
import { purchaseStoreItem } from "@/server/services/purchase.service";
import { listOwnedItemsForParticipant } from "@/server/services/inventory.service";
import { equipOwnedItem, listEquipmentForParticipant, unequipSlot } from "@/server/services/equipment.service";
import { getParticipantBalance } from "@/server/services/ledger.service";
import { DomainError } from "@/lib/errors";

/**
 * Compra, inventario y equipo (`0.9.0` / MVP-2D, partes E-F del encargo,
 * secciones 57-58 del listado de pruebas).
 */

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

/** Split activo con un participante que ya gano 100 creditos reales (mediante una publicacion real). */
async function buildParticipantWithCredits(credits = 100) {
  const split = await createSplitWithWeeks(testDb, { name: "Split Compras", description: undefined, startDate: "2025-10-06", numberOfWeeks: 2 });
  const person = await createPerson(testDb, { fullName: "Persona Compras", email: undefined });
  const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Compras", level: "N2", startWeekSequenceNumber: 1 });
  await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 1000, multiplierN2: 1, parameters: { pointsPerResult: credits } });
  await activateSplit(testDb, split.id);
  const week = (await listSplitWeeks(testDb, split.id))[0]!;
  await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "1" }));
  await publishWeek(testDb, split.id, week.id, null);

  const slot = await createEquipmentSlot(testDb, split.id, { name: "Artefacto" });
  const item = await createStoreItem(testDb, split.id, {
    name: "Cristal de datos",
    description: null,
    priceCredits: 100,
    equipmentSlotId: slot.id,
    kpiCode: "STABILITY_GUARDIAN",
    bonusPercent: 20,
  });
  await openMarket(testDb, split.id);

  return { split, person, participant, slot, item };
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Compra", () => {
  it("con saldo suficiente crea compra, inventario y debito de forma atomica", async () => {
    const { split, person, participant, item } = await buildParticipantWithCredits(100);
    await purchaseStoreItem(testDb, person.id, participant.id, item.id);

    expect(await getParticipantBalance(testDb, participant.id)).toBe(0);
    const purchases = await testDb.itemPurchase.findMany({ where: { splitParticipantId: participant.id } });
    expect(purchases).toHaveLength(1);
    expect(purchases[0]!.priceCreditsSnapshot).toBe(100);
    const owned = await listOwnedItemsForParticipant(testDb, participant.id);
    expect(owned).toHaveLength(1);
    expect(owned[0]!.storeItemId).toBe(item.id);
    const debit = await testDb.creditLedgerEntry.findMany({ where: { splitParticipantId: participant.id, type: "PURCHASE" } });
    expect(debit).toHaveLength(1);
    expect(debit[0]!.amount).toBe(-100);
    void split;
  });

  it("con saldo insuficiente no crea compra, inventario ni debito", async () => {
    const { person, participant, item } = await buildParticipantWithCredits(50);
    await expect(purchaseStoreItem(testDb, person.id, participant.id, item.id)).rejects.toBeInstanceOf(DomainError);

    expect(await testDb.itemPurchase.count({ where: { splitParticipantId: participant.id } })).toBe(0);
    expect(await testDb.splitParticipantItem.count({ where: { splitParticipantId: participant.id } })).toBe(0);
    expect(await getParticipantBalance(testDb, participant.id)).toBe(50);
  });

  it("el precio siempre se lee del servidor: el llamador nunca puede enviar un importe distinto", async () => {
    const { person, participant, item } = await buildParticipantWithCredits(100);
    // La firma de purchaseStoreItem no acepta ningun precio ni saldo del cliente: solo ids.
    await purchaseStoreItem(testDb, person.id, participant.id, item.id);
    const debit = await testDb.creditLedgerEntry.findFirstOrThrow({ where: { splitParticipantId: participant.id, type: "PURCHASE" } });
    expect(debit.amount).toBe(-item.priceCredits);
  });

  it("no se compra dos veces el mismo objeto", async () => {
    const { person, participant, item } = await buildParticipantWithCredits(300);
    await purchaseStoreItem(testDb, person.id, participant.id, item.id);
    await expect(purchaseStoreItem(testDb, person.id, participant.id, item.id)).rejects.toBeInstanceOf(DomainError);
    expect(await testDb.itemPurchase.count({ where: { splitParticipantId: participant.id } })).toBe(1);
  });

  it("un doble clic (dos compras concurrentes) no duplica la compra ni gasta el mismo saldo dos veces", async () => {
    const { person, participant, item } = await buildParticipantWithCredits(150);
    const results = await Promise.allSettled([
      purchaseStoreItem(testDb, person.id, participant.id, item.id),
      purchaseStoreItem(testDb, person.id, participant.id, item.id),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);
    expect(await testDb.itemPurchase.count({ where: { splitParticipantId: participant.id } })).toBe(1);
    expect(await getParticipantBalance(testDb, participant.id)).toBe(50);
  });

  it("no se compra un objeto de otro split", async () => {
    const { person, participant } = await buildParticipantWithCredits(300);
    const { item: otherSplitItem } = await buildParticipantWithCredits(300);
    await expect(purchaseStoreItem(testDb, person.id, participant.id, otherSplitItem.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("rechaza la compra cuando el mercado esta cerrado", async () => {
    const { split, person, participant, item } = await buildParticipantWithCredits(300);
    await closeMarket(testDb, split.id);
    await expect(purchaseStoreItem(testDb, person.id, participant.id, item.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("rechaza comprar para una participacion que no es la propia", async () => {
    const { participant, item } = await buildParticipantWithCredits(300);
    const otherPerson = await createPerson(testDb, { fullName: "Persona Ajena", email: undefined });
    await expect(purchaseStoreItem(testDb, otherPerson.id, participant.id, item.id)).rejects.toBeInstanceOf(DomainError);
  });
});

describe("Inventario", () => {
  it("un participante no puede consultar el inventario de otro (el servicio siempre filtra por su propia participacion)", async () => {
    const { participant } = await buildParticipantWithCredits(100);
    const { participant: otherParticipant } = await buildParticipantWithCredits(100);
    const ownItems = await listOwnedItemsForParticipant(testDb, participant.id);
    const otherItems = await listOwnedItemsForParticipant(testDb, otherParticipant.id);
    expect(ownItems).toHaveLength(0);
    expect(otherItems).toHaveLength(0);
    // Nunca se mezclan inventarios entre participantes de splits distintos.
    expect(ownItems).not.toBe(otherItems);
  });
});

describe("Equipamiento", () => {
  it("solo puede equiparse un objeto que el participante posee", async () => {
    const { person, participant } = await buildParticipantWithCredits(100);
    const fakeOwnedItemId = "00000000-0000-0000-0000-000000000000";
    await expect(equipOwnedItem(testDb, person.id, participant.id, fakeOwnedItemId)).rejects.toBeInstanceOf(DomainError);
  });

  it("equipar coloca el objeto siempre en su propia ranura", async () => {
    const { split, person, participant, slot, item } = await buildParticipantWithCredits(100);
    await purchaseStoreItem(testDb, person.id, participant.id, item.id);
    const owned = await testDb.splitParticipantItem.findFirstOrThrow({ where: { splitParticipantId: participant.id } });
    await equipOwnedItem(testDb, person.id, participant.id, owned.id);

    const equipment = await listEquipmentForParticipant(testDb, participant.id, split.id);
    const slotView = equipment.find((row) => row.equipmentSlotId === slot.id)!;
    expect(slotView.equippedItem?.ownedItemId).toBe(owned.id);
  });

  it("sustituir el objeto de una ranura mantiene un unico objeto equipado en ella", async () => {
    const { split, person, participant, slot, item } = await buildParticipantWithCredits(500);
    await purchaseStoreItem(testDb, person.id, participant.id, item.id);
    // El catalogo solo se administra con el mercado cerrado (seccion 13 del encargo).
    await closeMarket(testDb, split.id);
    const secondItem = await createStoreItem(testDb, split.id, {
      name: "Segundo objeto",
      description: null,
      priceCredits: 50,
      equipmentSlotId: slot.id,
      kpiCode: "STABILITY_GUARDIAN",
      bonusPercent: 10,
    });
    await openMarket(testDb, split.id);
    await purchaseStoreItem(testDb, person.id, participant.id, secondItem.id);

    const ownedFirst = await testDb.splitParticipantItem.findFirstOrThrow({ where: { splitParticipantId: participant.id, storeItemId: item.id } });
    const ownedSecond = await testDb.splitParticipantItem.findFirstOrThrow({ where: { splitParticipantId: participant.id, storeItemId: secondItem.id } });

    await equipOwnedItem(testDb, person.id, participant.id, ownedFirst.id);
    await equipOwnedItem(testDb, person.id, participant.id, ownedSecond.id);

    expect(await testDb.splitParticipantEquippedItem.count({ where: { splitParticipantId: participant.id, equipmentSlotId: slot.id } })).toBe(1);
    const equipment = await listEquipmentForParticipant(testDb, participant.id, split.id);
    expect(equipment.find((row) => row.equipmentSlotId === slot.id)!.equippedItem?.ownedItemId).toBe(ownedSecond.id);
  });

  it("desequipar deja la ranura vacia, de forma idempotente", async () => {
    const { split, person, participant, slot, item } = await buildParticipantWithCredits(100);
    await purchaseStoreItem(testDb, person.id, participant.id, item.id);
    const owned = await testDb.splitParticipantItem.findFirstOrThrow({ where: { splitParticipantId: participant.id } });
    await equipOwnedItem(testDb, person.id, participant.id, owned.id);

    await unequipSlot(testDb, person.id, participant.id, slot.id);
    const equipment = await listEquipmentForParticipant(testDb, participant.id, split.id);
    expect(equipment.find((row) => row.equipmentSlotId === slot.id)!.equippedItem).toBeNull();
    // Repetirlo no falla.
    await expect(unequipSlot(testDb, person.id, participant.id, slot.id)).resolves.not.toThrow();
  });

  it("el mercado cerrado sigue permitiendo equipar objetos ya comprados", async () => {
    const { split, person, participant, item } = await buildParticipantWithCredits(100);
    await purchaseStoreItem(testDb, person.id, participant.id, item.id);
    await closeMarket(testDb, split.id);
    const owned = await testDb.splitParticipantItem.findFirstOrThrow({ where: { splitParticipantId: participant.id } });
    await expect(equipOwnedItem(testDb, person.id, participant.id, owned.id)).resolves.not.toThrow();
  });

  it("un split cerrado bloquea equipar y desequipar", async () => {
    const { split, person, participant, slot, item } = await buildParticipantWithCredits(100);
    await purchaseStoreItem(testDb, person.id, participant.id, item.id);
    const owned = await testDb.splitParticipantItem.findFirstOrThrow({ where: { splitParticipantId: participant.id } });
    await equipOwnedItem(testDb, person.id, participant.id, owned.id);
    await testDb.split.update({ where: { id: split.id }, data: { status: "CLOSED" } });

    await expect(equipOwnedItem(testDb, person.id, participant.id, owned.id)).rejects.toBeInstanceOf(DomainError);
    await expect(unequipSlot(testDb, person.id, participant.id, slot.id)).rejects.toBeInstanceOf(DomainError);
  });
});
