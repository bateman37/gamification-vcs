import type { EscalationPreview } from "@/server/services/escalation-import.service";

/** Estado de las acciones de carga de Escalados (ver productivity-action-state.ts). */
export interface EscalationUploadState {
  ok: boolean;
  error?: string;
  preview?: EscalationPreview;
  confirmed?: boolean;
}

export const initialEscalationUploadState: EscalationUploadState = { ok: false };
