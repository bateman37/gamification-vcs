"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createFaction, deleteFaction, updateFaction } from "@/server/services/faction.service";
import { factionFormSchema } from "@/server/validation/faction";
import { runAction, type ActionState } from "@/server/actions/action-result";

/** Solo ADMIN llega aqui: las paginas que renderizan estos formularios ya exigen `requireAdminSession`. */

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
