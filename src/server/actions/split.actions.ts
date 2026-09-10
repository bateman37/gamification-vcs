"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  activateSplit,
  createSplitWithWeeks,
  updateSplitDraft,
} from "@/server/services/split.service";
import { createSplitSchema, updateSplitDraftSchema } from "@/server/validation/split";
import { runAction, type ActionState } from "@/server/actions/action-result";

export async function createSplitAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let createdSplitId: string | undefined;
  const result = await runAction(async () => {
    const input = createSplitSchema.parse({
      name: formData.get("name"),
      description: formData.get("description"),
      startDate: formData.get("startDate"),
      numberOfWeeks: formData.get("numberOfWeeks"),
    });
    const split = await createSplitWithWeeks(prisma, input);
    createdSplitId = split.id;
    revalidatePath("/splits");
  });

  if (result.ok && createdSplitId) {
    redirect(`/splits/${createdSplitId}`);
  }
  return result;
}

export async function updateSplitDraftAction(
  splitId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const input = updateSplitDraftSchema.parse({
      name: formData.get("name"),
      description: formData.get("description"),
      startDate: formData.get("startDate"),
      numberOfWeeks: formData.get("numberOfWeeks"),
    });
    await updateSplitDraft(prisma, splitId, input);
    revalidatePath(`/splits/${splitId}`);
    revalidatePath("/splits");
  });
}

export async function activateSplitAction(
  splitId: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await activateSplit(prisma, splitId);
    revalidatePath(`/splits/${splitId}`);
    revalidatePath("/splits");
  });
}
