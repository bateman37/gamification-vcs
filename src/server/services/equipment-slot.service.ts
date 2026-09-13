import type { EquipmentVisualPosition, Prisma, PrismaClient, SplitEquipmentSlot } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import type { EquipmentSlotFormInput } from "@/server/validation/equipment-slot";
import { getEconomySettings } from "@/server/services/economy.service";
import {
  EQUIPMENT_VISUAL_POSITIONS,
  MAX_PLACED_EQUIPMENT_SLOTS_PER_SPLIT,
  equipmentVisualPositionBaseName,
  equipmentVisualPositionOrder,
} from "@/domain/equipment-visual-positions";

/**
 * Ranuras de equipo de un split (`0.9.0` / MVP-2D, evolucionadas en `1.2.0`;
 * ver docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md).
 *
 * Desde `1.2.0` una ranura tiene tres conceptos distintos:
 *
 * - **identidad tecnica** (`id`): estable para siempre. Es lo unico que
 *   relaciona objetos, compras, inventario, equipo y snapshots publicados;
 * - **posicion visual** (`visualPosition`): una de las diez claves del
 *   catalogo cerrado, unica por split. Decide donde se dibuja, nunca a que
 *   objetos pertenece;
 * - **nombre visible** (`name`): renombrable sin mover la ranura ni romper
 *   ninguna relacion.
 *
 * Ya no existen ranuras arbitrarias nuevas: las unicas ranuras que nacen lo
 * hacen al activar una posicion del catalogo. Las ranuras creadas antes de
 * `1.2.0` sin posicion siguen existiendo, siendo legibles y equipables
 * (compatibilidad), hasta que el administrador las ubique.
 *
 * La estructura (activar, ubicar, renombrar, desactivar, eliminar) solo se
 * modifica con el mercado cerrado y el split no cerrado, igual que en
 * `0.9.0`.
 */

type Db = PrismaClient | Prisma.TransactionClient;

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

/**
 * Tope funcional de ranuras **ubicadas**: exactamente las diez posiciones del
 * catalogo. No es un limite sobre las filas existentes: una base historica
 * con mas ranuras sin ubicar sigue funcionando sin fallar ni truncarse.
 */
export const MAX_EQUIPMENT_SLOTS_PER_SPLIT = MAX_PLACED_EQUIPMENT_SLOTS_PER_SPLIT;

function normalizeSlotName(name: string): string {
  return name.trim().toLowerCase();
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === UNIQUE_CONSTRAINT_ERROR_CODE
  );
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

/**
 * Orden de presentacion unico: primero las ranuras ubicadas, por el orden fijo
 * del catalogo; despues las historicas sin ubicar, por su `displayOrder`.
 */
export function compareEquipmentSlotsForDisplay(
  a: Pick<SplitEquipmentSlot, "visualPosition" | "displayOrder" | "name">,
  b: Pick<SplitEquipmentSlot, "visualPosition" | "displayOrder" | "name">,
): number {
  const orderA = a.visualPosition === null ? 1000 + a.displayOrder : equipmentVisualPositionOrder(a.visualPosition);
  const orderB = b.visualPosition === null ? 1000 + b.displayOrder : equipmentVisualPositionOrder(b.visualPosition);
  return orderA - orderB || a.name.localeCompare(b.name);
}

export async function listEquipmentSlotsForSplit(db: Db, splitId: string): Promise<SplitEquipmentSlot[]> {
  const slots = await db.splitEquipmentSlot.findMany({ where: { splitId } });
  return slots.sort(compareEquipmentSlotsForDisplay);
}

export interface EquipmentSlotWithUsage extends SplitEquipmentSlot {
  /** Objetos del catalogo asociados a la ranura (a la venta o no). */
  storeItemCount: number;
  /** Objetos de la ranura todavia marcados `A la venta`. Bloquean la desactivacion. */
  itemsForSaleCount: number;
  /** Participantes que poseen algun objeto de esta ranura (comprado, este equipado o no). */
  ownerCount: number;
  /** Participantes con un objeto equipado ahora mismo en esta ranura. Bloquean la desactivacion. */
  equippedCount: number;
}

/**
 * Todas las ranuras del split con sus contadores de uso, con un numero
 * acotado de consultas para todo el split (nunca una por ranura).
 */
