"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import {
  createStoreItem,
  deleteStoreItem,
  setStoreItemForSale,
  updateStoreItem,
} from "@/server/services/store-item.service";
import { storeItemFormSchema } from "@/server/validation/store-item";
import { runAction, type ActionState } from "@/server/actions/action-result";

/**
 * Administracion del catalogo de objetos (`0.9.0` / MVP-2D, secciones 12-14
 * del encargo). Solo `ADMIN`. Sin catalogo global: cada objeto pertenece a
 * un unico split.
 */

function revalidateStorePaths(splitId: string) {
  revalidatePath(`/splits/${splitId}`);
  revalidatePath(`/splits/${splitId}/economia`);
  revalidatePath("/fichas");
}

function parseItemForm(formData: FormData) {
  return storeItemFormSchema.parse({
    name: formData.get("name"),
    description: formData.get("description"),
    priceCredits: formData.get("priceCredits"),
    equipmentSlotId: formData.get("equipmentSlotId"),
    kpiCode: formData.get("kpiCode"),
    bonusPercent: formData.get("bonusPercent"),
  });
}

export async function createStoreItemAction(splitId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    const input = parseItemForm(formData);
    await createStoreItem(prisma, splitId, input);
    revalidateStorePaths(splitId);
  });
}

export async function updateStoreItemAction(
  splitId: string,
  itemId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    const input = parseItemForm(formData);
    await updateStoreItem(prisma, splitId, itemId, input);
    revalidateStorePaths(splitId);
  });
}

export async function setStoreItemForSaleAction(
  splitId: string,
  itemId: string,
  isForSale: boolean,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    await setStoreItemForSale(prisma, splitId, itemId, isForSale);
    revalidateStorePaths(splitId);
  });
}

export async function deleteStoreItemAction(
  splitId: string,
  itemId: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    await deleteStoreItem(prisma, splitId, itemId);
    revalidateStorePaths(splitId);
  });
}
