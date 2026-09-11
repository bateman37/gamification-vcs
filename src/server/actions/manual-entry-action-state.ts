import type { ManualEntryFieldError } from "@/server/validation/manual-entry";

/**
 * Estado compartido por las acciones de guardado de los cinco formularios
 * manuales de KPI (ver docs/MANUAL_KPI_ENTRY.md). A diferencia de las
 * cargas de Excel, no hay paso de "Analizar": una unica accion valida y
 * guarda (o sustituye) el conjunto completo.
 */
export interface ManualEntryActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: ManualEntryFieldError[];
  saved?: boolean;
}

export const initialManualEntryActionState: ManualEntryActionState = { ok: false };
