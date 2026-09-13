import { consolidatePphAcrossSplits, computePeriodPointsPerHour, type SplitWeekPphObservation } from "@/domain/points-per-hour";
import { formatCalendarDate } from "@/lib/dates";
import { mean } from "./aggregation";
import type { ResolvedObservation } from "./observation";

/**
 * Puntos por hora del equipo y por persona (`1.1.1`, ver
 * docs/WEEKLY_ATTENDANCE_AND_HOURS.md, parte G del encargo). Nunca la media
 * simple de los `%`/puntos ya agregados: siempre razon de sumas (G2) sobre
 * puntos y horas presentes, consolidando primero los splits simultaneos de
 * la misma persona y semana de calendario (G3): horas iguales se usan una
 * sola vez con la media de los puntos equivalentes; horas distintas marcan
 * una incidencia y esa persona-semana queda fuera del PPH combinado (nunca
 * se elige un valor arbitrariamente).
 */
export interface TeamPointsPerHourResult {
  teamPointsPerHour: number | null;
  /** PPH del periodo por persona (razon de sumas). */
  personPointsPerHour: Map<string, number>;
  /** Personas-semana con horas inconsistentes entre splits simultaneos, excluidas del PPH combinado. */
  inconsistentPersonWeekCount: number;
  analyzablePersonCount: number;
}

export function computeTeamPointsPerHour(
  observations: readonly ResolvedObservation[],
  pointsOf: (observation: ResolvedObservation) => number | null,
): TeamPointsPerHourResult {
  const byPersonWeek = new Map<string, SplitWeekPphObservation[]>();
  for (const observation of observations) {
    if (observation.hours === null) continue;
    const points = pointsOf(observation);
    if (points === null) continue;
    const key = `${observation.personId}__${formatCalendarDate(observation.weekStartDate)}`;
    const list = byPersonWeek.get(key) ?? [];
    list.push({ splitId: observation.splitId, points, hours: observation.hours });
    byPersonWeek.set(key, list);
  }

  let inconsistentPersonWeekCount = 0;
  const personWeekValues = new Map<string, { points: number; hours: number }>();
  for (const [key, splitObservations] of byPersonWeek) {
    const consolidation = consolidatePphAcrossSplits(splitObservations);
    if (consolidation.status === "inconsistent_hours") {
      inconsistentPersonWeekCount += 1;
      continue;
    }
    personWeekValues.set(key, { points: consolidation.points, hours: consolidation.hours });
  }

  const entriesByPerson = new Map<string, { points: number; hours: number }[]>();
  for (const [key, value] of personWeekValues) {
    const personId = key.split("__")[0] as string;
    const list = entriesByPerson.get(personId) ?? [];
    list.push(value);
    entriesByPerson.set(personId, list);
  }

  const personPointsPerHour = new Map<string, number>();
  for (const [personId, entries] of entriesByPerson) {
    const ratio = computePeriodPointsPerHour(entries);
    if (ratio !== null) personPointsPerHour.set(personId, ratio);
  }

  return {
    teamPointsPerHour: mean([...personPointsPerHour.values()]),
    personPointsPerHour,
    inconsistentPersonWeekCount,
    analyzablePersonCount: personPointsPerHour.size,
  };
}
