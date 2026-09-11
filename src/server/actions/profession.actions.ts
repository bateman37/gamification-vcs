"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createProfession, deleteProfession, updateProfession } from "@/server/services/profession.service";
import { professionFormSchema, readCheckbox } from "@/server/validation/profession";
import { runAction, type ActionState } from "@/server/actions/action-result";
import { requireAdminSession } from "@/lib/session";

/**
 * Administracion de la definicion de profesiones (`0.8.0` / MVP-2B). Solo
 * `ADMIN`: ademas de que las paginas que renderizan estos formularios ya
 * exigen `requireAdminSession`, cada accion vuelve a comprobarlo en
 * servidor, porque una Server Action es una ruta invocable directamente.
 * Ninguna de estas acciones toca alias, avatar ni ninguna otra ficha.
 */

function parseProfessionForm(formData: FormData) {
  return professionFormSchema.parse({
    name: formData.get("name"),
    kpiCodeA: formData.get("kpiCodeA"),
    kpiCodeB: formData.get("kpiCodeB"),
    availableN0: readCheckbox(formData, "availableN0"),
    availableN1: readCheckbox(formData, "availableN1"),
    availableN2: readCheckbox(formData, "availableN2"),
  });
}

export async function createProfessionAction(splitId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    const input = parseProfessionForm(formData);
    await createProfession(prisma, splitId, input);
    revalidatePath(`/splits/${splitId}`);
  });
}

export async function updateProfessionAction(
  splitId: string,
  professionId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    const input = parseProfessionForm(formData);
    await updateProfession(prisma, splitId, professionId, input);
    revalidatePath(`/splits/${splitId}`);
  });
}

export async function deleteProfessionAction(
  splitId: string,
  professionId: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    await deleteProfession(prisma, splitId, professionId);
    revalidatePath(`/splits/${splitId}`);
  });
}
