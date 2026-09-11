import { Prisma, type ParticipantLevel } from "@prisma/client";
import type { KpiConfigView } from "./mapping";
import { applyBaseMax, multiplierForLevel, type KpiComputation } from "./shared";

/**
 * Calculo de Maestro Artesano (`MASTER_CRAFTSMAN`), ver
 * docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md. Funcion pura con aritmetica
 * decimal, sin suelo de cero.
 */

export type MasterCraftsmanOutcome =
  | { status: "not_applicable" }
  | { status: "no_data" }
  | ({ status: "computed" } & KpiComputation);

/** `(buenas x positiveWeight - malas x negativePenalty) x scale x multiplicador`, limitado por `baseMax`. */
export function calculateMasterCraftsmanPoints(
  goodSatisfactionTickets: number,
  badSatisfactionTickets: number,
  positiveWeight: number,
  negativePenalty: number,
  scale: number,
  levelMultiplier: number,
  baseMax: number,
): KpiComputation {
  const raw = new Prisma.Decimal(goodSatisfactionTickets)
    .mul(positiveWeight)
    .minus(new Prisma.Decimal(badSatisfactionTickets).mul(negativePenalty))
    .mul(scale)
    .mul(levelMultiplier);
  return applyBaseMax(raw, baseMax);
}

export function resolveMasterCraftsmanOutcome(
  config: KpiConfigView,
  level: ParticipantLevel,
  goodSatisfactionTickets: number | undefined,
  badSatisfactionTickets: number | undefined,
): MasterCraftsmanOutcome {
  const multiplier = multiplierForLevel(config, level);
  if (multiplier === null) return { status: "not_applicable" };
  if (goodSatisfactionTickets === undefined || badSatisfactionTickets === undefined) return { status: "no_data" };

  const positiveWeight = config.parameters.positiveWeight ?? 1;
  const negativePenalty = config.parameters.negativePenalty ?? 4;
  const scale = config.parameters.scale ?? 10;
  return {
    status: "computed",
    ...calculateMasterCraftsmanPoints(
      goodSatisfactionTickets,
      badSatisfactionTickets,
      positiveWeight,
      negativePenalty,
      scale,
      multiplier,
      config.baseMax,
    ),
  };
}

export interface MasterCraftsmanOutcomeView {
  status: MasterCraftsmanOutcome["status"];
  rawPoints?: number;
  finalPoints?: number;
  capped?: boolean;
}

export function toMasterCraftsmanOutcomeView(outcome: MasterCraftsmanOutcome | null): MasterCraftsmanOutcomeView | null {
  if (!outcome) return null;
  if (outcome.status !== "computed") return { status: outcome.status };
  return {
    status: "computed",
    rawPoints: outcome.rawPoints.toNumber(),
    finalPoints: outcome.finalPoints.toNumber(),
    capped: outcome.capped,
  };
}
