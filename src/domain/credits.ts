import { Prisma } from "@prisma/client";

/**
 * Equivalencia entre puntos y creditos (`0.9.0` / MVP-2D, ver
 * docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md, seccion 2 del encargo):
 *
 * ```text
 * 1 credito = 1 punto KPI completo publicado
 * creditsEarned = max(0, floor(totalKpiPoints))
 * ```
 *
 * Los creditos son siempre enteros; los puntos KPI conservan su precision
 * decimal (nunca se redondea al entero mas proximo). Se conceden creditos
 * unicamente por puntos completos, y nunca se genera una deuda por un
 * resultado negativo. Unica funcion de dominio que decide este calculo,
 * usada tanto por la publicacion de una semana como por el backfill de
 * publicaciones anteriores a esta version.
 */
export function computeCreditsEarned(totalKpiPoints: Prisma.Decimal | number): number {
  const decimal = totalKpiPoints instanceof Prisma.Decimal ? totalKpiPoints : new Prisma.Decimal(totalKpiPoints);
  if (decimal.lessThanOrEqualTo(0)) return 0;
  return decimal.floor().toNumber();
}
