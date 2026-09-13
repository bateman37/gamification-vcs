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
 *
 * `ABSENT` (`1.1.1`, ver docs/WEEKLY_ATTENDANCE_AND_HOURS.md): KPI aplicable
 * de una persona ausente esa semana. Se muestra tambien como `0` en sumas y
 * rankings, igual que `VAC`, pero la fila debe estar siempre presidida por
 * `Ausencia · Sin datos semanales` (nunca "0 %", "VAC" ni una posicion
 * ficticia): esa distincion vive en la presentacion de la fila/posicion, no
 * en el valor numerico de la celda.
 */
export type PublishedKpiResultStatus = "COMPUTED" | "VAC" | "NOT_APPLICABLE" | "ABSENT";

export function resolveKpiResultDisplayPoints(
  status: PublishedKpiResultStatus,
  finalPoints: number | null | undefined,
): number | null {
  if (status === "NOT_APPLICABLE") return null;
  return finalPoints ?? 0;
}
