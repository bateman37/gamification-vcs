import { Prisma, type EquipmentVisualPosition, type PrismaClient } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { KPI_CATALOG, type KpiCode } from "@/domain/kpis/catalog";
import type { EquippedItemForBonus } from "@/domain/equipment-bonus";
import {
  computeLoadoutRevision,
  normalizeLoadoutAssignments,
  validateLoadoutAssignments,
  type LoadoutAssignment,
} from "@/domain/equipment-loadout";
import { MAX_PLACED_EQUIPMENT_SLOTS_PER_SPLIT } from "@/domain/equipment-visual-positions";
import { compareEquipmentSlotsForDisplay } from "@/server/services/equipment-slot.service";

/**
 * Equipo del participante (`0.9.0` / MVP-2D, evolucionado en `1.2.0`; ver
 * docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md).
 *
 * La fuente de verdad persistida sigue siendo `SplitParticipantEquippedItem`.
 * `1.2.0` sustituye las acciones inmediatas de equipar/desequipar por un
 * **borrador en cliente** y un unico guardado atomico del conjunto completo
 * (`saveEquipmentLoadout`): arrastrar o seleccionar un objeto no persiste
 * nada, y un borrador sin confirmar nunca afecta a previsualizaciones,
 * calculos, creditos ni publicaciones.
 *
 * La verdad definitiva de una semana sigue siendo el equipo que `publishWeek`
 * vuelve a leer dentro de su propia transaccion serializable en el instante
 * de publicar.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Tope tecnico de filas aceptadas en una confirmacion. Se toma el mayor entre
 * el catalogo de posiciones y las ranuras historicas realmente existentes: una
 * base anterior a `1.2.0` con mas ranuras sin ubicar nunca debe fallar por
 * superar el numero.
 */
function maxAssignmentsFor(slotCount: number): number {
  return Math.max(MAX_PLACED_EQUIPMENT_SLOTS_PER_SPLIT, slotCount);
}

export interface EquippedSlotView {
  equipmentSlotId: string;
  equipmentSlotName: string;
  displayOrder: number;
  /** Posicion del catalogo cerrado, o `null` en una ranura historica sin ubicar. */
  visualPosition: EquipmentVisualPosition | null;
  /** Una ranura inactiva no admite equipo nuevo, pero conserva el que ya tuviera. */
  isActive: boolean;
  equippedItem: {
    ownedItemId: string;
    storeItemId: string;
    itemName: string;
    kpiCode: KpiCode;
    kpiName: string;
    bonusPercent: number;
    /** `sha256` de la imagen del objeto, o `null`. Nunca los bytes. */
    imageVersion: string | null;
  } | null;
}

/** Todas las ranuras del split con el objeto equipado en cada una (o vacia), en su orden visual. */
export async function listEquipmentForParticipant(db: Db, splitParticipantId: string, splitId: string): Promise<EquippedSlotView[]> {
  const [slots, equipped] = await Promise.all([
    db.splitEquipmentSlot.findMany({ where: { splitId } }),
    db.splitParticipantEquippedItem.findMany({
      where: { splitParticipantId },
      include: {
        ownedItem: {
          include: {
            // `image: { select: { sha256: true } }` a proposito: los bytes nunca se cargan en un listado.
            storeItem: { include: { image: { select: { sha256: true } } } },
          },
        },
      },
    }),
  ]);
  const equippedBySlot = new Map(equipped.map((row) => [row.equipmentSlotId, row]));

  return slots.sort(compareEquipmentSlotsForDisplay).map((slot) => {
    const row = equippedBySlot.get(slot.id);
    return {
      equipmentSlotId: slot.id,
      equipmentSlotName: slot.name,
      displayOrder: slot.displayOrder,
      visualPosition: slot.visualPosition,
      isActive: slot.isActive,
      equippedItem: row
        ? {
            ownedItemId: row.ownedItemId,
            storeItemId: row.ownedItem.storeItemId,
            itemName: row.ownedItem.storeItem.name,
            kpiCode: row.ownedItem.storeItem.kpiCode,
            kpiName: KPI_CATALOG[row.ownedItem.storeItem.kpiCode].name,
            bonusPercent: row.ownedItem.storeItem.bonusPercent,
            imageVersion: row.ownedItem.storeItem.image?.sha256 ?? null,
          }
        : null,
    };
  });
}

/** Conjunto confirmado en servidor y su revision estable, para poder detectar conflictos entre pestañas. */
export interface ConfirmedLoadout {
  assignments: LoadoutAssignment[];
  revision: string;
}

