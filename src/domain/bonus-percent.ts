/**
 * Conjunto cerrado de porcentajes de bonus compartido por localizaciones
 * (`0.8.5` / MVP-2C) y objetos de equipo (`0.9.0` / MVP-2D, ver
 * docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md, seccion 12 del encargo): unica
 * lista tipada de la que derivan validacion y selectores de ambas capas,
 * sin acoplar sus entidades ni duplicar reglas que puedan divergir en el
 * futuro (cada capa conserva su propia funcion de bonus y su propia
 * restriccion de base de datos).
 */
export const ALLOWED_BONUS_PERCENTS = [10, 20, 30, 40, 50] as const;
export type AllowedBonusPercent = (typeof ALLOWED_BONUS_PERCENTS)[number];

export function isAllowedBonusPercent(value: number): value is AllowedBonusPercent {
  return (ALLOWED_BONUS_PERCENTS as readonly number[]).includes(value);
}
