/**
 * Formatea un numero de puntos con hasta dos decimales, eliminando ceros
 * finales innecesarios (23 -> "23", 24.5 -> "24,5", 70 -> "70").
 */
export function formatPoints(value: number): string {
  const fixed = value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return fixed.replace(".", ",");
}
