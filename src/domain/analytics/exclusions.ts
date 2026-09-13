import type { KpiCellObservation } from "./types";

/**
 * Politica de exclusion de posibles ausencias (parte F del encargo). No es
 * una clasificacion medica ni una modificacion de resultados: es una regla
 * de analisis, visible y revisable, exclusiva de este modulo.
 */

/** Umbral inicial de esta entrega (parte F1): 2 o mas KPI a cero/sin dato. */
export const DEFAULT_ZERO_THRESHOLD = 2;

/**
 * Cuenta los KPI distintos aplicables con `COMPUTED` y base exactamente
 * cero, junto con los `VAC` existentes. `NOT_APPLICABLE`, valores
 * desconocidos y negativos nunca cuentan como cero (parte F1.2).
 */
export function countApplicableZeroLikeKpis(cells: readonly { status: KpiCellObservation["status"]; base: number | null }[]): number {
  let count = 0;
  for (const cell of cells) {
    if (cell.status === "NOT_APPLICABLE") continue;
    if (cell.status === "VAC") {
      count += 1;
      continue;
    }
    if (cell.status === "COMPUTED" && cell.base !== null && cell.base === 0) {
      count += 1;
    }
  }
  return count;
}

export function isExcludedByZeroPolicy(zeroLikeCount: number, threshold: number): boolean {
  return zeroLikeCount >= threshold;
}

export type ManualOverride = "include" | "exclude";
export type ExclusionDecision = "included_auto" | "excluded_auto" | "included_manual" | "excluded_manual";

export interface ObservationExclusionResult {
  excluded: boolean;
  decision: ExclusionDecision;
  zeroLikeCount: number;
}

/**
 * Decide si una observacion persona-split-semana queda excluida de las
 * estadisticas de rendimiento, aplicando primero la regla automatica y
 * despues una excepcion manual de la consulta actual si existe (parte F2).
 * Las excepciones manuales son parametros de lectura: nunca cambian la
 * instantanea publicada.
 */
export function resolveObservationExclusion(
  zeroLikeCount: number,
  threshold: number,
  override: ManualOverride | undefined,
): ObservationExclusionResult {
  const autoExcluded = isExcludedByZeroPolicy(zeroLikeCount, threshold);
  if (override === "include") {
    return { excluded: false, decision: "included_manual", zeroLikeCount };
  }
  if (override === "exclude") {
    return { excluded: true, decision: "excluded_manual", zeroLikeCount };
  }
  return { excluded: autoExcluded, decision: autoExcluded ? "excluded_auto" : "included_auto", zeroLikeCount };
}
