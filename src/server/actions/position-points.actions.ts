"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { PositionPointsValidationError, parsePositionPointsForm } from "@/server/validation/position-points";
import { resolveRequiredPositionCountForSplit, updatePositionPointRules } from "@/server/services/position-points.service";
import type { PositionPointsActionState } from "@/server/actions/position-points-action-state";

/** "Guardar puntos por posicion" del detalle del split. */
export async function updatePositionPointsAction(
  splitId: string,
  _prevState: PositionPointsActionState,
  formData: FormData,
): Promise<PositionPointsActionState> {
  try {
    // El rango dinamico se recalcula siempre en servidor (seccion 6.3 del encargo): nunca se confia
    // en un campo oculto o limite enviado por el cliente.
    const totalPositions = await resolveRequiredPositionCountForSplit(prisma, splitId);
    const rows = parsePositionPointsForm(formData, totalPositions);
    await updatePositionPointRules(prisma, splitId, rows);
    revalidatePath(`/splits/${splitId}`);
    return { ok: true, saved: true };
  } catch (error) {
    if (error instanceof PositionPointsValidationError) {
      return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    }
    if (error instanceof DomainError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
