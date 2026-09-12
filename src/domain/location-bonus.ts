import { Prisma } from "@prisma/client";
import type { KpiCode } from "@/domain/kpis/catalog";
import { ALLOWED_BONUS_PERCENTS, isAllowedBonusPercent } from "@/domain/bonus-percent";

/**
 * Bonus de localizacion semanal (`0.8.5` / MVP-2C, ver
 * docs/WEEKLY_LOCATIONS.md). Unica funcion de dominio que decide si un
 * resultado de KPI recibe el bonus de la localizacion de esa semana y
 * cuanto suma. Espeja exactamente el patron de
 * `src/domain/profession-bonus.ts`, pero con un porcentaje variable
 * (10/20/30/40/50, uno por semana) y un unico KPI potenciado en vez de dos.
 * No depende del nivel tecnico, de la faccion ni de la profesion del
 * participante.
 *
 * Orden exacto del calculo (seccion 10 del encargo): igual que la
 * profesion, actua sobre `baseFinalPoints` (los puntos tras el maximo base)
 * y nunca sobre un resultado que ya incluya el bonus de profesion. Los dos
 * bonus son independientes y no se encadenan: ver la composicion en
 * `weekly-results.service.ts`.
 */

/**
 * Conjunto cerrado de porcentajes permitidos. Reexporta la lista tipada
 * compartida con el bonus de objetos de equipo (`0.9.0` / MVP-2D, ver
 * `src/domain/bonus-percent.ts`): misma fuente de verdad, sin acoplar las
 * dos entidades entre si.
 */
export const LOCATION_BONUS_PERCENTS = ALLOWED_BONUS_PERCENTS;
export type LocationBonusPercent = (typeof LOCATION_BONUS_PERCENTS)[number];

export function isAllowedLocationBonusPercent(value: number): value is LocationBonusPercent {
  return isAllowedBonusPercent(value);
}

/** Texto canonico del bonus para un porcentaje concreto, para no repetirlo literal en la interfaz. */
export function locationBonusLabel(bonusPercent: number): string {
  return `+${bonusPercent} % después del máximo base`;
}

/** Datos minimos de una localizacion necesarios para decidir y explicar el bonus. */
export interface ApplicableWeekLocation {
  id: string;
  name: string;
  kpiCode: KpiCode;
  bonusPercent: LocationBonusPercent;
}

export interface LocationBonusOutcome {
  /** Puntos antes de localizacion: exactamente el resultado tras el maximo base (el mismo que recibe la profesion). */
  basePoints: Prisma.Decimal;
  /** Puntos anadidos por la localizacion. `0` cuando no se aplica. */
  bonusPoints: Prisma.Decimal;
  /** Puntos finales de esta capa (`basePoints + bonusPoints`), antes de sumar el bonus de profesion. */
  finalPoints: Prisma.Decimal;
  /** `true` solo si el bonus se ha aplicado realmente a este KPI. */
  applied: boolean;
  locationId: string | null;
  locationName: string | null;
  bonusPercent: number | null;
}

/**
 * Aplica el bonus de localizacion a un resultado de KPI ya limitado por su
 * maximo base. El llamador solo debe invocarla para resultados `COMPUTED`
 * de KPI activos de participantes aplicables esa semana: `VAC`,
 * `NOT_APPLICABLE` y los KPI inactivos nunca llegan aqui.
 *
 * No se aplica bonus cuando:
 * - la semana no tiene localizacion (`location === null`);
 * - el KPI no es el que potencia la localizacion;
 * - los puntos tras el maximo base no son estrictamente positivos (`0` y
 *   negativos quedan exactamente igual: un bonus nunca debe empeorar una
 *   puntuacion negativa).
 */
export function applyLocationBonus(
  basePoints: Prisma.Decimal,
  kpiCode: KpiCode,
  location: ApplicableWeekLocation | null,
): LocationBonusOutcome {
  const notApplied: LocationBonusOutcome = {
    basePoints,
    bonusPoints: new Prisma.Decimal(0),
    finalPoints: basePoints,
    applied: false,
    locationId: null,
    locationName: null,
    bonusPercent: null,
  };

  if (!location) return notApplied;
  if (location.kpiCode !== kpiCode) return notApplied;
  if (!basePoints.greaterThan(0)) return notApplied;

  // Sin redondeo intermedio: el redondeo solo ocurre al persistir, con la escala del campo Decimal.
  const bonusPoints = basePoints.mul(new Prisma.Decimal(location.bonusPercent).div(100));

  return {
    basePoints,
    bonusPoints,
    finalPoints: basePoints.plus(bonusPoints),
    applied: true,
    locationId: location.id,
    locationName: location.name,
    bonusPercent: location.bonusPercent,
  };
}
