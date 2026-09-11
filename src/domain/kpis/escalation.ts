import { Prisma, type ParticipantLevel } from "@prisma/client";
import type { KpiConfigView } from "./mapping";
import { applyBaseMax, multiplierForLevel, type KpiComputation } from "./shared";

/**
 * Calculo de Domador de Escaladas (`ESCALATION_TAMER`), ver
 * docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md. Depende de dos origenes de la
 * misma semana y participante: el Excel de Escalados (`groupReassignments`)
 * y Productividad ya persistida (`updates`). Funcion pura con aritmetica
 * decimal, sin suelo de cero.
 */

export type EscalationTamerOutcome =
  /** El multiplicador de este nivel esta vacio: el KPI no aplica. */
  | { status: "not_applicable" }
  /** No existe fila de Escalados para este participante en esta semana. */
  | { status: "no_escalation_data" }
  /** Existe fila de Escalados pero no de Productividad. */
  | { status: "no_productivity_data" }
  /** Ambas filas existen pero Actualizaciones (denominador) es 0. */
  | { status: "zero_updates" }
  | ({ status: "computed" } & KpiComputation);

/**
 * `(basePoints - (groupReassignments / updates) x ratioPenaltyFactor) x multiplicador`,
 * limitado por `baseMax`. No divide si `updates` es 0: eso lo resuelve el
 * llamador antes de invocar esta funcion.
 */
export function calculateEscalationTamerPoints(
  groupReassignments: number,
  updates: number,
  basePoints: number,
  ratioPenaltyFactor: number,
  levelMultiplier: number,
  baseMax: number,
): KpiComputation {
  const ratio = new Prisma.Decimal(groupReassignments).div(updates);
  const raw = new Prisma.Decimal(basePoints).minus(ratio.mul(ratioPenaltyFactor)).mul(levelMultiplier);
  return applyBaseMax(raw, baseMax);
}

/**
 * Resuelve el resultado de Domador de Escaladas para un participante,
 * distinguiendo "No aplica" (prioritario), "Sin dato de Escalados", "Falta
 * Productividad" y "No calculable: Actualizaciones es 0" antes de calcular.
 */
export function resolveEscalationTamerOutcome(
  config: KpiConfigView,
  level: ParticipantLevel,
  groupReassignments: number | undefined,
  updates: number | undefined,
): EscalationTamerOutcome {
  const multiplier = multiplierForLevel(config, level);
  if (multiplier === null) return { status: "not_applicable" };
  if (groupReassignments === undefined) return { status: "no_escalation_data" };
  if (updates === undefined) return { status: "no_productivity_data" };
  if (updates === 0) return { status: "zero_updates" };

  const basePoints = config.parameters.basePoints ?? 30;
  const ratioPenaltyFactor = config.parameters.ratioPenaltyFactor ?? 200;
  return {
    status: "computed",
    ...calculateEscalationTamerPoints(groupReassignments, updates, basePoints, ratioPenaltyFactor, multiplier, config.baseMax),
  };
}

export interface EscalationTamerOutcomeView {
  status: EscalationTamerOutcome["status"];
  rawPoints?: number;
  finalPoints?: number;
  capped?: boolean;
}

export function toEscalationTamerOutcomeView(outcome: EscalationTamerOutcome | null): EscalationTamerOutcomeView | null {
  if (!outcome) return null;
  if (outcome.status !== "computed") return { status: outcome.status };
  return {
    status: "computed",
    rawPoints: outcome.rawPoints.toNumber(),
    finalPoints: outcome.finalPoints.toNumber(),
    capped: outcome.capped,
  };
}
