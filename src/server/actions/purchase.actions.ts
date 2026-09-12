"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { DomainError } from "@/lib/errors";
import { purchaseStoreItem } from "@/server/services/purchase.service";
import { runAction, type ActionState } from "@/server/actions/action-result";

/**
 * Compra de un objeto propio (`0.9.0` / MVP-2D, seccion 16 del encargo).
 * Operacion de autoservicio de intencion minima: resuelve siempre el
 * `personId` desde la sesion, nunca acepta uno del formulario, y no puede
 * comprar para otra persona ni con el saldo de otro split.
 */
export async function purchaseStoreItemAction(
  splitParticipantId: string,
  storeItemId: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const session = await requireSession();
    const personId = session.user.personId;
    if (!personId) {
      throw new DomainError("Tu cuenta no esta vinculada a ninguna persona. Contacta con un administrador.");
    }
    await purchaseStoreItem(prisma, personId, splitParticipantId, storeItemId);
    revalidatePath(`/fichas/${splitParticipantId}`);
  });
}
