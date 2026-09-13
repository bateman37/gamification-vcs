"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { DomainError } from "@/lib/errors";
import {
  createStoreItem,
  deleteStoreItem,
  setStoreItemForSale,
  updateStoreItem,
} from "@/server/services/store-item.service";
import {
  deleteStoreItemImage,
  processStoreItemImage,
  saveStoreItemImage,
  type ProcessedStoreItemImage,
} from "@/server/services/store-item-image.service";
import { storeItemFormSchema } from "@/server/validation/store-item";
import { formatMegabytes } from "@/domain/avatar-constraints";
import { STORE_ITEM_IMAGE_FIELD, STORE_ITEM_IMAGE_MAX_INPUT_BYTES } from "@/domain/store-item-image-constraints";
import { runAction, type ActionState } from "@/server/actions/action-result";

/**
 * Administracion del catalogo de objetos (`0.9.0` / MVP-2D, secciones 12-14
 * del encargo; imagenes en `1.2.0`, seccion 7). Solo `ADMIN`. Sin catalogo
 * global: cada objeto pertenece a un unico split.
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

/**
 * Procesa la imagen adjunta al formulario, si la hay. Se hace **antes** de
 * abrir cualquier transaccion: una imagen invalida nunca debe dejar un objeto
 * creado a medias ni borrar una imagen anterior valida.
 */
async function processOptionalImage(formData: FormData): Promise<ProcessedStoreItemImage | null> {
  const file = formData.get(STORE_ITEM_IMAGE_FIELD);
  if (!(file instanceof File) || file.size === 0) return null;
  // Primer filtro por tamano antes de leer el archivo completo en memoria; el servicio vuelve a
  // comprobarlo sobre los bytes reales, junto con el formato decodificado con `sharp`.
  if (file.size > STORE_ITEM_IMAGE_MAX_INPUT_BYTES) {
    throw new DomainError(
      `La imagen ocupa ${formatMegabytes(file.size)} y el máximo permitido es ${formatMegabytes(
        STORE_ITEM_IMAGE_MAX_INPUT_BYTES,
      )}.`,
      STORE_ITEM_IMAGE_FIELD,
    );
  }
  return processStoreItemImage(Buffer.from(await file.arrayBuffer()));
}

export async function createStoreItemAction(splitId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    const input = parseItemForm(formData);
    const image = await processOptionalImage(formData);
    await createStoreItem(prisma, splitId, input, image);
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

/**
 * Sube o reemplaza la imagen de un objeto. Es la **unica excepcion cosmetica**
 * a la inmutabilidad de un objeto ya comprado: la imagen no forma parte de la
 * formula ni de la auditoria numerica, asi que puede cambiarse aunque el
 * objeto tenga propietarios, siempre con el mercado cerrado, el split no
 * cerrado y sesion de administrador. No altera compras, snapshots ni
 * resultados publicados.
 */
export async function saveStoreItemImageAction(
  splitId: string,
  itemId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    const image = await processOptionalImage(formData);
    if (!image) {
      throw new DomainError("Selecciona una imagen JPEG, PNG o WebP.", STORE_ITEM_IMAGE_FIELD);
    }
    await saveStoreItemImage(prisma, splitId, itemId, image);
    revalidateStorePaths(splitId);
  });
}

/** Elimina la imagen de un objeto y vuelve al icono de reserva de su posicion. */
export async function deleteStoreItemImageAction(
  splitId: string,
  itemId: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    await deleteStoreItemImage(prisma, splitId, itemId);
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
