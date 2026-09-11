/**
 * Presentacion de `VAC` como `AVISO` en las pantallas de carga y
 * comprobacion de KPI (hotfix `AVISO`/`0`, ver docs/DECISIONS.md): el texto
 * visible se sustituye siempre por la palabra fija `AVISO`, tanto en
 * singular como en el contador de un grupo (`n AVISO`, nunca `AVISOS`). El
 * aviso no convierte una carga completa en parcial ni impide guardar: es
 * solo una senal visual, igual que `VAC` lo era antes de este hotfix.
 *
 * Solo se usa en pantallas de carga y comprobacion. En
 * resultados/previsualizacion/publicacion/clasificacion/historico se usa en
 * cambio `resolveKpiResultDisplayPoints`
 * (`src/domain/kpi-outcome-display.ts`), que muestra el valor numerico `0`.
 */
export const AVISO_LABEL = "AVISO";

/** `"n AVISO"` para el contador de un grupo de carga (`StatusIndicator`). Nunca `"AVISOS"`, sea cual sea `count`. */
export function formatAvisoCount(count: number): string {
  return `${count} ${AVISO_LABEL}`;
}
