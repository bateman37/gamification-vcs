import type { Prisma, PrismaClient, SplitStoreItem } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import type { KpiCode } from "@/domain/kpis/catalog";
import type { StoreItemFormInput } from "@/server/validation/store-item";
import { getEconomySettings } from "@/server/services/economy.service";

/**
 * Catalogo de objetos de un split (`0.9.0` / MVP-2D, ver
 * docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md, secciones 12-14 del encargo). Sin
 * catalogo global ni objetos predeterminados: cada objeto lo crea el
 * administrador para un split concreto. Solo se administra con el mercado
 * cerrado; despues de la primera compra, un objeto queda inmutable en
 * nombre, descripcion, ranura, KPI, porcentaje y precio.
 */

type Db = PrismaClient | Prisma.TransactionClient;

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

function normalizeItemName(name: string): string {
  return name.trim().toLowerCase();
}

async function assertItemsAreEditable(db: Db, splitId: string): Promise<void> {
  const split = await db.split.findUnique({ where: { id: splitId } });
  if (!split) throw new DomainError("El split indicado no existe.");
  if (split.status === "CLOSED") {
    throw new DomainError("No se pueden modificar los objetos de un split cerrado.");
  }
  const settings = await getEconomySettings(db, splitId);
  if (settings.marketStatus === "OPEN") {
    throw new DomainError("Cierra el mercado antes de modificar el catalogo de objetos.");
  }
}

export interface StoreItemWithUsage extends SplitStoreItem {
  equipmentSlotName: string;
  ownedCount: number;
}

export async function listStoreItemsForSplit(db: Db, splitId: string): Promise<StoreItemWithUsage[]> {
  const items = await db.splitStoreItem.findMany({
    where: { splitId },
    include: { equipmentSlot: { select: { name: true } }, _count: { select: { ownedItems: true } } },
    orderBy: { createdAt: "asc" },
  });
  return items.map(({ equipmentSlot, _count, ...item }) => ({
    ...item,
    equipmentSlotName: equipmentSlot.name,
    ownedCount: _count.ownedItems,
  }));
}

/** Objetos disponibles para comprar (`isForSale`), con su ranura, para el catalogo del participante. */
export async function listStoreItemsForSale(db: Db, splitId: string): Promise<StoreItemWithUsage[]> {
  return (await listStoreItemsForSplit(db, splitId)).filter((item) => item.isForSale);
}

async function resolveSlotAndKpiOrThrow(
  db: Db,
  splitId: string,
  equipmentSlotId: string,
  kpiCode: KpiCode,
): Promise<void> {
  const slot = await db.splitEquipmentSlot.findUnique({ where: { id: equipmentSlotId } });
  if (!slot || slot.splitId !== splitId) {
    throw new DomainError("La ranura seleccionada no pertenece a este split.", "equipmentSlotId");
  }
  const kpiConfig = await db.splitKpiConfig.findUnique({ where: { splitId_kpiCode: { splitId, kpiCode } } });
  if (!kpiConfig || !kpiConfig.isActive) {
    throw new DomainError('El KPI seleccionado no esta activo en este split. Activalo antes en "KPI del split".', "kpiCode");
  }
}

