"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { ManualEntryValidationError } from "@/server/validation/manual-entry";
import { saveChronomancyEntries } from "@/server/services/chronomancy-entry.service";
import type { ManualEntryActionState } from "@/server/actions/manual-entry-action-state";

/** "Guardar datos" / "Actualizar datos" de Cronomagia laboral. */
export async function saveChronomancyEntriesAction(
  splitId: string,
  weekId: string,
  _prevState: ManualEntryActionState,
  formData: FormData,
): Promise<ManualEntryActionState> {
  try {
    await saveChronomancyEntries(prisma, splitId, weekId, formData);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis`);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis/cronomagia/introducir`);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis/cronomagia/comprobar`);
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
