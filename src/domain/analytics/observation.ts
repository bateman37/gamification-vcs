import { resolveCellBase } from "./base-points";
import { resolveCellValue, type ResolvedCellValue } from "./base-points";
import { computeObservationTotals, type ObservationTotals } from "./aggregation";
import type { AnalyticsLevel, GamificationDisplayMode, ParticipantWeekObservation } from "./types";

/**
 * Observacion persona-split-semana ya resuelta para un modo concreto (parte
 * E1 del encargo `1.1.1`). Es la unidad que consume el resto del motor (KPI,
 * indice total, distribucion, comparacion, puntos por hora).
 *
 * Sustituye la politica de ceros/ausencias posibles de `1.1.0`
 * (`excludeZeroObservations`/`zeroThreshold`/`manualOverrides`, ver
 * docs/DECISIONS.md) por la asistencia real publicada: `attendanceStatus =
 * ABSENT` queda siempre fuera de rendimiento; `attendanceStatus = PRESENT`
 * entra siempre, aunque tenga todos sus KPI a cero; una publicacion anterior
 * a `1.1.1` (`attendanceStatus` desconocido) tambien queda fuera de las
 * estadisticas de rendimiento (nunca se inventa una asistencia), pero se
 * contabiliza aparte como cobertura legacy desconocida. Esta exclusion ya no
 * es revisable manualmente: corregir una ausencia exige corregir la carga
 * antes de publicar, la instantanea publicada es inmutable despues.
 */
export interface ResolvedObservation {
  personId: string;
  personFullName: string;
  splitId: string;
  splitName: string;
  splitParticipantId: string;
  participantWeeklyResultId: string;
  splitWeekId: string;
  weekSequenceNumber: number;
  weekStartDate: Date;
  publishedAt: Date;
  levelSnapshot: AnalyticsLevel;
  creditsEarned: number;
  /** Asistencia tal como esta publicada. `"UNKNOWN_LEGACY"` para publicaciones anteriores a `1.1.1`. */
  attendance: "PRESENT" | "ABSENT" | "UNKNOWN_LEGACY";
  /** Horas totales de la semana, solo cuando `attendance === "PRESENT"`. */
  hours: number | null;
  /** `true` cuando `attendance !== "PRESENT"`: fuera de todas las estadisticas de rendimiento. */
  excluded: boolean;
  cells: ResolvedCellValue[];
  totals: ObservationTotals;
}

export interface ObservationResolutionOptions {
  mode: GamificationDisplayMode;
}

function resolveAttendance(observation: ParticipantWeekObservation): "PRESENT" | "ABSENT" | "UNKNOWN_LEGACY" {
  if (observation.attendanceStatus === null) return "UNKNOWN_LEGACY";
  return observation.attendanceStatus;
}

export function resolveObservation(observation: ParticipantWeekObservation, options: ObservationResolutionOptions): ResolvedObservation {
  const attendance = resolveAttendance(observation);
  const excluded = attendance !== "PRESENT";

  const cells = observation.cells.map((cell) => resolveCellValue(cell, options.mode, excluded));
  const totals = computeObservationTotals(cells.map((cell) => ({ included: cell.included, x: cell.x, max: cell.max })));

  return {
    personId: observation.personId,
    personFullName: observation.personFullName,
    splitId: observation.splitId,
    splitName: observation.splitName,
    splitParticipantId: observation.splitParticipantId,
    participantWeeklyResultId: observation.participantWeeklyResultId,
    splitWeekId: observation.splitWeekId,
    weekSequenceNumber: observation.weekSequenceNumber,
    weekStartDate: observation.weekStartDate,
    publishedAt: observation.publishedAt,
    levelSnapshot: observation.levelSnapshot,
    creditsEarned: observation.creditsEarned,
    attendance,
    hours: attendance === "PRESENT" ? observation.totalHours : null,
    excluded,
    cells,
    totals,
  };
}

export function resolveObservations(
  observations: readonly ParticipantWeekObservation[],
  options: ObservationResolutionOptions,
): ResolvedObservation[] {
  return observations.map((observation) => resolveObservation(observation, options));
}

export { resolveCellBase };
