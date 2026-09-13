import { DomainError } from "@/lib/errors";

/**
 * Parseo y validacion en servidor del formulario "Puntos por posicion
 * semanal" (ver docs/POSITION_POINTS_CONFIGURATION.md). Convencion de
 * nombres de campo en el `FormData`: `points__<posicion>`, para las
 * posiciones `1..N`, donde `N` es el rango dinamico ya calculado en servidor
 * (`resolveRequiredPositionCountForSplit`) y recibido como parametro: nunca
 * un limite enviado por el cliente.
 */

export interface PositionPointFieldError {
  position: number;
  message: string;
}

/** Error de validacion con todos los errores detectables, asociados a la posicion concreta. */
export class PositionPointsValidationError extends DomainError {
  readonly fieldErrors: PositionPointFieldError[];

  constructor(fieldErrors: PositionPointFieldError[]) {
    super("Hay errores en los puntos por posición. Revísalos antes de guardar.");
    this.name = "PositionPointsValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export interface PositionPointRow {
  position: number;
  points: number;
}

/**
 * Valida las posiciones esperadas `1..totalPositions` (unicas y completas) y
 * que cada valor de puntos sea un entero no negativo. Un error en una fila
 * no impide comprobar las demas: se devuelven todos los errores detectados
 * en una sola respuesta.
 */
export function parsePositionPointsForm(formData: FormData, totalPositions: number): PositionPointRow[] {
  const fieldErrors: PositionPointFieldError[] = [];
  const rows: PositionPointRow[] = [];

  for (let position = 1; position <= totalPositions; position += 1) {
    const raw = formData.get(`points__${position}`);
    if (typeof raw !== "string" || raw.trim() === "") {
      fieldErrors.push({ position, message: `Los puntos de la posicion ${position} son obligatorios.` });
      continue;
    }
    const value = Number(raw.trim().replace(",", "."));
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      fieldErrors.push({ position, message: `Los puntos de la posicion ${position} deben ser un numero.` });
      continue;
    }
    if (!Number.isInteger(value)) {
      fieldErrors.push({ position, message: `Los puntos de la posicion ${position} deben ser un numero entero.` });
      continue;
    }
    if (value < 0) {
      fieldErrors.push({ position, message: `Los puntos de la posicion ${position} deben ser mayores o iguales que cero.` });
      continue;
    }
    rows.push({ position, points: value });
  }

  if (fieldErrors.length > 0) throw new PositionPointsValidationError(fieldErrors);
  return rows;
}