export async function listEquipmentSlotsWithUsageForSplit(db: Db, splitId: string): Promise<EquipmentSlotWithUsage[]> {
  const [slots, storeItems] = await Promise.all([
    db.splitEquipmentSlot.findMany({ where: { splitId } }),
    db.splitStoreItem.findMany({ where: { splitId }, select: { id: true, equipmentSlotId: true, isForSale: true } }),
  ]);

  const slotIds = slots.map((slot) => slot.id);
  const storeItemIds = storeItems.map((item) => item.id);

  const [equippedGroups, ownedGroups] = await Promise.all([
    slotIds.length === 0
      ? Promise.resolve([] as { equipmentSlotId: string; _count: { _all: number } }[])
      : db.splitParticipantEquippedItem.groupBy({
          by: ["equipmentSlotId"],
          where: { equipmentSlotId: { in: slotIds } },
          _count: { _all: true },
        }),
    storeItemIds.length === 0
      ? Promise.resolve([] as { storeItemId: string; _count: { _all: number } }[])
      : db.splitParticipantItem.groupBy({
          by: ["storeItemId"],
          where: { storeItemId: { in: storeItemIds } },
          _count: { _all: true },
        }),
  ]);

  const equippedBySlot = new Map(equippedGroups.map((group) => [group.equipmentSlotId, group._count._all]));
  const ownedByStoreItem = new Map(ownedGroups.map((group) => [group.storeItemId, group._count._all]));

  const storeItemCountBySlot = new Map<string, number>();
  const forSaleCountBySlot = new Map<string, number>();
  const ownerCountBySlot = new Map<string, number>();
  for (const item of storeItems) {
    storeItemCountBySlot.set(item.equipmentSlotId, (storeItemCountBySlot.get(item.equipmentSlotId) ?? 0) + 1);
    if (item.isForSale) {
      forSaleCountBySlot.set(item.equipmentSlotId, (forSaleCountBySlot.get(item.equipmentSlotId) ?? 0) + 1);
    }
    const owned = ownedByStoreItem.get(item.id) ?? 0;
    if (owned > 0) ownerCountBySlot.set(item.equipmentSlotId, (ownerCountBySlot.get(item.equipmentSlotId) ?? 0) + owned);
  }

  return slots
    .map((slot) => ({
      ...slot,
      storeItemCount: storeItemCountBySlot.get(slot.id) ?? 0,
      itemsForSaleCount: forSaleCountBySlot.get(slot.id) ?? 0,
      ownerCount: ownerCountBySlot.get(slot.id) ?? 0,
      equippedCount: equippedBySlot.get(slot.id) ?? 0,
    }))
    .sort(compareEquipmentSlotsForDisplay);
}

/**
 * Alias de los participantes que bloquean la desactivacion de una ranura
 * (seccion 6.6 del encargo). Solo se consulta cuando hay que explicar el
 * bloqueo: nunca se desequipa a nadie automaticamente.
 */
export async function listParticipantsBlockingSlotDeactivation(
  db: Db,
  splitId: string,
  slotId: string,
): Promise<string[]> {
  const rows = await db.splitParticipantEquippedItem.findMany({
    where: { equipmentSlotId: slotId, splitParticipant: { splitId } },
    select: { splitParticipant: { select: { alias: true } } },
  });
  return rows.map((row) => row.splitParticipant.alias).sort((a, b) => a.localeCompare(b));
}

/**
 * Activa una posicion visual todavia libre creando su ranura, con el nombre
 * base del catalogo como nombre inicial (seccion 6.3 del encargo). Si ese
 * nombre choca con una ranura historica, no se inventa ningun sufijo en
 * silencio: se explica el conflicto y se ofrece asociar la ranura existente.
 */
export async function activateVisualPosition(
  db: PrismaClient,
  splitId: string,
  position: EquipmentVisualPosition,
): Promise<SplitEquipmentSlot> {
  return db.$transaction(async (tx) => {
    await assertSlotsAreEditable(tx, splitId);

    const existingAtPosition = await tx.splitEquipmentSlot.findFirst({ where: { splitId, visualPosition: position } });
    if (existingAtPosition) {
      if (!existingAtPosition.isActive) {
        // Reactivar una posicion ya ubicada es un cambio de estado, no una ranura nueva.
        return tx.splitEquipmentSlot.update({ where: { id: existingAtPosition.id }, data: { isActive: true } });
      }
      throw new DomainError(`La posicion "${equipmentVisualPositionBaseName(position)}" ya tiene una ranura en este split.`);
    }

    const baseName = equipmentVisualPositionBaseName(position);
    const clash = await tx.splitEquipmentSlot.findFirst({
      where: { splitId, nameNormalized: normalizeSlotName(baseName) },
    });
    if (clash) {
      throw new DomainError(
        `Ya existe una ranura llamada "${clash.name}" en este split. Asociala a la posicion "${baseName}" o renombrala antes de activar la posicion.`,
      );
    }

    const maxOrder = await tx.splitEquipmentSlot.aggregate({ where: { splitId }, _max: { displayOrder: true } });

    try {
      return await tx.splitEquipmentSlot.create({
        data: {
          splitId,
          name: baseName,
          nameNormalized: normalizeSlotName(baseName),
          displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
          visualPosition: position,
          isActive: true,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new DomainError("Esa posicion o ese nombre ya estan ocupados en este split.");
      }
      throw error;
    }
  });
}

/**
 * Asocia una ranura historica sin ubicar a una posicion visual libre
 * (seccion 6.5 del encargo). Cambia **unicamente** su ubicacion visual: el
 * `id` no cambia, asi que todos sus objetos, compras, inventarios, equipos y
 * snapshots siguen exactamente igual. Nunca se toca el `equipmentSlotId` de
 * un objeto comprado para conseguir este resultado.
 */
export async function assignVisualPositionToSlot(
  db: PrismaClient,
  splitId: string,
  slotId: string,
  position: EquipmentVisualPosition,
): Promise<SplitEquipmentSlot> {
  return db.$transaction(async (tx) => {
    await assertSlotsAreEditable(tx, splitId);

    const slot = await tx.splitEquipmentSlot.findUnique({ where: { id: slotId } });
    if (!slot || slot.splitId !== splitId) {
      throw new DomainError("La ranura indicada no existe en este split.");
    }
    if (slot.visualPosition !== null) {
      throw new DomainError(`La ranura "${slot.name}" ya esta ubicada. Libera antes su posicion actual.`);
    }

    const occupied = await tx.splitEquipmentSlot.findFirst({ where: { splitId, visualPosition: position } });
    if (occupied) {
      throw new DomainError(
        `La posicion "${equipmentVisualPositionBaseName(position)}" ya la ocupa la ranura "${occupied.name}".`,
      );
    }

    try {
      return await tx.splitEquipmentSlot.update({ where: { id: slotId }, data: { visualPosition: position } });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new DomainError("Esa posicion visual ya esta ocupada en este split.");
      }
      throw error;
    }
  });
}

/** Renombra una ranura. Solo cambia el texto visible: `id`, posicion y relaciones siguen intactos. */
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
      if (isUniqueConstraintError(error)) {
        throw new DomainError("Ya existe una ranura con ese nombre en este split.", "name");
      }
      throw error;
    }
  });
}

