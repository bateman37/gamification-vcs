import { Prisma, type ParticipantLevel } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import type { KpiConfigView } from "./mapping";
import { applyBaseMax, multiplierForLevel, type KpiComputation } from "./shared";

/**
 * Calculo de Aprendiz experto (`EXPERT_APPRENTICE`), ver
 * docs/MANUAL_KPI_ENTRY.md. Entrada manual (`ApprenticeWeeklyEntry`), con
 * `completedTrainings` limitado por `targetValue` configurado en el propio
 * servicio (no en la base de datos), para poder senalar valores historicos
 * que queden por encima si `targetValue` cambia mas adelante.
 */

export type ExpertApprenticeOutcome =
  /** El multiplicador de este nivel esta vacio: el KPI no aplica. */
  | { status: "not_applicable" }
  /** No hay entrada guardada para este participante en esta semana. */
  | { status: "no_data" }
  | ({ status: "computed" } & KpiComputation);

/**
 * `completedTrainings / targetValue x pointsAtTarget x multiplicador`,
 * limitado por `baseMax`. `targetValue` ya es positivo por la
 * configuracion del catalogo; un valor ausente o invalido es un error de
 * configuracion, no un estado de negocio.
 */
export function calculateExpertApprenticePoints(
  completedTrainings: number,
  targetValue: number,
  pointsAtTarget: number,
  levelMultiplier: number,
  baseMax: number,
): KpiComputation {
  if (!Number.isFinite(targetValue) || targetValue <= 0) {
    throw new DomainError('El parametro "Valor objetivo" de Aprendiz experto no esta configurado correctamente.');
  }
  const raw = new Prisma.Decimal(completedTrainings).div(targetValue).mul(pointsAtTarget).mul(levelMultiplier);
  return applyBaseMax(raw, baseMax);
}

export function resolveExpertApprenticeOutcome(
  config: KpiConfigView,
  level: ParticipantLevel,
  completedTrainings: number | undefined,
): ExpertApprenticeOutcome {
  const multiplier = multiplierForLevel(config, level);
  if (multiplier === null) return { status: "not_applicable" };
  if (completedTrainings === undefined) return { status: "no_data" };

  const targetValue = config.parameters.targetValue ?? 15;
  const pointsAtTarget = config.parameters.pointsAtTarget ?? 50;
  return {
    status: "computed",
    ...calculateExpertApprenticePoints(completedTrainings, targetValue, pointsAtTarget, multiplier, config.baseMax),
  };
}

export interface ExpertApprenticeOutcomeView {
  status: ExpertApprenticeOutcome["status"];
  rawPoints?: number;
  finalPoints?: number;
  capped?: boolean;
}

export function toExpertApprenticeOutcomeView(outcome: ExpertApprenticeOutcome | null): ExpertApprenticeOutcomeView | null {
  if (!outcome) return null;
  if (outcome.status !== "computed") return { status: outcome.status };
  return {
    status: "computed",
    rawPoints: outcome.rawPoints.toNumber(),
    finalPoints: outcome.finalPoints.toNumber(),
    capped: outcome.capped,
  };
}
