"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { DomainError } from "@/lib/errors";
import { saveEquipmentLoadout } from "@/server/services/equipment.service";
import type { LoadoutAssignment } from "@/domain/equipment-loadout";
import { runAction, type ActionState } from "@/server/actions/action-result";

/**
 * Confirmacion del equipo propio (`0.9.0` / MVP-2D, rediseñada en `1.2.0`).
 *
 * Desde `1.2.0` no existen acciones inmediatas de equipar/desequipar: el
 * jugador prepara los cambios en un borrador local y solo "Confirmar equipo"
 * persiste el conjunto completo, de forma atomica. Esta accion sigue siendo
 * una capa fina: resuelve la identidad desde la sesion (nunca acepta un
 * `personId` del navegador), traduce el formulario y delega toda la
 * validacion y la transaccion en el servicio.
 *
 * No exige que el mercado este abierto, solo que el split este `ACTIVE`.
 */

async function requireOwnPersonId(): Promise<string> {
  const session = await requireSession();
  const personId = session.user.personId;
  if (!personId) {
    throw new DomainError("Tu cuenta no está vinculada a ninguna persona. Contacta con un administrador.");
  }
  return personId;
}

/**
 * Lee las asignaciones del formulario. Cada entrada viaja como
 * `assignment = "<equipmentSlotId>:<ownedItemId>"`: solo ids opacos, nunca
 * bonus, KPI, precio ni nombre calculado por el navegador.
 */
function parseAssignments(formData: FormData): LoadoutAssignment[] {
  return formData.getAll("assignment").map((raw) => {
    const value = String(raw);
    const separator = value.indexOf(":");
    if (separator <= 0 || separator === value.length - 1) {
      throw new DomainError("No se ha podido leer el equipo enviado. Recarga la ficha e inténtalo de nuevo.");
    }
    return {
      equipmentSlotId: value.slice(0, separator),
      ownedItemId: value.slice(separator + 1),
    };
  });
}

export async function saveEquipmentLoadoutAction(
  splitParticipantId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const personId = await requireOwnPersonId();
    const assignments = parseAssignments(formData);
    const expectedRevisionRaw = formData.get("expectedRevision");
    const expectedRevision = typeof expectedRevisionRaw === "string" ? expectedRevisionRaw : null;

    await saveEquipmentLoadout(prisma, personId, splitParticipantId, assignments, expectedRevision);
    revalidatePath(`/fichas/${splitParticipantId}`);
    revalidatePath("/fichas");
  });
}
