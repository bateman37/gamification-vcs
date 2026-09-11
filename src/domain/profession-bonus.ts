import { Prisma, type ParticipantLevel } from "@prisma/client";
import type { KpiCode } from "@/domain/kpis/catalog";

/**
 * Bonus de profesion (`0.8.0` / MVP-2B, ver
 * docs/PROFESSIONS_AND_PROFILES.md). Unica funcion de dominio que decide si
 * un resultado de KPI recibe el bonus fijo del `+20 %` y cuanto suma. No
 * existe ninguna otra multiplicacion por `1.2`, `0.2` ni `20` repartida por
 * servicios, resolvers o componentes: los diez resolvers de
 * `src/domain/kpis/*` siguen calculando el resultado base exactamente como
 * antes, y esta funcion actua unicamente como capa posterior al maximo base.
 *
 * Orden exacto del calculo (seccion 8 del encargo):
 *
 * ```text
 * 1. rawPoints con la formula existente del KPI
 * 2. maximo base existente (applyBaseMax)
 * 3. puntos base finales del KPI  -> `basePoints` de esta funcion
 * 4. +20 % de profesion, si corresponde
 * 5. finalPoints definitivo
 * ```
 *
 * El bonus puede hacer que el resultado supere el maximo base hasta un 20 %
 * adicional: el maximo **no** se vuelve a aplicar despues de sumarlo.
 */

/** Porcentaje fijo e ineditable del bonus de profesion. Unica constante tipada del dominio. */
export const PROFESSION_BONUS_PERCENT = 20;

/** Factor decimal equivalente (`0,20`). Se calcula a partir del porcentaje, nunca se escribe a mano. */
export const PROFESSION_BONUS_RATE = new Prisma.Decimal(PROFESSION_BONUS_PERCENT).div(100);

/** Texto canonico del bonus, usado en toda la interfaz para no repetir el porcentaje literal. */
export const PROFESSION_BONUS_LABEL = `+${PROFESSION_BONUS_PERCENT} % despues del maximo base`;

/** Datos minimos de una profesion necesarios para decidir y explicar el bonus. */
export interface ApplicableProfession {
  id: string;
  name: string;
  kpiCodeA: KpiCode;
  kpiCodeB: KpiCode;
  availableN0: boolean;
  availableN1: boolean;
  availableN2: boolean;
}

export interface ProfessionBonusOutcome {
  /** Puntos antes de profesion: exactamente el resultado tras el maximo base. */
  basePoints: Prisma.Decimal;
  /** Puntos anadidos por la profesion. `0` cuando no se aplica. */
  bonusPoints: Prisma.Decimal;
  /** Puntos finales definitivos (`basePoints + bonusPoints`). */
  finalPoints: Prisma.Decimal;
  /** `true` solo si el bonus se ha aplicado realmente a este KPI. */
  applied: boolean;
  /** Identificacion suficiente del efecto para mostrarlo; `null` si no se aplico. */
  professionId: string | null;
  professionName: string | null;
  /** Porcentaje aplicado (`20`), o `null` si no se aplico. */
  bonusPercent: number | null;
}

/** `true` si la profesion esta disponible para ese nivel tecnico. */
export function isProfessionAvailableForLevel(
  profession: Pick<ApplicableProfession, "availableN0" | "availableN1" | "availableN2">,
  level: ParticipantLevel,
): boolean {
  if (level === "N0") return profession.availableN0;
  if (level === "N1") return profession.availableN1;
  return profession.availableN2;
}

/** `true` si ese KPI es uno de los dos que potencia la profesion. */
export function professionPowersKpi(profession: Pick<ApplicableProfession, "kpiCodeA" | "kpiCodeB">, kpiCode: KpiCode): boolean {
  return profession.kpiCodeA === kpiCode || profession.kpiCodeB === kpiCode;
}

/**
 * Aplica el bonus de profesion a un resultado de KPI ya limitado por su
 * maximo base. El llamador solo debe invocarla para resultados `COMPUTED` de
 * KPI activos: `VAC`, `NOT_APPLICABLE` y los KPI inactivos nunca llegan aqui
 * (no producen puntos base que bonificar).
 *
 * No se aplica bonus cuando:
 * - el participante no tiene profesion (`profession === null`), es decir,
 *   tambien cuando el split no usa profesiones;
 * - la profesion no esta disponible para el nivel del participante;
 * - el KPI no es ninguno de los dos que potencia la profesion;
 * - los puntos tras el maximo base no son estrictamente positivos (`0` y
 *   negativos quedan exactamente igual: un bonus nunca debe empeorar una
 *   puntuacion negativa).
 */
export function applyProfessionBonus(
  basePoints: Prisma.Decimal,
  kpiCode: KpiCode,
  profession: ApplicableProfession | null,
  level: ParticipantLevel,
): ProfessionBonusOutcome {
  const notApplied: ProfessionBonusOutcome = {
    basePoints,
    bonusPoints: new Prisma.Decimal(0),
    finalPoints: basePoints,
    applied: false,
    professionId: null,
    professionName: null,
    bonusPercent: null,
  };

  if (!profession) return notApplied;
  if (!isProfessionAvailableForLevel(profession, level)) return notApplied;
  if (!professionPowersKpi(profession, kpiCode)) return notApplied;
  if (!basePoints.greaterThan(0)) return notApplied;

  // Sin redondeo intermedio: el redondeo solo ocurre al persistir, con la escala del campo Decimal.
  const bonusPoints = basePoints.mul(PROFESSION_BONUS_RATE);

  return {
    basePoints,
    bonusPoints,
    finalPoints: basePoints.plus(bonusPoints),
    applied: true,
    professionId: profession.id,
    professionName: profession.name,
    bonusPercent: PROFESSION_BONUS_PERCENT,
  };
}
