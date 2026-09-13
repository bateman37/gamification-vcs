import { Prisma } from "@prisma/client";

/**
 * Puntos por hora (`1.1.1`, ver docs/WEEKLY_ATTENDANCE_AND_HOURS.md): nueva
 * medida real de rendimiento. El numerador son siempre puntos KPI (nunca
 * puntos por posicion ni creditos); el denominador son siempre las horas
 * totales trabajadas (nunca horas productivas ni una jornada teorica de 40
 * horas). No calculable (`null`, nunca `0`/`NaN`/infinito) cuando las horas
 * totales validas son `0` (ausencia o sin dato).
 */

/** Puntos por hora de una unica semana presente. `null` si `totalHours <= 0`. */
export function computeWeeklyPointsPerHour(points: Prisma.Decimal | number, totalHours: Prisma.Decimal | number): number | null {
  const hours = totalHours instanceof Prisma.Decimal ? totalHours : new Prisma.Decimal(totalHours);
  if (hours.lessThanOrEqualTo(0)) return null;
  const pointsDecimal = points instanceof Prisma.Decimal ? points : new Prisma.Decimal(points);
  return pointsDecimal.div(hours).toNumber();
}

export interface PointsPerHourEntry {
  points: number;
  hours: number;
}

/**
 * Razon de sumas de un periodo (G2): `suma(puntos) / suma(horas)`, nunca la
 * media de los ratios semanales (una semana de 8 horas no debe pesar igual
 * que una de 40). Las entradas ya deben venir filtradas a semanas presentes
 * con horas validas; `null` si no hay ninguna entrada o la suma de horas es
 * `0`.
 */
export function computePeriodPointsPerHour(entries: readonly PointsPerHourEntry[]): number | null {
  let sumPoints = new Prisma.Decimal(0);
  let sumHours = new Prisma.Decimal(0);
  for (const entry of entries) {
    sumPoints = sumPoints.plus(entry.points);
    sumHours = sumHours.plus(entry.hours);
  }
  if (sumHours.lessThanOrEqualTo(0)) return null;
  return sumPoints.div(sumHours).toNumber();
}

export interface SplitWeekPphObservation {
  splitId: string;
  points: number;
  hours: number;
}

export type PphWeekConsolidation =
  /** Horas identicas entre splits simultaneos: se usan una sola vez, puntos = media simple entre splits. */
  | { status: "ok"; hours: number; points: number }
  /** Horas distintas entre splits simultaneos de la misma persona y semana: no se elige ninguna, no se suman horas duplicadas. */
  | { status: "inconsistent_hours" };

/**
 * Consolida las observaciones de puntos por hora de varias splits
 * simultaneos de la misma persona y semana de calendario (G3): con horas
 * iguales, usa esas horas una sola vez y la media simple de los puntos
 * equivalentes; con horas distintas, marca la incidencia sin elegir un
 * valor arbitrariamente.
 */
export function consolidatePphAcrossSplits(observations: readonly SplitWeekPphObservation[]): PphWeekConsolidation {
  if (observations.length === 0) return { status: "inconsistent_hours" };
  const firstHours = observations[0]!.hours;
  const allHoursEqual = observations.every((observation) => observation.hours === firstHours);
  if (!allHoursEqual) return { status: "inconsistent_hours" };
  const meanPoints = observations.reduce((sum, observation) => sum + observation.points, 0) / observations.length;
  return { status: "ok", hours: firstHours, points: meanPoints };
}