/**
 * Activa o desactiva una ranura (seccion 6.6 del encargo). Desactivar es un
 * cambio de estado, nunca un borrado: conserva objetos, compras, inventario y
 * publicaciones, y **jamas** desequipa ni retira nada automaticamente.
 *
 * Solo se permite desactivar si ningun participante tiene un objeto equipado
 * en esa ranura y si ninguno de sus objetos sigue a la venta.
 */
export async function setEquipmentSlotActive(
  db: PrismaClient,
  splitId: string,
  slotId: string,
  isActive: boolean,
): Promise<SplitEquipmentSlot> {
  return db.$transaction(async (tx) => {
    await assertSlotsAreEditable(tx, splitId);
    const slot = await tx.splitEquipmentSlot.findUnique({ where: { id: slotId } });
    if (!slot || slot.splitId !== splitId) {
      throw new DomainError("La ranura indicada no existe en este split.");
    }
    if (slot.isActive === isActive) return slot;

    if (!isActive) {
      const blockers = await listParticipantsBlockingSlotDeactivation(tx, splitId, slotId);
      if (blockers.length > 0) {
        throw new DomainError(
          `No se puede desactivar la ranura "${slot.name}": ${blockers.length} participante${
            blockers.length === 1 ? "" : "s"
          } tiene${blockers.length === 1 ? "" : "n"} un objeto equipado en ella (${blockers.join(", ")}). Nadie se desequipa automaticamente: pideles que la dejen vacia antes.`,
        );
      }

      const forSale = await tx.splitStoreItem.count({ where: { splitId, equipmentSlotId: slotId, isForSale: true } });
      if (forSale > 0) {
        throw new DomainError(
          `No se puede desactivar la ranura "${slot.name}": todavia tiene ${forSale} objeto${
            forSale === 1 ? "" : "s"
          } a la venta. Retiralos de la venta o muevelos a otra ranura primero.`,
        );
      }
    }

    return tx.splitEquipmentSlot.update({ where: { id: slotId }, data: { isActive } });
  });
}

/**
 * Eliminacion fisica, conservada solo para una ranura realmente vacia y sin
 * referencias (seccion 6.8 del encargo). La operacion habitual pasa a ser
 * desactivar/reactivar.
 */
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

export interface VisualPositionBoardEntry {
  position: EquipmentVisualPosition;
  baseName: string;
  row: number;
  column: number;
  order: number;
  slot: EquipmentSlotWithUsage | null;
}

export interface EquipmentSlotBoard {
  /** Las diez posiciones del catalogo, siempre completas: libres, activas o inactivas. */
  positions: VisualPositionBoardEntry[];
  /** Ranuras historicas todavia sin ubicar. Vacio en un split creado desde `1.2.0`. */
  unplacedSlots: EquipmentSlotWithUsage[];
}

/**
 * Composicion administrativa completa: las diez posiciones del catalogo (con
 * su ranura si la tienen) mas las ranuras historicas pendientes de ubicar.
 * La presencia de pendientes es un aviso, nunca un error global.
 */
export async function getEquipmentSlotBoard(db: Db, splitId: string): Promise<EquipmentSlotBoard> {
  const slots = await listEquipmentSlotsWithUsageForSplit(db, splitId);
  const byPosition = new Map(slots.filter((slot) => slot.visualPosition !== null).map((slot) => [slot.visualPosition!, slot]));

  return {
    positions: EQUIPMENT_VISUAL_POSITIONS.map((definition) => ({
      position: definition.position,
      baseName: definition.baseName,
      row: definition.row,
      column: definition.column,
      order: definition.order,
      slot: byPosition.get(definition.position) ?? null,
    })),
    unplacedSlots: slots.filter((slot) => slot.visualPosition === null),
  };
}
