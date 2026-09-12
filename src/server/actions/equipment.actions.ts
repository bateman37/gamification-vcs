"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { DomainError } from "@/lib/errors";
import { equipOwnedItem, unequipSlot } from "@/server/services/equipment.service";
import { runAction, type ActionState } from "@/server/actions/action-result";

/**
 * Equipar/desequipar objetos propios (`0.9.0` / MVP-2D, secciones 19-22 del
 * encargo). Operaciones de autoservicio separadas, minimas: resuelven
 * siempre el `personId` desde la sesion. No exige que el mercado este
 * abierto, solo que el split este `ACTIVE`.
 */

async function requireOwnPersonId(): Promise<string> {
  const session = await requireSession();
  const personId = session.user.personId;
  if (!personId) {
    throw new DomainError("Tu cuenta no esta vinculada a ninguna persona. Contacta con un administrador.");
  }
  return personId;
}

export async function equipOwnedItemAction(
  splitParticipantId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const personId = await requireOwnPersonId();
    const ownedItemId = String(formData.get("ownedItemId") ?? "");
    if (!ownedItemId) {
      throw new DomainError("Selecciona un objeto de tu inventario.");
    }
    await equipOwnedItem(prisma, personId, splitParticipantId, ownedItemId);
    revalidatePath(`/fichas/${splitParticipantId}`);
  });
}

export async function unequipSlotAction(
  splitParticipantId: string,
  equipmentSlotId: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const personId = await requireOwnPersonId();
    await unequipSlot(prisma, personId, splitParticipantId, equipmentSlotId);
    revalidatePath(`/fichas/${splitParticipantId}`);
  });
}
