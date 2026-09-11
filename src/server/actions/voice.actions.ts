"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { extractUploadedXlsxFile } from "@/server/validation/productivity";
import { confirmVoiceImport, previewVoiceImport } from "@/server/services/voice-import.service";
import type { VoiceUploadState } from "@/server/actions/voice-action-state";

/** "Analizar archivo": lee y valida el Excel de Llamadas sin escribir nada en la base de datos. */
export async function analyzeVoiceImportAction(
  splitId: string,
  weekId: string,
  _prevState: VoiceUploadState,
  formData: FormData,
): Promise<VoiceUploadState> {
  try {
    const file = await extractUploadedXlsxFile(formData);
    const preview = await previewVoiceImport(prisma, splitId, weekId, file);
    return { ok: true, preview };
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

/** "Confirmar carga" / "Sustituir carga" de Llamadas: vuelve a leer y validar el archivo en servidor. */
export async function confirmVoiceImportAction(
  splitId: string,
  weekId: string,
  _prevState: VoiceUploadState,
  formData: FormData,
): Promise<VoiceUploadState> {
  try {
    const file = await extractUploadedXlsxFile(formData);
    await confirmVoiceImport(prisma, splitId, weekId, file);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis`);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis/llamadas/comprobar`);
    return { ok: true, confirmed: true };
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
