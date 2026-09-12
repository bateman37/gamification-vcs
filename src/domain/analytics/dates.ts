import { formatCalendarDateEs } from "@/lib/dates";
import type { TemporalGrouping } from "./types";

/**
 * Fechas y agrupacion temporal (parte D2 del encargo). El mes/año de una
 * semana se decide siempre por el lunes de inicio real (`SplitWeek.startDate`),
 * nunca por `publishedAt` ni por el numero de semana interno del split. Una
 * semana que cruza mes o año se cuenta una sola vez, en el mes/año de su
 * lunes inicial.
 */

const MONTH_LABELS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export interface PeriodKey {
  key: string;
  label: string;
  sortDate: Date;
}

/**
 * Clave/etiqueta de un periodo segun la agrupacion elegida. La clave de
 * "semana" incluye `splitId` para no fusionar dos semanas de splits
 * distintos que empiecen el mismo lunes (misma convencion que
 * `individual-results.service.ts`).
 */
export function periodKeyFor(grouping: TemporalGrouping, weekStartDate: Date, splitId: string): PeriodKey {
  const year = weekStartDate.getUTCFullYear();
  const month = weekStartDate.getUTCMonth();
  if (grouping === "año") {
    return { key: `${year}`, label: `${year}`, sortDate: new Date(Date.UTC(year, 0, 1)) };
  }
  if (grouping === "mes") {
    return {
      key: `${year}-${month}`,
      label: `${MONTH_LABELS_ES[month]} ${year}`,
      sortDate: new Date(Date.UTC(year, month, 1)),
    };
  }
  return {
    key: `${splitId}-${weekStartDate.getTime()}`,
    label: `Semana del ${formatCalendarDateEs(weekStartDate)}`,
    sortDate: weekStartDate,
  };
}

/** Numero de semanas de calendario distintas (D2): por fecha de inicio, sin duplicar splits simultaneos. */
export function countDistinctCalendarWeeks(weekStartDates: readonly Date[]): number {
  return new Set(weekStartDates.map((date) => date.getTime())).size;
}

/** Numero de publicaciones de split (D2): cada fila persona-split-semana original cuenta su propia semana de split. */
export function countSplitPublications(splitWeekIds: readonly string[]): number {
  return new Set(splitWeekIds).size;
}
