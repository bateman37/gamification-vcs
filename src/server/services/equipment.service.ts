import type { Prisma, PrismaClient } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { KPI_CATALOG } from "@/domain/kpis/catalog";
import type { EquippedItemForBonus } from "@/domain/equipment-bonus";

/**
 * Equipo actual del participante (`0.9.0` / MVP-2D, ver
 * docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md, secciones 19-22 del encargo). Un
 * objeto por ranura, mientras el split este `ACTIVE`: no depende de que el
 * mercado este abierto. La verdad definitiva de una semana es el equipo que
 * `publishWeek` vuelve a leer dentro de su propia transaccion en el instante
 * de publicar, nunca lo que muestre una previsualizacion previa.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export interface EquippedSlotView {
  equipmentSlotId: string;
  equipmentSlotName: string;
  displayOrder: number;
  equippedItem: {
    ownedItemId: string;
    storeItemId: string;
    itemName: string;
    kpiName: string;
    bonusPercent: number;
  } | null;
}

/** Todas las ranuras del split con el objeto equipado en cada una (o vacia). */
export async function listEquipmentForParticipant(db: Db, splitParticipantId: string, splitId: string): Promise<EquippedSlotView[]> {
  const [slots, equipped] = await Promise.all([
    db.splitEquipmentSlot.findMany({ where: { splitId }, orderBy: { displayOrder: "asc" } }),
    db.splitParticipantEquippedItem.findMany({
      where: { splitParticipantId },
      include: { ownedItem: { include: { storeItem: true } } },
    }),
  ]);
  const equippedBySlot = new Map(equipped.map((row) => [row.equipmentSlotId, row]));

  return slots.map((slot) => {
    const row = equippedBySlot.get(slot.id);
    return {
      equipmentSlotId: slot.id,
      equipmentSlotName: slot.name,
      displayOrder: slot.displayOrder,
      equippedItem: row
        ? {
            ownedItemId: row.ownedItemId,
            storeItemId: row.ownedItem.storeItemId,
            itemName: row.ownedItem.storeItem.name,
            kpiName: KPI_CATALOG[row.ownedItem.storeItem.kpiCode].name,
            bonusPercent: row.ownedItem.storeItem.bonusPercent,
          }
        : null,
    };
  });
}

async function assertParticipantCanManageEquipment(db: Db, personId: string, splitParticipantId: string) {
  const participant = await db.splitParticipant.findUnique({
    where: { id: splitParticipantId },
    include: { split: { select: { id: true, status: true } } },
  });
  if (!participant || participant.personId !== personId) {
    throw new DomainError("Esta ficha no existe o no es tuya.");
  }
  if (participant.split.status !== "ACTIVE") {
    throw new DomainError("Solo se puede equipar o desequipar mientras el split esta activo.");
  }
  return participant;
}

/** Equipa (o sustituye) un objeto propio en la ranura a la que pertenece. */
export async function equipOwnedItem(db: PrismaClient, personId: string, splitParticipantId: string, ownedItemId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await assertParticipantCanManageEquipment(tx, personId, splitParticipantId);

    const ownedItem = await tx.splitParticipantItem.findUnique({
      where: { id: ownedItemId },
      include: { storeItem: true },
    });
    if (!ownedItem || ownedItem.splitParticipantId !== splitParticipantId) {
      throw new DomainError("No posees ese objeto.");
    }

    await tx.splitParticipantEquippedItem.upsert({
      where: {
        splitParticipantId_equipmentSlotId: { splitParticipantId, equipmentSlotId: ownedItem.storeItem.equipmentSlotId },
      },
      create: { splitParticipantId, equipmentSlotId: ownedItem.storeItem.equipmentSlotId, ownedItemId: ownedItem.id },
      update: { ownedItemId: ownedItem.id },
    });
  });
}

/** Deja una ranura propia vacia. Idempotente: si ya estaba vacia, no falla. */
export async function unequipSlot(db: PrismaClient, personId: string, splitParticipantId: string, equipmentSlotId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const participant = await assertParticipantCanManageEquipment(tx, personId, splitParticipantId);
    const slot = await tx.splitEquipmentSlot.findUnique({ where: { id: equipmentSlotId } });
    if (!slot || slot.splitId !== participant.splitId) {
      throw new DomainError("La ranura indicada no pertenece a este split.");
    }
    await tx.splitParticipantEquippedItem.deleteMany({ where: { splitParticipantId, equipmentSlotId } });
  });
}

/**
 * Equipo vivo de varios participantes a la vez, listo para
 * `applyEquipmentBonuses` (usado por `weekly-results.service.ts`, tanto en
 * previsualizacion como dentro de la transaccion de `publishWeek`). Una sola
 * consulta para todos los participantes indicados: nunca N+1 por KPI ni por
 * participante.
 */
export async function loadEquippedItemsForParticipants(
  db: Db,
  splitParticipantIds: string[],
): Promise<Map<string, EquippedItemForBonus[]>> {
  const result = new Map<string, EquippedItemForBonus[]>();
  if (splitParticipantIds.length === 0) return result;

  const rows = await db.splitParticipantEquippedItem.findMany({
    where: { splitParticipantId: { in: splitParticipantIds } },
    include: { ownedItem: { include: { storeItem: true } }, equipmentSlot: true },
  });

  for (const row of rows) {
    const list = result.get(row.splitParticipantId) ?? [];
    list.push({
      ownedItemId: row.ownedItemId,
      storeItemId: row.ownedItem.storeItemId,
      itemName: row.ownedItem.storeItem.name,
      equipmentSlotId: row.equipmentSlotId,
      equipmentSlotName: row.equipmentSlot.name,
      kpiCode: row.ownedItem.storeItem.kpiCode,
      bonusPercent: row.ownedItem.storeItem.bonusPercent,
      displayOrder: row.equipmentSlot.displayOrder,
    });
    result.set(row.splitParticipantId, list);
  }
  return result;
}
