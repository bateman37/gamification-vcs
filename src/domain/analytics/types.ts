/**
 * Tipos del motor analitico de `1.1.0` / Analitica avanzada (ver
 * docs/ADVANCED_ANALYTICS.md). Todo el modulo lee exclusivamente
 * instantaneas publicadas (`PublishedParticipantWeeklyResult` /
 * `PublishedKpiResult`): nunca recalcula con la configuracion actual.
 *
 * Identidad de una observacion fuente: `personId + splitId + splitWeekId +
 * kpiCode` (parte C2 del encargo). El motor es un conjunto de funciones
 * puras: la capa de lectura (`analytics.service.ts`) adapta Prisma a estos
 * tipos, nunca al reves.
 */

export type AnalyticsLevel = "N0" | "N1" | "N2";
export type GamificationDisplayMode = "sin" | "con";

/** Celda de KPI de una observacion persona-split-semana publicada. */
export interface KpiCellObservation {
  kpiCode: string;
  kpiName: string;
  status: "COMPUTED" | "VAC" | "NOT_APPLICABLE" | "ABSENT";
  /** `finalPoints` oficial (con bonus). `null` solo si `NOT_APPLICABLE`. */
  finalPoints: number | null;
  /** `basePointsBeforeProfession` tal cual, sin fallback. `null` en publicaciones antiguas o inconsistencias. */
  basePointsBeforeProfession: number | null;
  baseMax: number | null;
  professionBonusPoints: number;
  locationBonusPoints: number;
  equipmentBonusPoints: number;
}

/** Observacion persona-split-semana publicada: la unidad de origen del motor. */
export interface ParticipantWeekObservation {
  personId: string;
  personFullName: string;
  splitId: string;
  splitName: string;
  splitParticipantId: string;
  participantWeeklyResultId: string;
  publicationId: string;
  splitWeekId: string;
  weekSequenceNumber: number;
  /** Fecha de calendario UTC (medianoche) de inicio de semana. */
  weekStartDate: Date;
  publishedAt: Date;
  levelSnapshot: AnalyticsLevel;
  creditsEarned: number;
  /**
   * Asistencia semanal congelada (`1.1.1`, ver
   * docs/WEEKLY_ATTENDANCE_AND_HOURS.md). `null` en publicaciones anteriores
   * a esta version: cobertura legacy desconocida, nunca se reinterpreta como
   * presente o ausente.
   */
  attendanceStatus: "PRESENT" | "ABSENT" | null;
  /** Horas totales de la semana congeladas. `null` cuando `attendanceStatus` es `null` o la persona estaba ausente. */
  totalHours: number | null;
  cells: KpiCellObservation[];
}

/**
 * Resolucion de la base "sin gamificacion" de una celda `COMPUTED` (parte C3
 * del encargo). Distingue el fallback documentado (publicaciones anteriores
 * a `0.8.0`, sin ningun bonus: `basePointsBeforeProfession` es `null` porque
 * entonces no existia, y `finalPoints` ya es el valor real) de una
 * inconsistencia moderna (hay evidencia de bonus pero falta la base).
 */
export interface ResolvedCellBase {
  /** `null` cuando el dato base no esta disponible (inconsistencia). */
  base: number | null;
  available: boolean;
  /** `true` cuando se uso el fallback documentado a `finalPoints` (sin bonus). */
  usedLegacyFallback: boolean;
}

/** Medida principal de los bloques 1-4 (`1.1.1`, sustituye la politica de ceros de `1.1.0`). */
export type AnalyticsMeasure = "percentage" | "points" | "pph";

export interface AnalyticsFilters {
  splitIds: string[];
  /** Intervalo inclusivo por `weekStartDate` (fecha de calendario UTC). */
  startDate: Date;
  endDate: Date;
  levels: AnalyticsLevel[];
  mode: GamificationDisplayMode;
  /** Agrupacion temporal de graficos (independiente del intervalo). */
  grouping: "semana" | "mes" | "año";
  /** Medida seleccionada: `% del maximo` | `Puntos KPI` | `Puntos por hora` (`1.1.1`). */
  measure: AnalyticsMeasure;
}

export type TemporalGrouping = AnalyticsFilters["grouping"];
