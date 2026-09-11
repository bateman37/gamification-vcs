import { Prisma, type ParticipantLevel } from "@prisma/client";
import type { KpiConfigView } from "./mapping";
import { applyBaseMax, multiplierForLevel, type KpiComputation } from "./shared";

/**
 * Calculo de Domador de Escaladas (`ESCALATION_TAMER`), ver
 * docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md. Depende de dos origenes de la
 * misma semana y participante: el Excel de Escalados (`groupReassignments`)
 * y Productividad ya persistida (`updates`). Funcion pura con aritmetica
 * decimal, sin suelo de cero.
 *
 * Hotfix (`MVP-1C.3 / INPUT-1C`): cuando ya existe una carga de Escalados
 * confirmada para la semana pero la persona no aparece en ella, sus
 * reasignaciones de grupo se interpretan como cero implicito (nunca se
 * inserta una fila artificial: la inferencia pertenece solo al resultado
 * calculado), siempre que exista fila de Productividad para esa persona.
 * Si tampoco existe fila de Productividad, la ausencia en ambos origenes es
 * `VAC` (sin puntos), distinta de "Falta Productividad" (que sigue
 * aplicando solo cuando existe una fila real de Escalados). Ver
 * docs/DECISIONS.md.
 */

export type EscalationTamerOutcome =
  /** El multiplicador de este nivel esta vacio: el KPI no aplica. */
  | { status: "not_applicable" }
  /** No existe carga de Escalados confirmada para esta semana. */
  | { status: "no_escalation_data" }
  /** No existe fila de Escalados (real ni inferida) ni de Productividad. */
  | { status: "vac" }
  /** Existe fila de Escalados (real) pero no de Productividad. */
  | { status: "no_productivity_data" }
  /** Reasignaciones (reales o inferidas) conocidas pero Actualizaciones es 0. */
  | { status: "zero_updates"; inferred: boolean }
  | ({ status: "computed"; inferred: boolean } & KpiComputation);

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

export interface EscalationTamerInput {
  /** Si existe una carga de Escalados confirmada para esta semana (no si esta persona tiene fila en ella). */
  hasEscalationImport: boolean;
  /** Reasignaciones reales, solo si existe fila de Escalados para esta persona. */
  groupReassignments: number | undefined;
  /** Actualizaciones de Productividad de la misma semana y participante, si existe fila. */
  updates: number | undefined;
}

/**
 * Resuelve el resultado de Domador de Escaladas para un participante,
 * distinguiendo, en este orden de prioridad: "No aplica", "Sin dato de
 * Escalados" (no existe la carga), "VAC" (existe la carga pero la persona
 * no tiene fila ni en Escalados ni en Productividad), "Falta Productividad"
 * (fila real de Escalados sin Productividad), "No calculable:
 * Actualizaciones es 0" y "Calculado". Cuando la persona no tiene fila real
 * de Escalados pero la carga existe y si tiene fila de Productividad, las
 * reasignaciones se interpretan como cero implicito (`inferred: true`).
 */
export function resolveEscalationTamerOutcome(
  config: KpiConfigView,
  level: ParticipantLevel,
  input: EscalationTamerInput,
): EscalationTamerOutcome {
  const multiplier = multiplierForLevel(config, level);
  if (multiplier === null) return { status: "not_applicable" };
  if (!input.hasEscalationImport) return { status: "no_escalation_data" };

  const basePoints = config.parameters.basePoints ?? 30;
  const ratioPenaltyFactor = config.parameters.ratioPenaltyFactor ?? 200;

  if (input.groupReassignments !== undefined) {
    // Fila real de Escalados.
    if (input.updates === undefined) return { status: "no_productivity_data" };
    if (input.updates === 0) return { status: "zero_updates", inferred: false };
    return {
      status: "computed",
      inferred: false,
      ...calculateEscalationTamerPoints(input.groupReassignments, input.updates, basePoints, ratioPenaltyFactor, multiplier, config.baseMax),
    };
  }

  // Sin fila real de Escalados, pero la carga existe: cero implicito si hay Productividad.
  if (input.updates === undefined) return { status: "vac" };
  if (input.updates === 0) return { status: "zero_updates", inferred: true };
  return {
    status: "computed",
    inferred: true,
    ...calculateEscalationTamerPoints(0, input.updates, basePoints, ratioPenaltyFactor, multiplier, config.baseMax),
  };
}

export interface EscalationTamerOutcomeView {
  status: EscalationTamerOutcome["status"];
  inferred?: boolean;
  rawPoints?: number;
  finalPoints?: number;
  capped?: boolean;
}

export function toEscalationTamerOutcomeView(outcome: EscalationTamerOutcome | null): EscalationTamerOutcomeView | null {
  if (!outcome) return null;
  if (outcome.status === "zero_updates") return { status: outcome.status, inferred: outcome.inferred };
  if (outcome.status !== "computed") return { status: outcome.status };
  return {
    status: "computed",
    inferred: outcome.inferred,
    rawPoints: outcome.rawPoints.toNumber(),
    finalPoints: outcome.finalPoints.toNumber(),
    capped: outcome.capped,
  };
}
