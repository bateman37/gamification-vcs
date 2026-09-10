"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createPerson, updatePerson } from "@/server/services/person.service";
import { createPersonSchema, updatePersonSchema } from "@/server/validation/person";
import { runAction, type ActionState } from "@/server/actions/action-result";

export async function createPersonAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const input = createPersonSchema.parse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
    });
    await createPerson(prisma, input);
    revalidatePath("/personas");
  });
}

export async function updatePersonAction(
  personId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const input = updatePersonSchema.parse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
    });
    await updatePerson(prisma, personId, input);
    revalidatePath("/personas");
  });
}
