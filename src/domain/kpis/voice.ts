import { Prisma, type ParticipantLevel } from "@prisma/client";
import type { KpiConfigView } from "./mapping";
import { applyBaseMax, multiplierForLevel, type KpiComputation } from "./shared";

/**
 * Calculo de Embajador de voz (`VOICE_AMBASSADOR`), ver
 * docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md. Funcion pura con aritmetica
 * decimal, sin suelo de cero. Las llamadas salientes se suman siempre
 * despues del multiplicador de nivel: no forman parte del bloque
 * multiplicado.
 */

export type VoiceAmbassadorOutcome =
  | { status: "not_applicable" }
  | { status: "no_data" }
  | ({ status: "computed" } & KpiComputation);

/**
 * `(aceptadas x acceptedWeight - rechazadas x rejectedPenalty - no atendidas x unattendedPenalty) x multiplicador + salientes x outboundPoints`,
 * limitado por `baseMax`.
 */
export function calculateVoiceAmbassadorPoints(
  acceptedCallSegments: number,
  rejectedCallSegments: number,
  unattendedCallSegments: number,
  outboundCalls: number,
  acceptedWeight: number,
  rejectedPenalty: number,
  unattendedPenalty: number,
  outboundPoints: number,
  levelMultiplier: number,
  baseMax: number,
): KpiComputation {
  const inboundBlock = new Prisma.Decimal(acceptedCallSegments)
    .mul(acceptedWeight)
    .minus(new Prisma.Decimal(rejectedCallSegments).mul(rejectedPenalty))
    .minus(new Prisma.Decimal(unattendedCallSegments).mul(unattendedPenalty));
  const raw = inboundBlock.mul(levelMultiplier).plus(new Prisma.Decimal(outboundCalls).mul(outboundPoints));
  return applyBaseMax(raw, baseMax);
}

export function resolveVoiceAmbassadorOutcome(
  config: KpiConfigView,
  level: ParticipantLevel,
  acceptedCallSegments: number | undefined,
  rejectedCallSegments: number | undefined,
  unattendedCallSegments: number | undefined,
  outboundCalls: number | undefined,
): VoiceAmbassadorOutcome {
  const multiplier = multiplierForLevel(config, level);
  if (multiplier === null) return { status: "not_applicable" };
  if (
    acceptedCallSegments === undefined ||
    rejectedCallSegments === undefined ||
    unattendedCallSegments === undefined ||
    outboundCalls === undefined
  ) {
    return { status: "no_data" };
  }

  const acceptedWeight = config.parameters.acceptedWeight ?? 1;
  const rejectedPenalty = config.parameters.rejectedPenalty ?? 1;
  const unattendedPenalty = config.parameters.unattendedPenalty ?? 1;
  const outboundPoints = config.parameters.outboundPoints ?? 1;
  return {
    status: "computed",
    ...calculateVoiceAmbassadorPoints(
      acceptedCallSegments,
      rejectedCallSegments,
      unattendedCallSegments,
      outboundCalls,
      acceptedWeight,
      rejectedPenalty,
      unattendedPenalty,
      outboundPoints,
      multiplier,
      config.baseMax,
    ),
  };
}

export interface VoiceAmbassadorOutcomeView {
  status: VoiceAmbassadorOutcome["status"];
  rawPoints?: number;
  finalPoints?: number;
  capped?: boolean;
}

export function toVoiceAmbassadorOutcomeView(outcome: VoiceAmbassadorOutcome | null): VoiceAmbassadorOutcomeView | null {
  if (!outcome) return null;
  if (outcome.status !== "computed") return { status: outcome.status };
  return {
    status: "computed",
    rawPoints: outcome.rawPoints.toNumber(),
    finalPoints: outcome.finalPoints.toNumber(),
    capped: outcome.capped,
  };
}
