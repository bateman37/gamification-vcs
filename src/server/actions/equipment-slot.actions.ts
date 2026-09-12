"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import {
  createEquipmentSlot,
  deleteEquipmentSlot,
  renameEquipmentSlot,
  reorderEquipmentSlots,
} from "@/server/services/equipment-slot.service";
import { equipmentSlotFormSchema } from "@/server/validation/equipment-slot";
import { runAction, type ActionState } from "@/server/actions/action-result";

/**
 * Administracion de ranuras de equipo (`0.9.0` / MVP-2D, secciones 10-11 del
 * encargo). Solo `ADMIN`. El numero y el nombre de las ranuras los decide el
 * administrador: no hay ranuras codificadas.
 */

function revalidateEquipmentPaths(splitId: string) {
  revalidatePath(`/splits/${splitId}`);
  revalidatePath(`/splits/${splitId}/economia`);
  revalidatePath("/fichas");
}

function parseSlotForm(formData: FormData) {
  return equipmentSlotFormSchema.parse({ name: formData.get("name") });
}

export async function createEquipmentSlotAction(splitId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    const input = parseSlotForm(formData);
    await createEquipmentSlot(prisma, splitId, input);
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

export async function reorderEquipmentSlotsAction(
  splitId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    const orderedSlotIds = formData.getAll("slotId").map(String);
    await reorderEquipmentSlots(prisma, splitId, orderedSlotIds);
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
