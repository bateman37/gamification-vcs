/**
 * Presentacion de un resultado de KPI ya normalizado a los tres estados
 * funcionales (`COMPUTED`/`VAC`/`NOT_APPLICABLE`, ver
 * docs/RESULTS_PUBLICATION.md) en pantallas de resultados, previsualizacion,
 * publicacion, clasificacion e historico (hotfix `AVISO`/`0`, ver
 * docs/DECISIONS.md): `VAC` (ausencia justificada en un origen ya
 * confirmado, incluido `totalHours = 0` de Cronomagia) se muestra siempre
 * como el valor numerico `0`, participando en sumas y rankings igual que
 * cualquier otro cero. `NOT_APPLICABLE` se mantiene diferenciado y nunca se
 * convierte visualmente en `0`. El estado interno `VAC` no cambia en ningun
 * servicio: esta funcion es solo de presentacion, y solo se usa en pantallas
 * de resultados/publicacion/clasificacion/historico, nunca en las de carga o
 * comprobacion (que muestran `AVISO`, ver `src/domain/kpis/loadGroups.ts`).
 */
export type PublishedKpiResultStatus = "COMPUTED" | "VAC" | "NOT_APPLICABLE";

export function resolveKpiResultDisplayPoints(
  status: PublishedKpiResultStatus,
  finalPoints: number | null | undefined,
): number | null {
  if (status === "NOT_APPLICABLE") return null;
  return finalPoints ?? 0;
}
