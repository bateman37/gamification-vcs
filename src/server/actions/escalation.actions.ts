"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { extractUploadedXlsxFile } from "@/server/validation/productivity";
import { confirmEscalationImport, previewEscalationImport } from "@/server/services/escalation-import.service";
import type { EscalationUploadState } from "@/server/actions/escalation-action-state";

/** "Analizar archivo": lee y valida el Excel de Escalados sin escribir nada en la base de datos. */
export async function analyzeEscalationImportAction(
  splitId: string,
  weekId: string,
  _prevState: EscalationUploadState,
  formData: FormData,
): Promise<EscalationUploadState> {
  try {
    const file = await extractUploadedXlsxFile(formData);
    const preview = await previewEscalationImport(prisma, splitId, weekId, file);
    return { ok: true, preview };
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

/** "Confirmar carga" / "Sustituir carga" de Escalados: vuelve a leer y validar el archivo en servidor. */
export async function confirmEscalationImportAction(
  splitId: string,
  weekId: string,
  _prevState: EscalationUploadState,
  formData: FormData,
): Promise<EscalationUploadState> {
  try {
    const file = await extractUploadedXlsxFile(formData);
    await confirmEscalationImport(prisma, splitId, weekId, file);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis`);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis/escalados/comprobar`);
    return { ok: true, confirmed: true };
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
