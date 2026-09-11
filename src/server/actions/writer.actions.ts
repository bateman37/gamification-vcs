"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { ManualEntryValidationError } from "@/server/validation/manual-entry";
import { saveWriterEntries } from "@/server/services/writer-entry.service";
import type { ManualEntryActionState } from "@/server/actions/manual-entry-action-state";

/** "Guardar datos" / "Actualizar datos" de Redactor estrella. */
export async function saveWriterEntriesAction(
  splitId: string,
  weekId: string,
  _prevState: ManualEntryActionState,
  formData: FormData,
): Promise<ManualEntryActionState> {
  try {
    await saveWriterEntries(prisma, splitId, weekId, formData);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis`);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis/articulos/introducir`);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis/articulos/comprobar`);
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
