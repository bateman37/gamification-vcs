"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { ManualEntryValidationError } from "@/server/validation/manual-entry";
import { saveStabilityEntries } from "@/server/services/stability-entry.service";
import type { ManualEntryActionState } from "@/server/actions/manual-entry-action-state";

/** "Guardar datos" / "Actualizar datos" de Guardian de la Estabilidad. */
export async function saveStabilityEntriesAction(
  splitId: string,
  weekId: string,
  _prevState: ManualEntryActionState,
  formData: FormData,
): Promise<ManualEntryActionState> {
  try {
    await saveStabilityEntries(prisma, splitId, weekId, formData);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis`);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis/estabilidad/introducir`);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis/estabilidad/comprobar`);
    return { ok: true, saved: true };
  } catch (error) {
    if (error instanceof ManualEntryValidationError) {
      return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    }
    if (error instanceof DomainError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
