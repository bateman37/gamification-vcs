import type { EquipmentVisualPosition, Prisma, PrismaClient } from "@prisma/client";
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
  /** Posicion visual de su ranura, o `null` si la ranura esta pendiente de ubicar (`1.2.0`). */
  equipmentSlotVisualPosition: EquipmentVisualPosition | null;
  /** `false` = ranura desactivada: el objeto se conserva pero no puede equiparse (`1.2.0`). */
  equipmentSlotIsActive: boolean;
  equipmentSlotDisplayOrder: number;
  kpiCode: KpiCode;
  kpiName: string;
  bonusPercent: number;
  priceCredits: number;
  acquiredAt: Date;
  equipped: boolean;
  /** Ranura en la que esta equipado ahora mismo, o `null`. Sirve para el badge `Equipado en ...`. */
  equippedInSlotId: string | null;
  /** `sha256` de la imagen del objeto, o `null`. Nunca los bytes (`1.2.0`, seccion 16). */
  imageVersion: string | null;
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
      storeItem: {
        include: {
          equipmentSlot: { select: { name: true, visualPosition: true, isActive: true, displayOrder: true } },
          // Solo el `sha256`: los bytes de la imagen se piden aparte, al servirla (`1.2.0`).
          image: { select: { sha256: true } },
        },
      },
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
    equipmentSlotVisualPosition: item.storeItem.equipmentSlot.visualPosition,
    equipmentSlotIsActive: item.storeItem.equipmentSlot.isActive,
    equipmentSlotDisplayOrder: item.storeItem.equipmentSlot.displayOrder,
    kpiCode: item.storeItem.kpiCode,
    kpiName: KPI_CATALOG[item.storeItem.kpiCode].name,
    bonusPercent: item.storeItem.bonusPercent,
    priceCredits: item.purchase.priceCreditsSnapshot,
    acquiredAt: item.acquiredAt,
    equipped: item.equipped !== null,
    equippedInSlotId: item.equipped?.equipmentSlotId ?? null,
    imageVersion: item.storeItem.image?.sha256 ?? null,
  }));
}
