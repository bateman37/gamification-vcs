import type { EquipmentVisualPosition } from "@prisma/client";
import { testDb } from "./db";
import { activateVisualPosition } from "@/server/services/equipment-slot.service";
import { getConfirmedLoadout, saveEquipmentLoadout } from "@/server/services/equipment.service";

/**
 * Ayudas compartidas de equipo para las pruebas (`1.2.0`).
 *
 * Desde `1.2.0` una ranura nueva solo nace al activar una posicion del
 * catalogo cerrado, y el equipo se confirma siempre como un conjunto completo
 * (`saveEquipmentLoadout`): ya no existen `createEquipmentSlot`,
 * `equipOwnedItem` ni `unequipSlot`.
 */

export function createSlot(splitId: string, position: EquipmentVisualPosition = "LEFT_HAND") {
  return activateVisualPosition(testDb, splitId, position);
}

/** Añade un objeto al equipo confirmado conservando el resto del conjunto. */
export async function equipItem(
  personId: string,
  splitParticipantId: string,
  equipmentSlotId: string,
  ownedItemId: string,
): Promise<void> {
  const current = await getConfirmedLoadout(testDb, splitParticipantId);
  const assignments = current.assignments
    .filter((assignment) => assignment.equipmentSlotId !== equipmentSlotId && assignment.ownedItemId !== ownedItemId)
    .concat({ equipmentSlotId, ownedItemId });
  await saveEquipmentLoadout(testDb, personId, splitParticipantId, assignments, current.revision);
}

/** Deja una ranura vacia conservando el resto del conjunto confirmado. */
export async function unequipSlotItem(
  personId: string,
  splitParticipantId: string,
  equipmentSlotId: string,
): Promise<void> {
  const current = await getConfirmedLoadout(testDb, splitParticipantId);
  await saveEquipmentLoadout(
    testDb,
    personId,
    splitParticipantId,
    current.assignments.filter((assignment) => assignment.equipmentSlotId !== equipmentSlotId),
    current.revision,
  );
}