export async function getConfirmedLoadout(db: Db, splitParticipantId: string): Promise<ConfirmedLoadout> {
  const rows = await db.splitParticipantEquippedItem.findMany({
    where: { splitParticipantId },
    select: { equipmentSlotId: true, ownedItemId: true },
  });
  const assignments = normalizeLoadoutAssignments(rows);
  return { assignments, revision: computeLoadoutRevision(assignments) };
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
    throw new DomainError("Solo se puede cambiar el equipo mientras el split esta activo.");
  }
  return participant;
}

export interface SaveEquipmentLoadoutResult {
  revision: string;
  assignments: LoadoutAssignment[];
}

/**
 * Guardado atomico del conjunto completo de equipo (seccion 9.6 del
 * encargo). Sustituye por completo el equipo confirmado del participante
 * dentro de una unica transaccion serializable.
 *
 * Nunca acepta del navegador un `personId`, un bonus, un KPI, un precio ni un
 * nombre: la identidad se resuelve desde la sesion (el llamador) y todo lo
 * demas se relee aqui. Todas las reglas del borrador se vuelven a comprobar
 * en servidor, aunque el cliente ya las haya aplicado por experiencia de uso.
 *
 * `expectedRevision` implementa el control de concurrencia: si el equipo
 * confirmado ha cambiado desde que se cargo la ficha (otra pestaña), no se
 * guarda nada y no se mezclan estados automaticamente.
 */
export async function saveEquipmentLoadout(
  db: PrismaClient,
  personId: string,
  splitParticipantId: string,
  assignments: readonly LoadoutAssignment[],
  expectedRevision: string | null,
): Promise<SaveEquipmentLoadoutResult> {
  return db.$transaction(
    async (tx) => {
      const participant = await assertParticipantCanManageEquipment(tx, personId, splitParticipantId);

      const [slots, ownedItems, current] = await Promise.all([
        tx.splitEquipmentSlot.findMany({
          where: { splitId: participant.splitId },
          select: { id: true, isActive: true, name: true },
        }),
        tx.splitParticipantItem.findMany({
          where: { splitParticipantId },
          select: { id: true, storeItem: { select: { equipmentSlotId: true, splitId: true } } },
        }),
        getConfirmedLoadout(tx, splitParticipantId),
      ]);

      if (expectedRevision !== null && expectedRevision !== current.revision) {
        throw new DomainError("Tu equipo ha cambiado en otra sesion. Recarga la ficha antes de confirmar.");
      }

      const issues = validateLoadoutAssignments(assignments, {
        activeSlotIds: slots.filter((slot) => slot.isActive).map((slot) => slot.id),
        knownSlotIds: slots.map((slot) => slot.id),
        // Un objeto solo se considera poseido si ademas su objeto de catalogo pertenece al mismo split
        // que la participacion: nunca se equipa algo de otro split aunque llegue un id valido.
        ownedItems: ownedItems
          .filter((item) => item.storeItem.splitId === participant.splitId)
          .map((item) => ({ ownedItemId: item.id, equipmentSlotId: item.storeItem.equipmentSlotId })),
        maxAssignments: maxAssignmentsFor(slots.length),
      });
      if (issues.length > 0) {
        throw new DomainError(issues[0]!.message);
      }

      const normalized = normalizeLoadoutAssignments(assignments);

      // Sustitucion completa: el conjunto anterior desaparece y el nuevo se escribe entero
      // dentro de la misma transaccion. Una confirmacion invalida nunca deja equipo a medias.
      await tx.splitParticipantEquippedItem.deleteMany({ where: { splitParticipantId } });
      if (normalized.length > 0) {
        await tx.splitParticipantEquippedItem.createMany({
          data: normalized.map((assignment) => ({
            splitParticipantId,
            equipmentSlotId: assignment.equipmentSlotId,
            ownedItemId: assignment.ownedItemId,
          })),
        });
      }

      return { revision: computeLoadoutRevision(normalized), assignments: normalized };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/**
 * Equipo vivo de varios participantes a la vez, listo para
 * `applyEquipmentBonuses` (usado por `weekly-results.service.ts`, tanto en
 * previsualizacion como dentro de la transaccion de `publishWeek`). Una sola
 * consulta para todos los participantes indicados: nunca N+1 por KPI ni por
 * participante.
 *
 * Deliberadamente lee el equipo **confirmado y persistido**, sin filtrar por
 * `isActive`: desactivar una ranura nunca desequipa a nadie, y un objeto
 * legitimamente equipado antes de la desactivacion sigue contando hasta que
 * su dueño lo retire (seccion 6.6 del encargo). Por eso desactivar exige que
 * la ranura este vacia.
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
