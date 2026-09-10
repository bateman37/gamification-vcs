"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createPerson } from "@/server/services/person.service";
import { addParticipant, updateParticipant } from "@/server/services/participant.service";
import { createPersonSchema } from "@/server/validation/person";
import { addParticipantSchema, updateParticipantSchema } from "@/server/validation/participant";
import { runAction, type ActionState } from "@/server/actions/action-result";
import { DomainError } from "@/lib/errors";

export async function addParticipantAction(
  splitId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const newPersonName = String(formData.get("newPersonFullName") ?? "").trim();
    let personId = String(formData.get("personId") ?? "").trim();

    if (newPersonName) {
      const personInput = createPersonSchema.parse({
        fullName: newPersonName,
        email: formData.get("newPersonEmail"),
      });
      const person = await createPerson(prisma, personInput);
      personId = person.id;
    }

    if (!personId) {
      throw new DomainError("Selecciona una persona existente o crea una nueva.", "personId");
    }

    const input = addParticipantSchema.parse({
      personId,
      alias: formData.get("alias"),
      level: formData.get("level"),
      startWeekSequenceNumber: formData.get("startWeekSequenceNumber"),
    });
    await addParticipant(prisma, splitId, input);
    revalidatePath(`/splits/${splitId}`);
    revalidatePath("/splits");
  });
}

export async function updateParticipantAction(
  splitId: string,
  participantId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const input = updateParticipantSchema.parse({
      alias: formData.get("alias"),
      level: formData.get("level"),
    });
    await updateParticipant(prisma, participantId, input);
    revalidatePath(`/splits/${splitId}`);
  });
}
