import { Prisma } from "@prisma/client";
import type { KpiCode } from "@/domain/kpis/catalog";
import { ALLOWED_BONUS_PERCENTS, isAllowedBonusPercent } from "@/domain/bonus-percent";

/**
 * Bonus de objetos de equipo (`0.9.0` / MVP-2D, ver
 * docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md). Tercera fuente de bonus, junto a
 * la profesion (`src/domain/profession-bonus.ts`) y la localizacion
 * (`src/domain/location-bonus.ts`): actua tambien sobre `baseFinalPoints`
 * (los puntos tras el maximo base), de forma independiente y sin
 * encadenarse con las otras dos. A diferencia de esas dos, varios objetos
 * pueden acumularse de forma aditiva si afectan al mismo KPI, siempre que
 * cada uno ocupe una ranura distinta (seccion 24 del encargo).
 */

export const EQUIPMENT_BONUS_PERCENTS = ALLOWED_BONUS_PERCENTS;
export type EquipmentBonusPercent = (typeof EQUIPMENT_BONUS_PERCENTS)[number];

export function isAllowedEquipmentBonusPercent(value: number): value is EquipmentBonusPercent {
  return isAllowedBonusPercent(value);
}

/** Objeto equipado, validado y perteneciente al mismo split/participante, listo para decidir su bonus. */
export interface EquippedItemForBonus {
  ownedItemId: string;
  storeItemId: string;
  itemName: string;
  equipmentSlotId: string;
  equipmentSlotName: string;
  kpiCode: KpiCode;
  bonusPercent: number;
  /** Orden de presentacion (por ejemplo, el orden de la ranura). */
  displayOrder: number;
}

export interface EquipmentBonusBreakdownEntry {
  ownedItemId: string;
  storeItemId: string;
  itemName: string;
  equipmentSlotId: string;
  equipmentSlotName: string;
  bonusPercent: number;
  bonusPoints: Prisma.Decimal;
  displayOrder: number;
}

export interface EquipmentBonusOutcome {
  /** Puntos antes de equipo: exactamente el resultado tras el maximo base (el mismo que reciben profesion y localizacion). */
  basePoints: Prisma.Decimal;
  /** Suma de los puntos anadidos por todos los objetos equipados que afectan a este KPI. `0` si ninguno aplica. */
  bonusPoints: Prisma.Decimal;
  /** Puntos finales de esta capa (`basePoints + bonusPoints`), antes de sumar profesion y localizacion. */
  finalPoints: Prisma.Decimal;
  /** `true` si al menos un objeto aplico su bonus a este KPI. */
  applied: boolean;
  /** Desglose por objeto, solo con los que realmente aplicaron, en el mismo orden que `equippedItems`. */
  breakdown: EquipmentBonusBreakdownEntry[];
}

/**
 * Aplica el bonus acumulado de todos los objetos equipados que potencian el
 * KPI indicado, sobre un resultado ya `COMPUTED` y ya limitado por su
 * maximo base. El llamador solo debe invocarla para KPI activos de
 * participantes aplicables esa semana: `VAC`, `NOT_APPLICABLE` y los KPI
 * inactivos nunca llegan aqui.
 *
 * No se aplica bonus (ni de un objeto individual ni del total) cuando:
 * - `equippedItems` esta vacio, o ninguno de sus objetos potencia este KPI;
 * - los puntos tras el maximo base no son estrictamente positivos (`0` y
 *   negativos quedan exactamente igual: un bonus nunca debe empeorar una
 *   puntuacion negativa).
 *
 * Los efectos de varios objetos que afecten al mismo KPI se suman de forma
 * aditiva (nunca se multiplican factores entre si): `70 + 10 % + 20 % = 84`,
 * nunca `70 x 1.10 x 1.20`.
 */
export function applyEquipmentBonuses(
  basePoints: Prisma.Decimal,
  kpiCode: KpiCode,
  equippedItems: readonly EquippedItemForBonus[],
): EquipmentBonusOutcome {
  const notApplied: EquipmentBonusOutcome = {
    basePoints,
    bonusPoints: new Prisma.Decimal(0),
    finalPoints: basePoints,
    applied: false,
    breakdown: [],
  };

  if (!basePoints.greaterThan(0)) return notApplied;

  const applicableItems = equippedItems.filter((item) => item.kpiCode === kpiCode);
  if (applicableItems.length === 0) return notApplied;

  const breakdown: EquipmentBonusBreakdownEntry[] = applicableItems.map((item) => ({
    ownedItemId: item.ownedItemId,
    storeItemId: item.storeItemId,
    itemName: item.itemName,
    equipmentSlotId: item.equipmentSlotId,
    equipmentSlotName: item.equipmentSlotName,
    bonusPercent: item.bonusPercent,
    // Sin redondeo intermedio: el redondeo solo ocurre al persistir, con la escala del campo Decimal.
    bonusPoints: basePoints.mul(new Prisma.Decimal(item.bonusPercent).div(100)),
    displayOrder: item.displayOrder,
  }));

  const bonusPoints = breakdown.reduce((sum, entry) => sum.plus(entry.bonusPoints), new Prisma.Decimal(0));

  return {
    basePoints,
    bonusPoints,
    finalPoints: basePoints.plus(bonusPoints),
    applied: true,
    breakdown,
  };
}
