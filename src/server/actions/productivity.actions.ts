"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { extractUploadedXlsxFile } from "@/server/validation/productivity";
import { confirmProductivityImport, previewProductivityImport } from "@/server/services/productivity-import.service";
import type { ProductivityUploadState } from "@/server/actions/productivity-action-state";

/** "Analizar archivo": lee y valida el Excel sin escribir nada en la base de datos. */
export async function analyzeProductivityImportAction(
  splitId: string,
  weekId: string,
  _prevState: ProductivityUploadState,
  formData: FormData,
): Promise<ProductivityUploadState> {
  try {
    const file = await extractUploadedXlsxFile(formData);
    const preview = await previewProductivityImport(prisma, splitId, weekId, file);
    return { ok: true, preview };
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

/**
 * "Confirmar carga" / "Sustituir carga": vuelve a leer y validar el
 * archivo en servidor antes de persistir nada (ver
 * docs/IMPORT_PRODUCTIVITY.md).
 */
export async function confirmProductivityImportAction(
  splitId: string,
  weekId: string,
  _prevState: ProductivityUploadState,
  formData: FormData,
): Promise<ProductivityUploadState> {
  try {
    const file = await extractUploadedXlsxFile(formData);
    await confirmProductivityImport(prisma, splitId, weekId, file);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis`);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis/productividad/comprobar`);
    return { ok: true, confirmed: true };
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
