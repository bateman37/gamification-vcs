import { resolveCellBase } from "./base-points";
import { resolveCellValue, type ResolvedCellValue } from "./base-points";
import { computeObservationTotals, type ObservationTotals } from "./aggregation";
import { countApplicableZeroLikeKpis, resolveObservationExclusion, type ExclusionDecision, type ManualOverride } from "./exclusions";
import type { AnalyticsLevel, GamificationDisplayMode, ParticipantWeekObservation } from "./types";

/**
 * Observacion persona-split-semana ya resuelta para un modo y una politica
 * de exclusion concretos (parte F + E1). Es la unidad que consume el resto
 * del motor (KPI, indice total, distribucion, comparacion).
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
  excluded: boolean;
  exclusionDecision: ExclusionDecision;
  zeroLikeCount: number;
  /** Aviso F2: la observacion excluida contiene al menos un valor positivo entre sus KPI. */
  hasPositiveValueAmongExcluded: boolean;
  cells: ResolvedCellValue[];
  totals: ObservationTotals;
}

export interface ObservationResolutionOptions {
  mode: GamificationDisplayMode;
  exclusionEnabled: boolean;
  zeroThreshold: number;
  /** Excepciones manuales de la consulta actual, indexadas por `participantWeeklyResultId` (parte F2). */
  manualOverrides: ReadonlyMap<string, ManualOverride>;
}

export function resolveObservation(observation: ParticipantWeekObservation, options: ObservationResolutionOptions): ResolvedObservation {
  const zeroInputs = observation.cells.map((cell) => ({ status: cell.status, base: resolveCellBase(cell).base }));
  const zeroLikeCount = countApplicableZeroLikeKpis(zeroInputs);
  const override = options.manualOverrides.get(observation.participantWeeklyResultId);
  const exclusion = options.exclusionEnabled
    ? resolveObservationExclusion(zeroLikeCount, options.zeroThreshold, override)
    : { excluded: false, decision: "included_auto" as const, zeroLikeCount };

  const cells = observation.cells.map((cell) => resolveCellValue(cell, options.mode, exclusion.excluded, options.exclusionEnabled));
  const totals = computeObservationTotals(cells.map((cell) => ({ included: cell.included, x: cell.x, max: cell.max })));

  const hasPositiveValueAmongExcluded =
    exclusion.excluded &&
    observation.cells.some((cell) => {
      if (cell.status !== "COMPUTED") return false;
      const base = resolveCellBase(cell).base;
      return base !== null && base > 0;
    });

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
    excluded: exclusion.excluded,
    exclusionDecision: exclusion.decision,
    zeroLikeCount,
    hasPositiveValueAmongExcluded,
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
