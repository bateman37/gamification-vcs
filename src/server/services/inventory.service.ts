import type { Prisma, PrismaClient } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { KPI_CATALOG, type KpiCode } from "@/domain/kpis/catalog";

/**
 * Inventario permanente de un participante (`0.9.0` / MVP-2D, ver
 * docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md, seccion 17 del encargo). Sin
 * reventa, devolucion, regalo, intercambio ni destruccion en esta release:
 * este fichero solo lee lo ya comprado.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export interface OwnedItemView {
  ownedItemId: string;
  storeItemId: string;
  name: string;
  description: string | null;
  equipmentSlotId: string;
  equipmentSlotName: string;
  kpiCode: KpiCode;
  kpiName: string;
  bonusPercent: number;
  priceCredits: number;
  acquiredAt: Date;
  equipped: boolean;
}

export async function assertOwnParticipation(db: Db, personId: string, splitParticipantId: string) {
  const participant = await db.splitParticipant.findUnique({ where: { id: splitParticipantId } });
  if (!participant || participant.personId !== personId) {
    throw new DomainError("Esta ficha no existe o no es tuya.");
  }
  return participant;
}

/** Inventario de un participante, ordenado del mas reciente al mas antiguo. Nunca expone datos de otro participante. */
export async function listOwnedItemsForParticipant(db: Db, splitParticipantId: string): Promise<OwnedItemView[]> {
  const items = await db.splitParticipantItem.findMany({
    where: { splitParticipantId },
    include: {
      storeItem: { include: { equipmentSlot: { select: { name: true } } } },
      purchase: { select: { priceCreditsSnapshot: true } },
      equipped: { select: { equipmentSlotId: true } },
    },
    orderBy: { acquiredAt: "desc" },
  });

  return items.map((item) => ({
    ownedItemId: item.id,
    storeItemId: item.storeItemId,
    name: item.storeItem.name,
    description: item.storeItem.description,
    equipmentSlotId: item.storeItem.equipmentSlotId,
    equipmentSlotName: item.storeItem.equipmentSlot.name,
    kpiCode: item.storeItem.kpiCode,
    kpiName: KPI_CATALOG[item.storeItem.kpiCode].name,
    bonusPercent: item.storeItem.bonusPercent,
    priceCredits: item.purchase.priceCreditsSnapshot,
    acquiredAt: item.acquiredAt,
    equipped: item.equipped !== null,
  }));
}
