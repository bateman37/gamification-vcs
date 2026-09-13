import type { GamificationDisplayMode, KpiCellObservation, ResolvedCellBase } from "./types";

/**
 * Resuelve la base "sin gamificacion" de una celda `COMPUTED` (parte C3 del
 * encargo): puntos KPI tras formula y maximo, antes de bonus de profesion,
 * localizacion y objetos.
 *
 * - Si `basePointsBeforeProfession` existe, es la base (dato moderno).
 * - Si no existe pero la suma de los tres bonus es exactamente cero,
 *   se usa el fallback documentado a `finalPoints` (publicacion anterior a
 *   `0.8.0`, cuando ningun bonus existia todavia: `finalPoints` ya era el
 *   valor real).
 * - Si no existe y hay evidencia de bonus (suma distinta de cero), la base
 *   no esta disponible: nunca se copia el total bonificado como
 *   rendimiento real ("Dato base no disponible").
 */
export function resolveCellBase(cell: KpiCellObservation): ResolvedCellBase {
  if (cell.status !== "COMPUTED") {
    return { base: null, available: false, usedLegacyFallback: false };
  }
  const totalBonus = cell.professionBonusPoints + cell.locationBonusPoints + cell.equipmentBonusPoints;
  if (cell.basePointsBeforeProfession !== null) {
    return { base: cell.basePointsBeforeProfession, available: true, usedLegacyFallback: false };
  }
  if (totalBonus === 0 && cell.finalPoints !== null) {
    return { base: cell.finalPoints, available: true, usedLegacyFallback: true };
  }
  return { base: null, available: false, usedLegacyFallback: false };
}

export type CellExclusionReason =
  | "not_applicable"
  | "observation_excluded"
  | "base_unavailable";

/**
 * Celda ya resuelta para agregacion: valor en puntos (`x`) y en `%` del
 * maximo base (`q`), segun el modo y la politica de exclusion. Conserva
 * ademas los campos de solo lectura de la instantanea (nombre, puntos con
 * gamificacion y desglose de bonus) para el detalle por persona (H6) y el
 * bloque de impacto de la gamificacion (H7): estos nunca cambian con el
 * modo ni con la politica de exclusion.
 */
export interface ResolvedCellValue {
  kpiCode: string;
  kpiName: string;
  status: KpiCellObservation["status"];
  included: boolean;
  x: number | null;
  max: number | null;
  q: number | null;
  reason: CellExclusionReason | null;
  finalPoints: number | null;
  basePointsBeforeProfession: number | null;
  professionBonusPoints: number;
  locationBonusPoints: number;
  equipmentBonusPoints: number;
}

/**
 * Resuelve una celda para las estadisticas de rendimiento, segun la
 * asistencia ya decidida para toda la observacion persona-split-semana
 * (`1.1.1`, sustituye la politica de posibles ausencias de `1.1.0`, ver
 * docs/WEEKLY_ATTENDANCE_AND_HOURS.md) y el modo con/sin gamificacion
 * (parte C3/E1).
 */
export function resolveCellValue(cell: KpiCellObservation, mode: GamificationDisplayMode, observationExcluded: boolean): ResolvedCellValue {
  const base = {
    kpiCode: cell.kpiCode,
    kpiName: cell.kpiName,
    status: cell.status,
    max: cell.baseMax,
    finalPoints: cell.finalPoints,
    basePointsBeforeProfession: cell.basePointsBeforeProfession,
    professionBonusPoints: cell.professionBonusPoints,
    locationBonusPoints: cell.locationBonusPoints,
    equipmentBonusPoints: cell.equipmentBonusPoints,
  };

  if (cell.status === "NOT_APPLICABLE") {
    return { ...base, included: false, x: null, q: null, reason: "not_applicable" };
  }

  // Ausencia (real o cobertura legacy desconocida): fuera de rendimiento, tanto la observacion
  // completa como, defensivamente, una celda individual `ABSENT`.
  if (observationExcluded || cell.status === "ABSENT") {
    return { ...base, included: false, x: null, q: null, reason: "observation_excluded" };
  }

  if (cell.status === "VAC") {
    // VAC cuenta siempre como cero analitico (hotfix AVISO/0, ver docs/DECISIONS.md): es una
    // ausencia de dato de una persona presente, no una ausencia laboral.
    const max = cell.baseMax;
    return { ...base, included: true, x: 0, q: max !== null && max > 0 ? 0 : null, reason: null };
  }

  // COMPUTED
  const resolvedBase = resolveCellBase(cell);
  const x = mode === "con" ? cell.finalPoints : resolvedBase.available ? resolvedBase.base : null;
  if (x === null) {
    return { ...base, included: false, x: null, q: null, reason: "base_unavailable" };
  }
  const max = cell.baseMax;
  const q = max !== null && max > 0 ? (100 * x) / max : null;
  return { ...base, included: true, x, q, reason: null };
}
