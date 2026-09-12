import type { HistoryGrouping } from "@/server/services/individual-results.service";

/**
 * Decisiones de columnas y etiquetas del historico general segun la
 * agrupacion (`1.0.1`, parte E del encargo). Centraliza aqui, en una unica
 * funcion pura, que mostrar/ocultar y como rotular, para no duplicar la
 * misma condicion (`grouping === "semana"`) en el componente de tabla.
 *
 * No cambia ningun dato: `HistoricoSection.tsx` sigue leyendo exactamente
 * los mismos campos ya calculados por `getPersonHistory`
 * (`sumKpiPoints`/`averageKpiPoints`/`publishedWeekCount`...). Con
 * agrupacion `Semana` cada periodo es siempre una unica semana publicada
 * (`publishedWeekCount === 1`), asi que la media coincide siempre con la
 * suma y la columna "Semanas publicadas" siempre mostraria `1`: mostrarlas
 * ahi era ruido redundante, no informacion nueva.
 */
export interface HistoryDisplayConfig {
  /** `false` con agrupacion `Semana`: la media semanal secundaria bajo cada KPI coincide siempre con la suma. */
  showPerKpiAverage: boolean;
  /** `false` con agrupacion `Semana`: la columna de media total coincidiria siempre con la suma. */
  showAverageKpiColumn: boolean;
  /** `false` con agrupacion `Semana`: la columna mostraria siempre `1`. */
  showPublishedWeeksColumn: boolean;
  /** Cabecera de la columna de media total del periodo. */
  averageKpiColumnHeader: string;
  /** Texto accesible de ayuda sobre el significado de "Media semanal", o `null` cuando no se muestra ninguna media (agrupacion `Semana`). */
  helpNote: string | null;
}

export const HISTORY_MEDIA_HELP_NOTE =
  'Media semanal = suma del periodo dividida entre las semanas publicadas incluidas. En cada KPI, "No aplica" no cuenta en el divisor; una ausencia con resultado 0 sí cuenta.';

export function resolveHistoryDisplayConfig(grouping: HistoryGrouping): HistoryDisplayConfig {
  const isWeekly = grouping === "semana";
  return {
    showPerKpiAverage: !isWeekly,
    showAverageKpiColumn: !isWeekly,
    showPublishedWeeksColumn: !isWeekly,
    averageKpiColumnHeader: "Media semanal total KPI",
    helpNote: isWeekly ? null : HISTORY_MEDIA_HELP_NOTE,
  };
}
