import { collapseSimultaneousSplits, collapseWeeksToPersonPeriod, computeHierarchicalAverage, mean, type WeightedCell } from "./aggregation";
import { ppDifference } from "./comparison";
import { resolveCellBase } from "./base-points";
import { computeWeeklyPointsPerHour, computePeriodPointsPerHour } from "@/domain/points-per-hour";
import { formatCalendarDate } from "@/lib/dates";
import type { ResolvedObservation } from "./observation";
import type { AnalyticsLevel } from "./types";

/**
 * Analisis por persona (bloque 5, parte H6 del encargo): una fila por
 * observacion persona-split-semana original (para conservar la identidad de
 * split en la tabla, ver parte D5), con su comparacion contra la media del
 * resto de su nivel esa misma semana.
 */

export interface PersonDetailCell {
  kpiCode: string;
  kpiName: string;
  status: string;
  x: number | null;
  q: number | null;
  /** Base "sin gamificacion" resuelta (con el fallback legado), siempre disponible con independencia del modo elegido en la pagina (parte H6/H7). */
  basePoints: number | null;
  finalPoints: number | null;
  professionBonusPoints: number;
  locationBonusPoints: number;
  equipmentBonusPoints: number;
}

export interface PersonDetailWeekRow {
  splitId: string;
  splitName: string;
  splitWeekId: string;
  weekStartDate: Date;
  weekSequenceNumber: number;
  levelSnapshot: AnalyticsLevel;
  excluded: boolean;
  /** Asistencia real (`1.1.1`): `"PRESENT"` | `"ABSENT"` | `"UNKNOWN_LEGACY"` (publicacion anterior a esta version, sin dato). */
  attendance: "PRESENT" | "ABSENT" | "UNKNOWN_LEGACY";
  totalHours: number | null;
  /** Puntos KPI por hora de esta semana. `null` si no es calculable. */
  pointsPerHour: number | null;
  totalPointsValid: number | null;
  indexNormalized: number | null;
  restOfLevelAverage: number | null;
  restOfLevelCount: number;
  diffPpVsRest: number | null;
  cells: PersonDetailCell[];
}

function weightedCells(observations: readonly ResolvedObservation[], valueOf: (o: ResolvedObservation) => number | null): WeightedCell[] {
  const out: WeightedCell[] = [];
  for (const observation of observations) {
    const value = valueOf(observation);
    if (value === null) continue;
    out.push({ personId: observation.personId, splitId: observation.splitId, weekKey: formatCalendarDate(observation.weekStartDate), value });
  }
  return out;
}

export function buildPersonDetailWeeks(
  personId: string,
  personObservations: readonly ResolvedObservation[],
  teamIncludedObservations: readonly ResolvedObservation[],
): PersonDetailWeekRow[] {
  return [...personObservations]
    .sort((a, b) => a.weekStartDate.getTime() - b.weekStartDate.getTime())
    .map((observation) => {
      const weekTime = observation.weekStartDate.getTime();
      const restOfLevel = teamIncludedObservations.filter(
        (o) => o.personId !== personId && o.weekStartDate.getTime() === weekTime && o.levelSnapshot === observation.levelSnapshot,
      );
      const restCells = weightedCells(restOfLevel, (o) => o.totals.indexNormalized);
      const restPerPerson = collapseWeeksToPersonPeriod(collapseSimultaneousSplits(restCells));
      const restValues = [...restPerPerson.values()];
      const restAverage = mean(restValues);

      return {
        splitId: observation.splitId,
        splitName: observation.splitName,
        splitWeekId: observation.splitWeekId,
        weekStartDate: observation.weekStartDate,
        weekSequenceNumber: observation.weekSequenceNumber,
        levelSnapshot: observation.levelSnapshot,
        excluded: observation.excluded,
        attendance: observation.attendance,
        totalHours: observation.hours,
        pointsPerHour:
          observation.hours !== null && observation.totals.totalPointsValid !== null
            ? computeWeeklyPointsPerHour(observation.totals.totalPointsValid, observation.hours)
            : null,
        totalPointsValid: observation.excluded ? null : observation.totals.totalPointsValid,
        indexNormalized: observation.excluded ? null : observation.totals.indexNormalized,
        restOfLevelAverage: restAverage,
        restOfLevelCount: restValues.length,
        diffPpVsRest:
          !observation.excluded && observation.totals.indexNormalized !== null && restAverage !== null
            ? ppDifference(observation.totals.indexNormalized, restAverage)
            : null,
        cells: observation.cells.map((cell) => ({
          kpiCode: cell.kpiCode,
          kpiName: cell.kpiName,
          status: cell.status,
          x: cell.x,
          q: cell.q,
          basePoints: resolveCellBase({
            kpiCode: cell.kpiCode,
            kpiName: cell.kpiName,
            status: cell.status,
            finalPoints: cell.finalPoints,
            basePointsBeforeProfession: cell.basePointsBeforeProfession,
            baseMax: cell.max,
            professionBonusPoints: cell.professionBonusPoints,
            locationBonusPoints: cell.locationBonusPoints,
            equipmentBonusPoints: cell.equipmentBonusPoints,
          }).base,
          finalPoints: cell.finalPoints,
          professionBonusPoints: cell.professionBonusPoints,
          locationBonusPoints: cell.locationBonusPoints,
          equipmentBonusPoints: cell.equipmentBonusPoints,
        })),
      };
    });
}

export interface PersonDetailSummary {
  personId: string;
  personFullName: string;
  levels: AnalyticsLevel[];
  validWeekCount: number;
  excludedWeekCount: number;
  averageWeeklyPoints: number | null;
  teamIndex: number | null;
  /** Puntos KPI por hora del periodo: razon de sumas (G2), solo semanas presentes con horas validas. */
  pointsPerHour: number | null;
}

export function buildPersonDetailSummary(personId: string, personFullName: string, weeks: readonly PersonDetailWeekRow[]): PersonDetailSummary {
  const included = weeks.filter((w) => !w.excluded);
  const pointsCells: WeightedCell[] = included
    .filter((w) => w.totalPointsValid !== null)
    .map((w) => ({ personId, splitId: w.splitId, weekKey: formatCalendarDate(w.weekStartDate), value: w.totalPointsValid as number }));
  const indexCells: WeightedCell[] = included
    .filter((w) => w.indexNormalized !== null)
    .map((w) => ({ personId, splitId: w.splitId, weekKey: formatCalendarDate(w.weekStartDate), value: w.indexNormalized as number }));
  const pointsPerHour = computePeriodPointsPerHour(
    included
      .filter((w) => w.totalHours !== null && w.totalPointsValid !== null)
      .map((w) => ({ points: w.totalPointsValid as number, hours: w.totalHours as number })),
  );

  return {
    personId,
    personFullName,
    levels: [...new Set(weeks.map((w) => w.levelSnapshot))],
    validWeekCount: included.length,
    excludedWeekCount: weeks.length - included.length,
    averageWeeklyPoints: computeHierarchicalAverage(pointsCells).teamAverage,
    teamIndex: computeHierarchicalAverage(indexCells).teamAverage,
    pointsPerHour,
  };
}
