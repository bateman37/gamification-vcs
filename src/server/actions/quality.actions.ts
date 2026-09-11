"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { extractUploadedXlsxFile } from "@/server/validation/productivity";
import { confirmQualityImport, previewQualityImport } from "@/server/services/quality-import.service";
import type { QualityUploadState } from "@/server/actions/quality-action-state";

/** "Analizar archivo": lee y valida el Excel de Calidad sin escribir nada en la base de datos. */
export async function analyzeQualityImportAction(
  splitId: string,
  weekId: string,
  _prevState: QualityUploadState,
  formData: FormData,
): Promise<QualityUploadState> {
  try {
    const file = await extractUploadedXlsxFile(formData);
    const preview = await previewQualityImport(prisma, splitId, weekId, file);
    return { ok: true, preview };
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

/** "Confirmar carga" / "Sustituir carga" de Calidad: vuelve a leer y validar el archivo en servidor. */
export async function confirmQualityImportAction(
  splitId: string,
  weekId: string,
  _prevState: QualityUploadState,
  formData: FormData,
): Promise<QualityUploadState> {
  try {
    const file = await extractUploadedXlsxFile(formData);
    await confirmQualityImport(prisma, splitId, weekId, file);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis`);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis/calidad/comprobar`);
    return { ok: true, confirmed: true };
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
