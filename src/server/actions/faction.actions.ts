"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { DomainError } from "@/lib/errors";
import { createFaction, deleteFaction, updateFaction } from "@/server/services/faction.service";
import {
  deleteFactionImage,
  processFactionImage,
  saveFactionImage,
  type ProcessedFactionImage,
} from "@/server/services/faction-image.service";
import { factionFormSchema } from "@/server/validation/faction";
import { formatMegabytes } from "@/domain/avatar-constraints";
import { FACTION_IMAGE_FIELD, FACTION_IMAGE_MAX_INPUT_BYTES } from "@/domain/faction-image-constraints";
import { runAction, type ActionState } from "@/server/actions/action-result";

/** Solo ADMIN llega aqui: las paginas que renderizan estos formularios ya exigen `requireAdminSession`. */

/**
 * Procesa la imagen adjunta al formulario, si la hay. Se hace **antes** de
 * abrir cualquier transaccion: una imagen invalida nunca debe dejar una
 * faccion creada a medias ni borrar una imagen anterior valida.
 */
async function processOptionalImage(formData: FormData): Promise<ProcessedFactionImage | null> {
  const file = formData.get(FACTION_IMAGE_FIELD);
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > FACTION_IMAGE_MAX_INPUT_BYTES) {
    throw new DomainError(
      `La imagen ocupa ${formatMegabytes(file.size)} y el máximo permitido es ${formatMegabytes(
        FACTION_IMAGE_MAX_INPUT_BYTES,
      )}.`,
      FACTION_IMAGE_FIELD,
    );
  }
  return processFactionImage(Buffer.from(await file.arrayBuffer()));
}

export async function createFactionAction(splitId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = factionFormSchema.parse({ name: formData.get("name"), color: formData.get("color") });
    await createFaction(prisma, splitId, input);
    revalidatePath(`/splits/${splitId}`);
  });
}

export async function updateFactionAction(
  splitId: string,
  factionId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const input = factionFormSchema.parse({ name: formData.get("name"), color: formData.get("color") });
    await updateFaction(prisma, splitId, factionId, input);
    revalidatePath(`/splits/${splitId}`);
  });
}

export async function deleteFactionAction(splitId: string, factionId: string, _prevState: ActionState, _formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await deleteFaction(prisma, splitId, factionId);
    revalidatePath(`/splits/${splitId}`);
  });
}

/**
 * Sube o reemplaza el emblema de una faccion (`1.2.2`). Recurso cosmetico
 * actual: no exige mercado cerrado ni bloquea nada de la faccion, solo que
 * el split no este `CLOSED`.
 */
export async function saveFactionImageAction(
  splitId: string,
  factionId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    const image = await processOptionalImage(formData);
    if (!image) {
      throw new DomainError("Selecciona una imagen JPEG, PNG o WebP.", FACTION_IMAGE_FIELD);
    }
    await saveFactionImage(prisma, splitId, factionId, image);
    revalidatePath(`/splits/${splitId}`);
  });
}

/** Elimina el emblema de una faccion y vuelve al icono de reserva. */
export async function deleteFactionImageAction(
  splitId: string,
  factionId: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    await deleteFactionImage(prisma, splitId, factionId);
    revalidatePath(`/splits/${splitId}`);
  });
}
