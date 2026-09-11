import { Prisma, type ParticipantLevel } from "@prisma/client";
import type { KpiConfigView } from "./mapping";

/**
 * Calculo de los dos KPI de productividad (Cazador de soluciones y
 * Explorador de datos), documentados en docs/IMPORT_PRODUCTIVITY.md. Son
 * funciones puras que usan aritmetica decimal (`Prisma.Decimal`, la misma
 * libreria que usa Prisma para sus columnas `Decimal`) para no depender de
 * errores de coma flotante de JavaScript. El maximo se aplica siempre
 * despues de calcular el resultado sin limite, nunca antes.
 */

export interface ProductivityKpiComputation {
  /** Puntos sin aplicar el maximo base. */
  rawPoints: Prisma.Decimal;
  /** Puntos finales, despues de aplicar el maximo base. */
  finalPoints: Prisma.Decimal;
  /** Si el maximo base ha limitado el resultado. */
  capped: boolean;
}

export type ProductivityKpiOutcome =
  /** El multiplicador de este nivel esta vacio: el KPI no aplica a esta persona. */
  | { status: "not_applicable" }
  /** No existe una fila importada para este participante en esta semana. */
  | { status: "no_data" }
  | ({ status: "computed" } & ProductivityKpiComputation);

function multiplierForLevel(config: KpiConfigView, level: ParticipantLevel): number | null {
  if (level === "N0") return config.multiplierN0;
  if (level === "N1") return config.multiplierN1;
  return config.multiplierN2;
}

function applyBaseMax(rawPoints: Prisma.Decimal, baseMax: number): ProductivityKpiComputation {
  const max = new Prisma.Decimal(baseMax);
  const capped = rawPoints.greaterThan(max);
  return { rawPoints, finalPoints: capped ? max : rawPoints, capped };
}

/** `tickets resueltos x pointsPerResolvedTicket x multiplicador del nivel`, limitado por `baseMax`. */
export function calculateSolutionHunterPoints(
  ticketsResolved: number,
  pointsPerResolvedTicket: number,
  levelMultiplier: number,
  baseMax: number,
): ProductivityKpiComputation {
  const raw = new Prisma.Decimal(ticketsResolved).mul(pointsPerResolvedTicket).mul(levelMultiplier);
  return applyBaseMax(raw, baseMax);
}

/** `tickets actualizados con comentario x pointsPerCommentedTicket x multiplicador del nivel`, limitado por `baseMax`. */
export function calculateDataExplorerPoints(
  ticketsUpdatedWithComment: number,
  pointsPerCommentedTicket: number,
  levelMultiplier: number,
  baseMax: number,
): ProductivityKpiComputation {
  const raw = new Prisma.Decimal(ticketsUpdatedWithComment).mul(pointsPerCommentedTicket).mul(levelMultiplier);
  return applyBaseMax(raw, baseMax);
}

/**
 * Resuelve el resultado de Cazador de soluciones para un participante:
 * "No aplica" si el nivel no tiene multiplicador, "Sin dato" si no hay fila
 * importada, o el calculo si hay dato y el nivel aplica.
 */
export function resolveSolutionHunterOutcome(
  config: KpiConfigView,
  level: ParticipantLevel,
  ticketsResolved: number | undefined,
): ProductivityKpiOutcome {
  const multiplier = multiplierForLevel(config, level);
  if (multiplier === null) return { status: "not_applicable" };
  if (ticketsResolved === undefined) return { status: "no_data" };
  const pointsPerResolvedTicket = config.parameters.pointsPerResolvedTicket ?? 1;
  return {
    status: "computed",
    ...calculateSolutionHunterPoints(ticketsResolved, pointsPerResolvedTicket, multiplier, config.baseMax),
  };
}

/** Igual que `resolveSolutionHunterOutcome`, para Explorador de datos. */
export function resolveDataExplorerOutcome(
  config: KpiConfigView,
  level: ParticipantLevel,
  ticketsUpdatedWithComment: number | undefined,
): ProductivityKpiOutcome {
  const multiplier = multiplierForLevel(config, level);
  if (multiplier === null) return { status: "not_applicable" };
  if (ticketsUpdatedWithComment === undefined) return { status: "no_data" };
  const pointsPerCommentedTicket = config.parameters.pointsPerCommentedTicket ?? 1;
  return {
    status: "computed",
    ...calculateDataExplorerPoints(ticketsUpdatedWithComment, pointsPerCommentedTicket, multiplier, config.baseMax),
  };
}

/**
 * Version serializable de `ProductivityKpiOutcome`, apta para devolverse
 * desde una accion de servidor o pasarse a un componente cliente (los
 * `Prisma.Decimal` no se pueden serializar directamente).
 */
export interface ProductivityKpiOutcomeView {
  status: ProductivityKpiOutcome["status"];
  rawPoints?: number;
  finalPoints?: number;
  capped?: boolean;
}

export function toProductivityKpiOutcomeView(
  outcome: ProductivityKpiOutcome | null,
): ProductivityKpiOutcomeView | null {
  if (!outcome) return null;
  if (outcome.status !== "computed") return { status: outcome.status };
  return {
    status: "computed",
    rawPoints: outcome.rawPoints.toNumber(),
    finalPoints: outcome.finalPoints.toNumber(),
    capped: outcome.capped,
  };
}
