import type { QualityPreview } from "@/server/services/quality-import.service";

/** Estado de las acciones de carga de Calidad (ver productivity-action-state.ts). */
export interface QualityUploadState {
  ok: boolean;
  error?: string;
  preview?: QualityPreview;
  confirmed?: boolean;
}

export const initialQualityUploadState: QualityUploadState = { ok: false };
