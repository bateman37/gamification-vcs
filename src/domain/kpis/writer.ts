import { Prisma, type ParticipantLevel } from "@prisma/client";
import type { KpiConfigView } from "./mapping";
import { applyBaseMax, multiplierForLevel, type KpiComputation } from "./shared";

/**
 * Calculo de Redactor estrella (`STAR_WRITER`), ver
 * docs/MANUAL_KPI_ENTRY.md. Entrada manual (`WriterWeeklyEntry`) con tres
 * conteos separados: entregados, no entregados (siempre un conteo
 * positivo; el calculo aplica la resta) y propuestos. El multiplicador solo
 * afecta a los articulos entregados. Sin suelo de cero: un resultado
 * negativo es valido.
 */

export type StarWriterOutcome =
  /** El multiplicador de este nivel esta vacio: el KPI no aplica. */
  | { status: "not_applicable" }
  /** No hay entrada guardada para este participante en esta semana. */
  | { status: "no_data" }
  | ({ status: "computed" } & KpiComputation);

/**
 * `entregados x approvedArticlePoints x multiplicador - no entregados x negativeArticlePoints + propuestos x proposalPoints`,
 * limitado por `baseMax`.
 */
export function calculateStarWriterPoints(
  deliveredArticles: number,
  undeliveredArticles: number,
  proposedArticles: number,
  approvedArticlePoints: number,
  negativeArticlePoints: number,
  proposalPoints: number,
  levelMultiplier: number,
  baseMax: number,
): KpiComputation {
  const delivered = new Prisma.Decimal(deliveredArticles).mul(approvedArticlePoints).mul(levelMultiplier);
  const undelivered = new Prisma.Decimal(undeliveredArticles).mul(negativeArticlePoints);
  const proposed = new Prisma.Decimal(proposedArticles).mul(proposalPoints);
  const raw = delivered.minus(undelivered).plus(proposed);
  return applyBaseMax(raw, baseMax);
}

export function resolveStarWriterOutcome(
  config: KpiConfigView,
  level: ParticipantLevel,
  deliveredArticles: number | undefined,
  undeliveredArticles: number | undefined,
  proposedArticles: number | undefined,
): StarWriterOutcome {
  const multiplier = multiplierForLevel(config, level);
  if (multiplier === null) return { status: "not_applicable" };
  if (deliveredArticles === undefined || undeliveredArticles === undefined || proposedArticles === undefined) {
    return { status: "no_data" };
  }

  const approvedArticlePoints = config.parameters.approvedArticlePoints ?? 10;
  const negativeArticlePoints = config.parameters.negativeArticlePoints ?? 10;
  const proposalPoints = config.parameters.proposalPoints ?? 5;
  return {
    status: "computed",
    ...calculateStarWriterPoints(
      deliveredArticles,
      undeliveredArticles,
      proposedArticles,
      approvedArticlePoints,
      negativeArticlePoints,
      proposalPoints,
      multiplier,
      config.baseMax,
    ),
  };
}

export interface StarWriterOutcomeView {
  status: StarWriterOutcome["status"];
  rawPoints?: number;
  finalPoints?: number;
  capped?: boolean;
}

export function toStarWriterOutcomeView(outcome: StarWriterOutcome | null): StarWriterOutcomeView | null {
  if (!outcome) return null;
  if (outcome.status !== "computed") return { status: outcome.status };
  return {
    status: "computed",
    rawPoints: outcome.rawPoints.toNumber(),
    finalPoints: outcome.finalPoints.toNumber(),
    capped: outcome.capped,
  };
}