export async function createStoreItem(db: PrismaClient, splitId: string, input: StoreItemFormInput): Promise<SplitStoreItem> {
  return db.$transaction(async (tx) => {
    await assertItemsAreEditable(tx, splitId);
    await resolveSlotAndKpiOrThrow(tx, splitId, input.equipmentSlotId, input.kpiCode);

    try {
      return await tx.splitStoreItem.create({
        data: {
          splitId,
          name: input.name.trim(),
          nameNormalized: normalizeItemName(input.name),
          description: input.description ?? null,
          priceCredits: input.priceCredits,
          equipmentSlotId: input.equipmentSlotId,
          kpiCode: input.kpiCode,
          bonusPercent: input.bonusPercent,
          isForSale: true,
        },
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === UNIQUE_CONSTRAINT_ERROR_CODE) {
        throw new DomainError("Ya existe un objeto con ese nombre en este split.", "name");
      }
      throw error;
    }
  });
}

async function getItemWithOwnedCountOrThrow(db: Db, splitId: string, itemId: string) {
  const item = await db.splitStoreItem.findUnique({ where: { id: itemId }, include: { _count: { select: { ownedItems: true } } } });
  if (!item || item.splitId !== splitId) {
    throw new DomainError("El objeto indicado no existe en este split.");
  }
  return item;
}

/**
 * Edita un objeto. Antes de su primera compra puede cambiarse cualquier
 * campo (seccion 13 del encargo); despues de que alguien lo haya comprado,
 * el nombre, la descripcion, la ranura, el KPI y el porcentaje quedan
 * congelados para no alterar en silencio un objeto ya pagado. El precio
 * tampoco puede subirse ni bajarse retroactivamente una vez comprado.
 */
export async function updateStoreItem(
  db: PrismaClient,
  splitId: string,
  itemId: string,
  input: StoreItemFormInput,
): Promise<SplitStoreItem> {
  return db.$transaction(async (tx) => {
    await assertItemsAreEditable(tx, splitId);
    const existing = await getItemWithOwnedCountOrThrow(tx, splitId, itemId);
    if (existing._count.ownedItems > 0) {
      throw new DomainError(
        "Este objeto ya ha sido comprado por algun participante: no se puede editar. Retiralo de la venta o crea un objeto nuevo si necesitas una variante distinta.",
      );
    }
    await resolveSlotAndKpiOrThrow(tx, splitId, input.equipmentSlotId, input.kpiCode);

    try {
      return await tx.splitStoreItem.update({
        where: { id: itemId },
        data: {
          name: input.name.trim(),
          nameNormalized: normalizeItemName(input.name),
          description: input.description ?? null,
          priceCredits: input.priceCredits,
          equipmentSlotId: input.equipmentSlotId,
          kpiCode: input.kpiCode,
          bonusPercent: input.bonusPercent,
        },
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === UNIQUE_CONSTRAINT_ERROR_CODE) {
        throw new DomainError("Ya existe un objeto con ese nombre en este split.", "name");
      }
      throw error;
    }
  });
}

/** Retira (o repone) un objeto de la venta. Quien ya lo posee lo conserva y puede seguir equipandolo (seccion 13). */
export async function setStoreItemForSale(db: PrismaClient, splitId: string, itemId: string, isForSale: boolean): Promise<SplitStoreItem> {
  return db.$transaction(async (tx) => {
    await assertItemsAreEditable(tx, splitId);
    await getItemWithOwnedCountOrThrow(tx, splitId, itemId);
    return tx.splitStoreItem.update({ where: { id: itemId }, data: { isForSale } });
  });
}

export async function deleteStoreItem(db: PrismaClient, splitId: string, itemId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await assertItemsAreEditable(tx, splitId);
    const existing = await getItemWithOwnedCountOrThrow(tx, splitId, itemId);
    if (existing._count.ownedItems > 0) {
      throw new DomainError("No se puede eliminar un objeto que ya ha comprado algun participante.");
    }
    await tx.splitStoreItem.delete({ where: { id: itemId } });
  });
}

export interface StoreItemUsingKpi {
  itemName: string;
  isForSale: boolean;
  ownedCount: number;
}

/**
 * Objetos existentes (a la venta, comprados o equipados) que potencian el
 * KPI indicado (seccion 14 del encargo). Un objeto ya retirado de la venta y
 * sin ningun propietario no bloquea la desactivacion: puede eliminarse en su
 * lugar. Usado para impedir desactivar un KPI en uso, identificando los
 * objetos afectados en el mensaje.
 */
export async function findStoreItemsUsingKpi(db: Db, splitId: string, kpiCode: KpiCode): Promise<StoreItemUsingKpi[]> {
  const items = await db.splitStoreItem.findMany({
    where: { splitId, kpiCode },
    include: { _count: { select: { ownedItems: true } } },
  });
  return items
    .filter((item) => item.isForSale || item._count.ownedItems > 0)
    .map((item) => ({ itemName: item.name, isForSale: item.isForSale, ownedCount: item._count.ownedItems }));
}
