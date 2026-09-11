import { Prisma, type ParticipantLevel } from "@prisma/client";
import type { KpiConfigView } from "./mapping";
import { applyBaseMax, multiplierForLevel, type KpiComputation } from "./shared";

/**
 * Calculo de Guardian de la Estabilidad (`STABILITY_GUARDIAN`), ver
 * docs/MANUAL_KPI_ENTRY.md. Entrada manual (`StabilityWeeklyEntry`), solo
 * para participantes N2. Un resultado `0` es un dato real, nunca vacaciones.
 */

export type StabilityGuardianOutcome =
  /** El multiplicador de este nivel esta vacio: el KPI no aplica. */
  | { status: "not_applicable" }
  /** No hay entrada guardada para este participante en esta semana. */
  | { status: "no_data" }
  | ({ status: "computed" } & KpiComputation);

/** `resultados x pointsPerResult x multiplicador`, limitado por `baseMax`. */
export function calculateStabilityGuardianPoints(
  resultValue: number,
  pointsPerResult: number,
  levelMultiplier: number,
  baseMax: number,
): KpiComputation {
  const raw = new Prisma.Decimal(resultValue).mul(pointsPerResult).mul(levelMultiplier);
  return applyBaseMax(raw, baseMax);
}

export function resolveStabilityGuardianOutcome(
  config: KpiConfigView,
  level: ParticipantLevel,
  resultValue: number | undefined,
): StabilityGuardianOutcome {
  const multiplier = multiplierForLevel(config, level);
  if (multiplier === null) return { status: "not_applicable" };
  if (resultValue === undefined) return { status: "no_data" };

  const pointsPerResult = config.parameters.pointsPerResult ?? 30;
  return { status: "computed", ...calculateStabilityGuardianPoints(resultValue, pointsPerResult, multiplier, config.baseMax) };
}

export interface StabilityGuardianOutcomeView {
  status: StabilityGuardianOutcome["status"];
  rawPoints?: number;
  finalPoints?: number;
  capped?: boolean;
}

export function toStabilityGuardianOutcomeView(outcome: StabilityGuardianOutcome | null): StabilityGuardianOutcomeView | null {
  if (!outcome) return null;
  if (outcome.status !== "computed") return { status: outcome.status };
  return {
    status: "computed",
    rawPoints: outcome.rawPoints.toNumber(),
    finalPoints: outcome.finalPoints.toNumber(),
    capped: outcome.capped,
  };
}
