"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { requireSession, requireAdminSession } from "@/lib/session";
import {
  changeOwnPassword,
  createParticipantAccount,
  setAccountActive,
  setTemporaryPassword,
} from "@/server/services/auth.service";

export interface SimpleActionState {
  ok: boolean;
  error?: string;
  saved?: boolean;
}

export const initialSimpleActionState: SimpleActionState = { ok: true };

/** Cambio de la propia contrasena, obligatorio en el primer acceso. */
export async function changeOwnPasswordAction(
  _prevState: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const session = await requireSession();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword !== confirmPassword) {
    return { ok: false, error: "La confirmacion no coincide con la nueva contrasena." };
  }

  try {
    await changeOwnPassword(prisma, session.user.id, currentPassword, newPassword);
    return { ok: true, saved: true };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: error.message };
    throw error;
  }
}

/** Crea una cuenta de participante vinculada a una persona (solo administrador). */
export async function createParticipantAccountAction(
  _prevState: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  await requireAdminSession();
  const personId = String(formData.get("personId") ?? "");
  const email = String(formData.get("email") ?? "");
  const temporaryPassword = String(formData.get("temporaryPassword") ?? "");

  try {
    await createParticipantAccount(prisma, { personId, email, temporaryPassword });
    revalidatePath("/personas");
    return { ok: true, saved: true };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: error.message };
    throw error;
  }
}

/** Activa o desactiva una cuenta de participante (solo administrador). */
export async function setAccountActiveAction(userId: string, isActive: boolean): Promise<void> {
  await requireAdminSession();
  await setAccountActive(prisma, userId, isActive);
  revalidatePath("/personas");
}

/** Fija una nueva contrasena temporal para una cuenta de participante (solo administrador). */
export async function setTemporaryPasswordAction(
  _prevState: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  await requireAdminSession();
  const userId = String(formData.get("userId") ?? "");
  const temporaryPassword = String(formData.get("temporaryPassword") ?? "");

  try {
    await setTemporaryPassword(prisma, userId, temporaryPassword);
    revalidatePath("/personas");
    return { ok: true, saved: true };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: error.message };
    throw error;
  }
}
