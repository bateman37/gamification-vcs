"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { DomainError } from "@/lib/errors";
import { runAction, type ActionState } from "@/server/actions/action-result";
import {
  chooseOwnProfession,
  deleteOwnAvatar,
  saveOwnAvatar,
  updateOwnAlias,
} from "@/server/services/participant-profile.service";
import { AVATAR_MAX_INPUT_BYTES, formatMegabytes } from "@/domain/avatar-constraints";

/**
 * Autoservicio de la ficha privada (`0.8.0` / MVP-2B, parte D del encargo).
 *
 * Cada accion tiene una intencion limitada (alias propio, profesion propia,
 * avatar propio) y resuelve **siempre** la identidad desde la sesion: nunca
 * se acepta un `personId` enviado por el formulario ni por la URL. La
 * administracion generica de participantes no se reutiliza aqui, para que
 * un formulario de participante no pueda cambiar nivel, faccion, persona ni
 * semana inicial.
 */

async function requireOwnPersonId(): Promise<string> {
  const session = await requireSession();
  const personId = session.user.personId;
  if (!personId) {
    throw new DomainError("Tu cuenta no esta vinculada a ninguna persona. Contacta con un administrador.");
  }
  return personId;
}

export async function updateOwnAliasAction(
  splitParticipantId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const personId = await requireOwnPersonId();
    await updateOwnAlias(prisma, personId, splitParticipantId, String(formData.get("alias") ?? ""));
    revalidatePath("/fichas");
  });
}

export async function chooseOwnProfessionAction(
  splitParticipantId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const personId = await requireOwnPersonId();
    const raw = String(formData.get("professionId") ?? "").trim();
    await chooseOwnProfession(prisma, personId, splitParticipantId, raw === "" ? null : raw);
    revalidatePath("/fichas");
  });
}

export async function saveOwnAvatarAction(
  splitParticipantId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const personId = await requireOwnPersonId();
    const file = formData.get("avatar");
    if (!(file instanceof File) || file.size === 0) {
      throw new DomainError("Selecciona una imagen JPEG, PNG o WebP.", "avatar");
    }
    // Primer filtro por tamano antes de leer el archivo completo en memoria; el servicio vuelve a
    // comprobarlo sobre los bytes reales, junto con el formato decodificado.
    if (file.size > AVATAR_MAX_INPUT_BYTES) {
      throw new DomainError(
        `La imagen ocupa ${formatMegabytes(file.size)} y el maximo permitido es ${formatMegabytes(AVATAR_MAX_INPUT_BYTES)}.`,
        "avatar",
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    await saveOwnAvatar(prisma, personId, splitParticipantId, buffer);
    revalidatePath("/fichas");
  });
}

export async function deleteOwnAvatarAction(
  splitParticipantId: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const personId = await requireOwnPersonId();
    await deleteOwnAvatar(prisma, personId, splitParticipantId);
    revalidatePath("/fichas");
  });
}
