import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { createSlot } from "./helpers/equipment";
import { createPerson } from "@/server/services/person.service";
import { createSplitWithWeeks, activateSplit } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import {
  assignVisualPositionToSlot,
  getEquipmentSlotBoard,
  listParticipantsBlockingSlotDeactivation,
  setEquipmentSlotActive,
} from "@/server/services/equipment-slot.service";
import { createStoreItem, setStoreItemForSale } from "@/server/services/store-item.service";
import { closeMarket, collectMarketOpenIssues, openMarket } from "@/server/services/economy.service";
import { purchaseStoreItem } from "@/server/services/purchase.service";
import { getConfirmedLoadout, listEquipmentForParticipant, saveEquipmentLoadout } from "@/server/services/equipment.service";
import { DomainError } from "@/lib/errors";

/**
 * Ranuras visuales y confirmacion atomica del equipo (`1.2.0`, secciones 17.1
 * y 17.2 del encargo). Solo lo que esta entrega introduce: no se repite aqui
 * el motor semanal ni la economia ya cubiertos por otras pruebas.
 */

async function buildSplitWithOwnedItems() {
  const split = await createSplitWithWeeks(testDb, {
    name: "Split Equipo Visual",
    description: undefined,
    startDate: "2025-10-06",
    numberOfWeeks: 2,
  });
  const person = await createPerson(testDb, { fullName: "Persona Equipo Visual", email: undefined });
  const participant = await addParticipant(testDb, split.id, {
    personId: person.id,
    alias: "Equipo",
    level: "N2",
    startWeekSequenceNumber: 1,
  });
  await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", {
    isActive: true,
    baseMax: 1000,
    multiplierN2: 1,
    parameters: { pointsPerResult: 10 },
  });
  await activateSplit(testDb, split.id);

  const head = await createSlot(split.id, "HEAD");
  const torso = await createSlot(split.id, "TORSO");
  const helmet = await createStoreItem(testDb, split.id, {
    name: "Yelmo",
    description: null,
    priceCredits: 10,
    equipmentSlotId: head.id,
    kpiCode: "STABILITY_GUARDIAN",
    bonusPercent: 20,
  });
  const armour = await createStoreItem(testDb, split.id, {
    name: "Coraza",
    description: null,
    priceCredits: 10,
    equipmentSlotId: torso.id,
    kpiCode: "STABILITY_GUARDIAN",
    bonusPercent: 30,
  });

  await grantCredits(split.id, participant.id, 200);
  await openMarket(testDb, split.id);
  await purchaseStoreItem(testDb, person.id, participant.id, helmet.id);
  await purchaseStoreItem(testDb, person.id, participant.id, armour.id);

  const ownedHelmet = await testDb.splitParticipantItem.findFirstOrThrow({
    where: { splitParticipantId: participant.id, storeItemId: helmet.id },
  });
  const ownedArmour = await testDb.splitParticipantItem.findFirstOrThrow({
    where: { splitParticipantId: participant.id, storeItemId: armour.id },
  });

  return { split, person, participant, head, torso, helmet, armour, ownedHelmet, ownedArmour };
}

