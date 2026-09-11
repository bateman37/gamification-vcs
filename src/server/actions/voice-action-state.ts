import type { VoicePreview } from "@/server/services/voice-import.service";

/** Estado de las acciones de carga de Llamadas (ver productivity-action-state.ts). */
export interface VoiceUploadState {
  ok: boolean;
  error?: string;
  preview?: VoicePreview;
  confirmed?: boolean;
}

export const initialVoiceUploadState: VoiceUploadState = { ok: false };
