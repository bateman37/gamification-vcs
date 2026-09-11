import { Prisma, type ParticipantLevel } from "@prisma/client";
import type { KpiConfigView } from "./mapping";
import { applyBaseMax, multiplierForLevel, type KpiComputation } from "./shared";

/**
 * Calculo de Cronomagia laboral (`WORK_CHRONOMANCY`), ver
 * docs/MANUAL_KPI_ENTRY.md. Entrada manual (`ChronomancyWeeklyEntry`):
 * `totalHours = 0` significa vacaciones toda la semana (VAC, sin puntos),
 * con prioridad sobre el calculo. El occupancy se limita al 100% para
 * mostrar y puntuar, pero nunca se redondea antes de aplicar el maximo.
 */

export type WorkChronomancyOutcome =
  /** El multiplicador de este nivel esta vacio: el KPI no aplica. */
  | { status: "not_applicable" }
  /** No hay entrada guardada para este participante en esta semana. */
  | { status: "no_data" }
  /** `totalHours = 0`: vacaciones toda la semana, sin puntos. */
  | { status: "vac" }
  | ({ status: "computed"; occupancy: number } & KpiComputation);

/**
 * `occupancy limitado x pointsAtFullOccupancy x multiplicador`, limitado
 * por `baseMax`. No divide si `totalHours` es 0: eso lo resuelve el
 * llamador antes de invocar esta funcion.
 */
export function calculateWorkChronomancyPoints(
  productiveHours: number,
  totalHours: number,
  pointsAtFullOccupancy: number,
  levelMultiplier: number,
  baseMax: number,
): KpiComputation & { occupancy: Prisma.Decimal } {
  const rawOccupancy = new Prisma.Decimal(productiveHours).div(totalHours);
  const cappedOccupancy = rawOccupancy.greaterThan(1) ? new Prisma.Decimal(1) : rawOccupancy;
  const raw = cappedOccupancy.mul(pointsAtFullOccupancy).mul(levelMultiplier);
  return { occupancy: cappedOccupancy, ...applyBaseMax(raw, baseMax) };
}

export function resolveWorkChronomancyOutcome(
  config: KpiConfigView,
  level: ParticipantLevel,
  productiveHours: number | undefined,
  totalHours: number | undefined,
): WorkChronomancyOutcome {
  const multiplier = multiplierForLevel(config, level);
  if (multiplier === null) return { status: "not_applicable" };
  if (totalHours === undefined || productiveHours === undefined) return { status: "no_data" };
  if (totalHours === 0) return { status: "vac" };

  const pointsAtFullOccupancy = config.parameters.pointsAtFullOccupancy ?? 60;
  const { occupancy, ...computation } = calculateWorkChronomancyPoints(
    productiveHours,
    totalHours,
    pointsAtFullOccupancy,
    multiplier,
    config.baseMax,
  );
  return { status: "computed", occupancy: occupancy.toNumber(), ...computation };
}

export interface WorkChronomancyOutcomeView {
  status: WorkChronomancyOutcome["status"];
  occupancy?: number;
  rawPoints?: number;
  finalPoints?: number;
  capped?: boolean;
}

export function toWorkChronomancyOutcomeView(outcome: WorkChronomancyOutcome | null): WorkChronomancyOutcomeView | null {
  if (!outcome) return null;
  if (outcome.status !== "computed") return { status: outcome.status };
  return {
    status: "computed",
    occupancy: outcome.occupancy,
    rawPoints: outcome.rawPoints.toNumber(),
    finalPoints: outcome.finalPoints.toNumber(),
    capped: outcome.capped,
  };
}
