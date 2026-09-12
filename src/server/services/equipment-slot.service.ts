import type { Prisma, PrismaClient, SplitEquipmentSlot } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import type { EquipmentSlotFormInput } from "@/server/validation/equipment-slot";
import { getEconomySettings } from "@/server/services/economy.service";

/**
 * Ranuras de equipo de un split (`0.9.0` / MVP-2D, ver
 * docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md, seccion 10-11 del encargo). El
 * numero y el nombre los decide siempre el administrador: no hay ranuras
 * codificadas. Solo se pueden crear, renombrar, reordenar o eliminar
 * mientras el mercado esta cerrado y el split no esta cerrado.
 */

type Db = PrismaClient | Prisma.TransactionClient;

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

/** Limite tecnico razonable para evitar abuso accidental de la interfaz (seccion 11 del encargo). No es un limite funcional de 3. */
export const MAX_EQUIPMENT_SLOTS_PER_SPLIT = 12;

function normalizeSlotName(name: string): string {
  return name.trim().toLowerCase();
}

async function assertSlotsAreEditable(db: Db, splitId: string): Promise<void> {
  const split = await db.split.findUnique({ where: { id: splitId } });
  if (!split) throw new DomainError("El split indicado no existe.");
  if (split.status === "CLOSED") {
    throw new DomainError("No se pueden modificar las ranuras de equipo de un split cerrado.");
  }
  const settings = await getEconomySettings(db, splitId);
  if (settings.marketStatus === "OPEN") {
    throw new DomainError("Cierra el mercado antes de modificar la estructura de ranuras de equipo.");
  }
}

export async function listEquipmentSlotsForSplit(db: Db, splitId: string): Promise<SplitEquipmentSlot[]> {
  return db.splitEquipmentSlot.findMany({ where: { splitId }, orderBy: { displayOrder: "asc" } });
}

export interface EquipmentSlotWithUsage extends SplitEquipmentSlot {
  storeItemCount: number;
}

export async function listEquipmentSlotsWithUsageForSplit(db: Db, splitId: string): Promise<EquipmentSlotWithUsage[]> {
  const slots = await db.splitEquipmentSlot.findMany({
    where: { splitId },
    include: { _count: { select: { storeItems: true } } },
    orderBy: { displayOrder: "asc" },
  });
  return slots.map(({ _count, ...slot }) => ({ ...slot, storeItemCount: _count.storeItems }));
}

export async function createEquipmentSlot(
  db: PrismaClient,
  splitId: string,
  input: EquipmentSlotFormInput,
): Promise<SplitEquipmentSlot> {
  return db.$transaction(async (tx) => {
    await assertSlotsAreEditable(tx, splitId);
    const count = await tx.splitEquipmentSlot.count({ where: { splitId } });
    if (count >= MAX_EQUIPMENT_SLOTS_PER_SPLIT) {
      throw new DomainError(`No se pueden crear mas de ${MAX_EQUIPMENT_SLOTS_PER_SPLIT} ranuras en un mismo split.`);
    }
    const maxOrder = await tx.splitEquipmentSlot.aggregate({ where: { splitId }, _max: { displayOrder: true } });

    try {
      return await tx.splitEquipmentSlot.create({
        data: {
          splitId,
          name: input.name.trim(),
          nameNormalized: normalizeSlotName(input.name),
          displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
        },
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === UNIQUE_CONSTRAINT_ERROR_CODE) {
        throw new DomainError("Ya existe una ranura con ese nombre en este split.", "name");
      }
      throw error;
    }
  });
}

export async function renameEquipmentSlot(
  db: PrismaClient,
  splitId: string,
  slotId: string,
  input: EquipmentSlotFormInput,
): Promise<SplitEquipmentSlot> {
  return db.$transaction(async (tx) => {
    await assertSlotsAreEditable(tx, splitId);
    const existing = await tx.splitEquipmentSlot.findUnique({ where: { id: slotId } });
    if (!existing || existing.splitId !== splitId) {
      throw new DomainError("La ranura indicada no existe en este split.");
    }

    try {
      return await tx.splitEquipmentSlot.update({
        where: { id: slotId },
        data: { name: input.name.trim(), nameNormalized: normalizeSlotName(input.name) },
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === UNIQUE_CONSTRAINT_ERROR_CODE) {
        throw new DomainError("Ya existe una ranura con ese nombre en este split.", "name");
      }
      throw error;
    }
  });
}

/** Reordena todas las ranuras del split segun la lista de ids recibida (orden completo, sin huecos). */
export async function reorderEquipmentSlots(db: PrismaClient, splitId: string, orderedSlotIds: string[]): Promise<void> {
  await db.$transaction(async (tx) => {
    await assertSlotsAreEditable(tx, splitId);
    const slots = await tx.splitEquipmentSlot.findMany({ where: { splitId } });
    const existingIds = new Set(slots.map((slot) => slot.id));
    if (orderedSlotIds.length !== slots.length || !orderedSlotIds.every((id) => existingIds.has(id))) {
      throw new DomainError("La lista de ranuras enviada no coincide con las ranuras existentes de este split.");
    }
    for (const [index, slotId] of orderedSlotIds.entries()) {
      await tx.splitEquipmentSlot.update({ where: { id: slotId }, data: { displayOrder: index } });
    }
  });
}

export async function deleteEquipmentSlot(db: PrismaClient, splitId: string, slotId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await assertSlotsAreEditable(tx, splitId);
    const slot = await tx.splitEquipmentSlot.findUnique({
      where: { id: slotId },
      include: { _count: { select: { storeItems: true, equippedItems: true, publishedEquippedItems: true } } },
    });
    if (!slot || slot.splitId !== splitId) {
      throw new DomainError("La ranura indicada no existe en este split.");
    }
    if (slot._count.storeItems > 0) {
      throw new DomainError(`No se puede eliminar la ranura "${slot.name}": tiene objetos del catalogo asociados.`);
    }
    if (slot._count.equippedItems > 0) {
      throw new DomainError(`No se puede eliminar la ranura "${slot.name}": algun participante tiene un objeto equipado en ella.`);
    }
    if (slot._count.publishedEquippedItems > 0) {
      throw new DomainError(`No se puede eliminar la ranura "${slot.name}": tiene referencias en semanas ya publicadas.`);
    }

    await tx.splitEquipmentSlot.delete({ where: { id: slotId } });
  });
}
