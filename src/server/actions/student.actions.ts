"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { ManualEntryValidationError } from "@/server/validation/manual-entry";
import { saveStudentEntries } from "@/server/services/student-entry.service";
import type { ManualEntryActionState } from "@/server/actions/manual-entry-action-state";

/** "Guardar datos" / "Actualizar datos" de Estudiante entusiasta. */
export async function saveStudentEntriesAction(
  splitId: string,
  weekId: string,
  _prevState: ManualEntryActionState,
  formData: FormData,
): Promise<ManualEntryActionState> {
  try {
    await saveStudentEntries(prisma, splitId, weekId, formData);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis`);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis/dedicacion/introducir`);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis/dedicacion/comprobar`);
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
