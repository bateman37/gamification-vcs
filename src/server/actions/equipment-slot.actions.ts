"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { DomainError } from "@/lib/errors";
import {
  activateVisualPosition,
  assignVisualPositionToSlot,
  deleteEquipmentSlot,
  renameEquipmentSlot,
  setEquipmentSlotActive,
} from "@/server/services/equipment-slot.service";
import { parseEquipmentVisualPosition } from "@/domain/equipment-visual-positions";
import { equipmentSlotFormSchema } from "@/server/validation/equipment-slot";
import { runAction, type ActionState } from "@/server/actions/action-result";

/**
 * Administracion de ranuras de equipo (`0.9.0` / MVP-2D, evolucionada en
 * `1.2.0`). Solo `ADMIN`. Desde `1.2.0` no existe la creacion de ranuras
 * arbitrarias: una ranura nueva solo nace al activar una de las diez
 * posiciones del catalogo cerrado, y la clave de posicion nunca se acepta
 * libre (se valida contra el catalogo, ademas de la restriccion de base de
 * datos).
 */

function revalidateEquipmentPaths(splitId: string) {
  revalidatePath(`/splits/${splitId}`);
  revalidatePath(`/splits/${splitId}/economia`);
  revalidatePath("/fichas");
}

function parseSlotForm(formData: FormData) {
  return equipmentSlotFormSchema.parse({ name: formData.get("name") });
}

function parsePositionOrThrow(formData: FormData) {
  const position = parseEquipmentVisualPosition(formData.get("visualPosition"));
  if (!position) {
    throw new DomainError("La posición indicada no pertenece al catálogo de posiciones del tablero.");
  }
  return position;
}

/** Activa una posicion visual libre creando su ranura con el nombre base del catalogo. */
export async function activateVisualPositionAction(
  splitId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    await activateVisualPosition(prisma, splitId, parsePositionOrThrow(formData));
    revalidateEquipmentPaths(splitId);
  });
}

/**
 * Asocia una ranura historica sin ubicar a una posicion visual libre. Solo
 * cambia su ubicacion visual: objetos, inventarios, equipos y snapshots se
 * conservan porque la identidad es el `slotId`.
 */
export async function assignVisualPositionAction(
  splitId: string,
  slotId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    await assignVisualPositionToSlot(prisma, splitId, slotId, parsePositionOrThrow(formData));
    revalidateEquipmentPaths(splitId);
  });
}

export async function renameEquipmentSlotAction(
  splitId: string,
  slotId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    const input = parseSlotForm(formData);
    await renameEquipmentSlot(prisma, splitId, slotId, input);
    revalidateEquipmentPaths(splitId);
  });
}

/** Activa o desactiva una ranura. Desactivar nunca desequipa ni retira nada automaticamente. */
export async function setEquipmentSlotActiveAction(
  splitId: string,
  slotId: string,
  isActive: boolean,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    await setEquipmentSlotActive(prisma, splitId, slotId, isActive);
    revalidateEquipmentPaths(splitId);
  });
}

export async function deleteEquipmentSlotAction(
  splitId: string,
  slotId: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    await deleteEquipmentSlot(prisma, splitId, slotId);
    revalidateEquipmentPaths(splitId);
  });
}
