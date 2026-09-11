import { Prisma, type ParticipantLevel } from "@prisma/client";
import type { KpiConfigView } from "./mapping";
import { applyBaseMax, multiplierForLevel, type KpiComputation } from "./shared";

/**
 * Calculo de Estudiante entusiasta (`ENTHUSIASTIC_STUDENT`), ver
 * docs/MANUAL_KPI_ENTRY.md. Entrada manual (`StudentWeeklyEntry`). Un valor
 * `0` de horas dedicadas es un dato real, nunca vacaciones.
 */

export type EnthusiasticStudentOutcome =
  /** El multiplicador de este nivel esta vacio: el KPI no aplica. */
  | { status: "not_applicable" }
  /** No hay entrada guardada para este participante en esta semana. */
  | { status: "no_data" }
  | ({ status: "computed" } & KpiComputation);

/** `horas dedicadas x pointsPerHour x multiplicador`, limitado por `baseMax`. */
export function calculateEnthusiasticStudentPoints(
  dedicatedHours: number,
  pointsPerHour: number,
  levelMultiplier: number,
  baseMax: number,
): KpiComputation {
  const raw = new Prisma.Decimal(dedicatedHours).mul(pointsPerHour).mul(levelMultiplier);
  return applyBaseMax(raw, baseMax);
}

export function resolveEnthusiasticStudentOutcome(
  config: KpiConfigView,
  level: ParticipantLevel,
  dedicatedHours: number | undefined,
): EnthusiasticStudentOutcome {
  const multiplier = multiplierForLevel(config, level);
  if (multiplier === null) return { status: "not_applicable" };
  if (dedicatedHours === undefined) return { status: "no_data" };

  const pointsPerHour = config.parameters.pointsPerHour ?? 12.5;
  return { status: "computed", ...calculateEnthusiasticStudentPoints(dedicatedHours, pointsPerHour, multiplier, config.baseMax) };
}

export interface EnthusiasticStudentOutcomeView {
  status: EnthusiasticStudentOutcome["status"];
  rawPoints?: number;
  finalPoints?: number;
  capped?: boolean;
}

export function toEnthusiasticStudentOutcomeView(
  outcome: EnthusiasticStudentOutcome | null,
): EnthusiasticStudentOutcomeView | null {
  if (!outcome) return null;
  if (outcome.status !== "computed") return { status: outcome.status };
  return {
    status: "computed",
    rawPoints: outcome.rawPoints.toNumber(),
    finalPoints: outcome.finalPoints.toNumber(),
    capped: outcome.capped,
  };
}
