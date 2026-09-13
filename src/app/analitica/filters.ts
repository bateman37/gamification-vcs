import { parseCalendarDate } from "@/lib/dates";
import type { AnalyticsLevel, AnalyticsMeasure, GamificationDisplayMode, TemporalGrouping } from "@/domain/analytics";
import type { ComparisonMode } from "@/domain/analytics";
import { parseGamificationMode } from "@/domain/gamification-view";
import { KPI_CATALOG_LIST } from "@/domain/kpis/catalog";

/**
 * Parseo de filtros de `/analitica` desde `searchParams` (parte D3/H1/H2 del
 * encargo `1.1.1`). Valida IDs, enumeraciones, fechas y limites en servidor:
 * un `searchParams` manipulado a mano nunca debe producir un estado invalido
 * silencioso, solo se ignora y se aplica el valor predeterminado.
 */

export type AnalyticsTab = "vision-general" | "rendimiento-kpi" | "evolucion" | "distribucion" | "personas" | "gamificacion";

export const ANALYTICS_TABS: { key: AnalyticsTab; label: string }[] = [
  { key: "vision-general", label: "Visión general" },
  { key: "rendimiento-kpi", label: "Rendimiento por KPI" },
  { key: "evolucion", label: "Evolución del equipo" },
  { key: "distribucion", label: "Distribución y consistencia" },
  { key: "personas", label: "Análisis por persona" },
  { key: "gamificacion", label: "Impacto de la gamificación" },
];

export type RawSearchParams = Record<string, string | string[] | undefined>;

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function parseDate(value: string | string[] | undefined): Date | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  try {
    return parseCalendarDate(raw);
  } catch {
    return null;
  }
}

export interface ParsedAnalyticsFilters {
  tab: AnalyticsTab;
  requestedSplitIds: string[];
  levels: AnalyticsLevel[];
  startDate: Date | null;
  endDate: Date | null;
  grouping: TemporalGrouping;
  mode: GamificationDisplayMode;
  measure: AnalyticsMeasure;
  comparisonMode: ComparisonMode;
  analyzedWeek: Date | null;
  selectedKpi: string | null;
  selectedPersonIds: string[];
}

const ALL_LEVELS: AnalyticsLevel[] = ["N0", "N1", "N2"];
const VALID_KPI_CODES = new Set<string>(KPI_CATALOG_LIST.map((entry) => entry.code));

export function parseAnalyticsSearchParams(searchParams: RawSearchParams): ParsedAnalyticsFilters {
  const tabRaw = Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab;
  const tab = ANALYTICS_TABS.some((t) => t.key === tabRaw) ? (tabRaw as AnalyticsTab) : "vision-general";

  const levels = toArray(searchParams.nivel).filter((v): v is AnalyticsLevel => ALL_LEVELS.includes(v as AnalyticsLevel));

  const groupingRaw = Array.isArray(searchParams.agrupacion) ? searchParams.agrupacion[0] : searchParams.agrupacion;
  const grouping: TemporalGrouping = groupingRaw === "mes" || groupingRaw === "año" ? groupingRaw : "semana";

  const comparisonRaw = Array.isArray(searchParams.comparacion) ? searchParams.comparacion[0] : searchParams.comparacion;
  const comparisonMode: ComparisonMode = comparisonRaw === "media_periodo" ? "media_periodo" : "semana_anterior";

  const measureRaw = Array.isArray(searchParams.medida) ? searchParams.medida[0] : searchParams.medida;
  const measure: AnalyticsMeasure = measureRaw === "puntos" ? "points" : measureRaw === "pph" ? "pph" : "percentage";

  const kpiRaw = Array.isArray(searchParams.kpi) ? searchParams.kpi[0] : searchParams.kpi;
  const selectedKpi = kpiRaw && VALID_KPI_CODES.has(kpiRaw) ? kpiRaw : null;

  return {
    tab,
    requestedSplitIds: toArray(searchParams.splits),
    levels,
    startDate: parseDate(searchParams.inicio),
    endDate: parseDate(searchParams.fin),
    grouping,
    mode: parseGamificationMode(Array.isArray(searchParams.gamificacion) ? searchParams.gamificacion[0] : searchParams.gamificacion),
    measure,
    comparisonMode,
    analyzedWeek: parseDate(searchParams.semana),
    selectedKpi,
    selectedPersonIds: toArray(searchParams.personas).slice(0, 5),
  };
}

/** Construye la query string preservando los filtros actuales, con overrides puntuales (para enlaces de pestaña/toggle). */
export function buildAnalyticsHref(current: RawSearchParams, overrides: Record<string, string | string[] | null>): string {
  const params = new URLSearchParams();
  const merged: Record<string, string | string[] | null | undefined> = { ...current, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value === null || value === undefined) continue;
    for (const entry of Array.isArray(value) ? value : [value]) {
      params.append(key, entry);
    }
  }
  return `/analitica?${params.toString()}`;
}
