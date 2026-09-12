/**
 * Vista "Con/Sin gamificacion" de `/resultados` (`0.9.0` / MVP-2D, parte J
 * del encargo). El selector es puramente analitico: nunca reescribe
 * publicaciones, creditos, rankings, puntos por posicion ni clasificaciones
 * de facciones, solo cambia como se presentan los valores y la evolucion de
 * KPI ya publicados.
 *
 * - "Con gamificacion" (predeterminado): `finalPoints` oficial, con
 *   profesion + localizacion + objetos ya incluidos.
 * - "Sin gamificacion": el rendimiento KPI real, tal como quedo tras el
 *   maximo base y antes de cualquier bonus de juego
 *   (`basePointsBeforeProfession`). En publicaciones anteriores a `0.8.0`
 *   ese campo es `null` porque entonces no existia ningun bonus: se usa
 *   `finalPoints` como resultado, que ya coincide con el valor real de
 *   aquella epoca.
 */

export type GamificationMode = "con" | "sin";

export const GAMIFICATION_MODE_PARAM = "gamificacion";

/** Valor predeterminado `"con"` para cualquier entrada distinta de `"sin"`. */
export function parseGamificationMode(value: string | string[] | undefined): GamificationMode {
  return value === "sin" ? "sin" : "con";
}

export type DisplayableKpiStatus = "COMPUTED" | "VAC" | "NOT_APPLICABLE";

/**
 * Puntos de una celda de KPI segun el modo elegido. `NOT_APPLICABLE` nunca
 * cambia (`null`, mostrado como "No aplica" en ambos modos); `VAC` se
 * muestra siempre como `0` (hotfix AVISO/0, ver docs/DECISIONS.md), en
 * cualquiera de los dos modos, porque nunca recibio ningun bonus.
 */
export function resolveGamificationDisplayPoints(
  mode: GamificationMode,
  status: DisplayableKpiStatus,
  finalPoints: number | null | undefined,
  basePointsBeforeProfession: number | null | undefined,
): number | null {
  if (status === "NOT_APPLICABLE") return null;
  if (status === "VAC") return 0;
  if (mode === "con") return finalPoints ?? 0;
  return basePointsBeforeProfession ?? finalPoints ?? 0;
}

/**
 * Total (semanal o agregado) segun el modo elegido, a partir del total
 * oficial ya publicado y la suma de los tres bonus (profesion + localizacion
 * + objetos) que ya esta incluida en ese total oficial.
 */
export function resolveGamificationDisplayTotal(mode: GamificationMode, officialTotal: number, totalBonus: number): number {
  return mode === "con" ? officialTotal : officialTotal - totalBonus;
}

/** `officialTotal - realTotal`: debe coincidir siempre con la suma de los tres bonus publicados (seccion 39 del encargo). */
export function computeGamificationImpact(officialTotal: number, realTotal: number): number {
  return officialTotal - realTotal;
}
