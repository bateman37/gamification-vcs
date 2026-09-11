import type { PositionPointFieldError } from "@/server/validation/position-points";

/** Estado del formulario "Guardar puntos por posicion" (ver docs/POSITION_POINTS_CONFIGURATION.md). */
export interface PositionPointsActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: PositionPointFieldError[];
  saved?: boolean;
}

export const initialPositionPointsActionState: PositionPointsActionState = { ok: false };