/** Otorga creditos creando una publicacion minima real (un movimiento siempre necesita su referencia). */
async function grantCredits(splitId: string, splitParticipantId: string, amount: number): Promise<void> {
  const week = await testDb.splitWeek.findFirstOrThrow({ where: { splitId }, orderBy: { sequenceNumber: "desc" } });
  const publication = await testDb.weekPublication.upsert({
    where: { splitWeekId: week.id },
    create: { splitWeekId: week.id },
    update: {},
  });
  const participant = await testDb.splitParticipant.findUniqueOrThrow({ where: { id: splitParticipantId } });
  const result = await testDb.publishedParticipantWeeklyResult.create({
    data: {
      publicationId: publication.id,
      splitId,
      splitParticipantId,
      personId: participant.personId,
      fullNameSnapshot: "Prueba",
      aliasSnapshot: "Prueba",
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

beforeEach(async () => {
  await resetDatabase();
});

describe("Desactivacion de ranuras", () => {
  it("no se puede desactivar una ranura con equipo actual, e identifica a quien la bloquea", async () => {
    const { split, person, participant, head, ownedHelmet } = await buildSplitWithOwnedItems();
    await saveEquipmentLoadout(testDb, person.id, participant.id, [{ equipmentSlotId: head.id, ownedItemId: ownedHelmet.id }], null);
    await closeMarket(testDb, split.id);

    await expect(setEquipmentSlotActive(testDb, split.id, head.id, false)).rejects.toBeInstanceOf(DomainError);
    expect(await listParticipantsBlockingSlotDeactivation(testDb, split.id, head.id)).toEqual(["Equipo"]);

    // Nadie se desequipa automaticamente: el equipo sigue exactamente igual.
    expect((await getConfirmedLoadout(testDb, participant.id)).assignments).toHaveLength(1);
  });

  it("no se puede desactivar una ranura con objetos todavia a la venta", async () => {
    const { split, head } = await buildSplitWithOwnedItems();
    await closeMarket(testDb, split.id);
    await expect(setEquipmentSlotActive(testDb, split.id, head.id, false)).rejects.toBeInstanceOf(DomainError);
  });

  it("una ranura inactiva no acepta equipo nuevo, pero conserva objetos, compras y publicaciones", async () => {
    const { split, person, participant, head, ownedHelmet } = await buildSplitWithOwnedItems();
    await closeMarket(testDb, split.id);
    await setStoreItemForSale(testDb, split.id, (await testDb.splitStoreItem.findFirstOrThrow({ where: { equipmentSlotId: head.id } })).id, false);
    await setEquipmentSlotActive(testDb, split.id, head.id, false);

    await expect(
      saveEquipmentLoadout(testDb, person.id, participant.id, [{ equipmentSlotId: head.id, ownedItemId: ownedHelmet.id }], null),
    ).rejects.toBeInstanceOf(DomainError);

    // El objeto sigue en el inventario y su compra sigue existiendo.
    expect(await testDb.splitParticipantItem.count({ where: { id: ownedHelmet.id } })).toBe(1);
    expect(await testDb.itemPurchase.count({ where: { splitParticipantId: participant.id } })).toBe(2);
  });

  it("el mercado no abre con un objeto a la venta en una ranura inactiva o pendiente de ubicar", async () => {
    const { split, head } = await buildSplitWithOwnedItems();
    await closeMarket(testDb, split.id);

    // Ranura historica sin ubicar, con un objeto a la venta.
    const legacy = await testDb.splitEquipmentSlot.create({
      data: { splitId: split.id, name: "Amuleto antiguo", nameNormalized: "amuleto antiguo", displayOrder: 9 },
    });
    await createStoreItem(testDb, split.id, {
      name: "Amuleto",
      description: null,
      priceCredits: 5,
      equipmentSlotId: legacy.id,
      kpiCode: "STABILITY_GUARDIAN",
      bonusPercent: 10,
    });

    const issues = await collectMarketOpenIssues(testDb, split.id);
    expect(issues.some((issue) => issue.includes("pendiente de ubicar"))).toBe(true);
    await expect(openMarket(testDb, split.id)).rejects.toBeInstanceOf(DomainError);
    void head;
  });
});

describe("Tablero administrativo de ranuras", () => {
  it("devuelve siempre las diez posiciones y separa las ranuras historicas pendientes", async () => {
    const { split } = await buildSplitWithOwnedItems();
    const legacy = await testDb.splitEquipmentSlot.create({
      data: { splitId: split.id, name: "Anillo", nameNormalized: "anillo", displayOrder: 8 },
    });

    const board = await getEquipmentSlotBoard(testDb, split.id);
    expect(board.positions).toHaveLength(10);
    expect(board.positions.filter((entry) => entry.slot !== null).map((entry) => entry.position)).toEqual(["HEAD", "TORSO"]);
    expect(board.unplacedSlots.map((slot) => slot.id)).toEqual([legacy.id]);

    const headEntry = board.positions.find((entry) => entry.position === "HEAD")!;
    expect(headEntry.slot?.storeItemCount).toBe(1);
    expect(headEntry.slot?.ownerCount).toBe(1);
    expect(headEntry.slot?.equippedCount).toBe(0);
  });

  it("ubicar una ranura historica conserva su identidad y no toca el equipo existente", async () => {
    const { split, person, participant, head, ownedHelmet } = await buildSplitWithOwnedItems();
    await saveEquipmentLoadout(testDb, person.id, participant.id, [{ equipmentSlotId: head.id, ownedItemId: ownedHelmet.id }], null);
    await closeMarket(testDb, split.id);

    const legacy = await testDb.splitEquipmentSlot.create({
      data: { splitId: split.id, name: "Arma", nameNormalized: "arma", displayOrder: 9 },
    });
    const mapped = await assignVisualPositionToSlot(testDb, split.id, legacy.id, "LEFT_HAND");

    expect(mapped.id).toBe(legacy.id);
    expect((await getConfirmedLoadout(testDb, participant.id)).assignments).toEqual([
      { equipmentSlotId: head.id, ownedItemId: ownedHelmet.id },
    ]);
  });
});

describe("Confirmacion atomica del equipo", () => {
  it("un loadout valido sustituye el conjunto completo de una sola vez", async () => {
    const { split, person, participant, head, torso, ownedHelmet, ownedArmour } = await buildSplitWithOwnedItems();

    const first = await saveEquipmentLoadout(
      testDb,
      person.id,
      participant.id,
      [
        { equipmentSlotId: head.id, ownedItemId: ownedHelmet.id },
        { equipmentSlotId: torso.id, ownedItemId: ownedArmour.id },
      ],
      null,
    );
    expect(first.assignments).toHaveLength(2);

    // Confirmar de nuevo con solo una ranura vacia la otra: es una sustitucion completa, no un añadido.
    const second = await saveEquipmentLoadout(
      testDb,
      person.id,
      participant.id,
      [{ equipmentSlotId: torso.id, ownedItemId: ownedArmour.id }],
      first.revision,
    );
    expect(second.assignments).toEqual([{ equipmentSlotId: torso.id, ownedItemId: ownedArmour.id }]);

    const equipment = await listEquipmentForParticipant(testDb, participant.id, split.id);
    expect(equipment.find((row) => row.equipmentSlotId === head.id)!.equippedItem).toBeNull();
    expect(equipment.find((row) => row.equipmentSlotId === torso.id)!.equippedItem?.ownedItemId).toBe(ownedArmour.id);
  });

  it("rechaza un objeto no poseido, uno de otro split y uno en una ranura incompatible", async () => {
    const { person, participant, head, torso, ownedHelmet } = await buildSplitWithOwnedItems();
    const other = await buildSplitWithOwnedItems();

    await expect(
      saveEquipmentLoadout(testDb, person.id, participant.id, [{ equipmentSlotId: head.id, ownedItemId: "00000000-0000-0000-0000-000000000000" }], null),
    ).rejects.toBeInstanceOf(DomainError);

    await expect(
      saveEquipmentLoadout(testDb, person.id, participant.id, [{ equipmentSlotId: head.id, ownedItemId: other.ownedHelmet.id }], null),
    ).rejects.toBeInstanceOf(DomainError);

    // El yelmo pertenece a la cabeza, no al torso.
    await expect(
      saveEquipmentLoadout(testDb, person.id, participant.id, [{ equipmentSlotId: torso.id, ownedItemId: ownedHelmet.id }], null),
    ).rejects.toBeInstanceOf(DomainError);

    expect((await getConfirmedLoadout(testDb, participant.id)).assignments).toEqual([]);
  });

  it("rechaza equipar el mismo objeto en dos ranuras y dos objetos en la misma ranura", async () => {
    const { person, participant, head, torso, ownedHelmet, ownedArmour } = await buildSplitWithOwnedItems();

    await expect(
      saveEquipmentLoadout(
        testDb,
        person.id,
        participant.id,
        [
          { equipmentSlotId: head.id, ownedItemId: ownedHelmet.id },
          { equipmentSlotId: torso.id, ownedItemId: ownedHelmet.id },
        ],
        null,
      ),
    ).rejects.toBeInstanceOf(DomainError);

    await expect(
      saveEquipmentLoadout(
        testDb,
        person.id,
        participant.id,
        [
          { equipmentSlotId: head.id, ownedItemId: ownedHelmet.id },
          { equipmentSlotId: head.id, ownedItemId: ownedArmour.id },
        ],
        null,
      ),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("un conflicto de revision no sobrescribe el equipo confirmado en otra sesion", async () => {
    const { person, participant, head, torso, ownedHelmet, ownedArmour } = await buildSplitWithOwnedItems();

    // La pestaña A carga la ficha con el equipo vacio.
    const revisionSeenByTabA = (await getConfirmedLoadout(testDb, participant.id)).revision;
    // La pestaña B confirma primero.
    await saveEquipmentLoadout(testDb, person.id, participant.id, [{ equipmentSlotId: torso.id, ownedItemId: ownedArmour.id }], revisionSeenByTabA);

    // La pestaña A confirma con la revision antigua: no se guarda nada ni se mezclan estados.
    await expect(
      saveEquipmentLoadout(testDb, person.id, participant.id, [{ equipmentSlotId: head.id, ownedItemId: ownedHelmet.id }], revisionSeenByTabA),
    ).rejects.toBeInstanceOf(DomainError);

    expect((await getConfirmedLoadout(testDb, participant.id)).assignments).toEqual([
      { equipmentSlotId: torso.id, ownedItemId: ownedArmour.id },
    ]);
  });

  it("el mercado cerrado no bloquea confirmar equipo en un split activo", async () => {
    const { split, person, participant, head, ownedHelmet } = await buildSplitWithOwnedItems();
    await closeMarket(testDb, split.id);

    await expect(
      saveEquipmentLoadout(testDb, person.id, participant.id, [{ equipmentSlotId: head.id, ownedItemId: ownedHelmet.id }], null),
    ).resolves.toBeDefined();
  });

  it("una confirmacion invalida no deja el equipo parcialmente cambiado", async () => {
    const { person, participant, head, torso, ownedHelmet, ownedArmour } = await buildSplitWithOwnedItems();
    await saveEquipmentLoadout(testDb, person.id, participant.id, [{ equipmentSlotId: head.id, ownedItemId: ownedHelmet.id }], null);

    // La segunda asignacion es incompatible: toda la confirmacion se rechaza.
    await expect(
      saveEquipmentLoadout(
        testDb,
        person.id,
        participant.id,
        [
          { equipmentSlotId: torso.id, ownedItemId: ownedArmour.id },
          { equipmentSlotId: head.id, ownedItemId: ownedArmour.id },
        ],
        null,
      ),
    ).rejects.toBeInstanceOf(DomainError);

    expect((await getConfirmedLoadout(testDb, participant.id)).assignments).toEqual([
      { equipmentSlotId: head.id, ownedItemId: ownedHelmet.id },
    ]);
  });

  it("solo el dueño de la participacion puede confirmar su equipo", async () => {
    const { participant, head, ownedHelmet } = await buildSplitWithOwnedItems();
    const intruder = await createPerson(testDb, { fullName: "Persona Ajena", email: undefined });

    await expect(
      saveEquipmentLoadout(testDb, intruder.id, participant.id, [{ equipmentSlotId: head.id, ownedItemId: ownedHelmet.id }], null),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
