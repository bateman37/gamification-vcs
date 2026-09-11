import type { ProductivityPreview } from "@/server/services/productivity-import.service";

/**
 * Estado de las acciones de carga de Productividad. Vive en un modulo
 * aparte (sin "use server") porque un fichero "use server" solo puede
 * exportar funciones asincronas, no constantes ni tipos con valor.
 */
export interface ProductivityUploadState {
  ok: boolean;
  error?: string;
  preview?: ProductivityPreview;
  confirmed?: boolean;
}

export const initialProductivityUploadState: ProductivityUploadState = { ok: false };
