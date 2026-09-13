import { addCalendarDays, formatCalendarDate } from "@/lib/dates";
import { mean } from "./aggregation";
import type { AnalyticsLevel } from "./types";

/**
 * Comparaciones coherentes (parte G del encargo): semana anterior o media
 * del periodo, en poblacion comun, con la unidad de cambio en puntos
 * porcentuales (pp) como medida principal.
 */

export interface WeeklyPoint {
  weekStartDate: Date;
  value: number;
}

/**
 * Referencia "Semana anterior" (G1): el lunes exactamente 7 dias antes de la
 * semana analizada. Nunca salta a otra semana disponible mas antigua.
 */
export function findPreviousWeekReference(weeklyValuesByIsoDate: ReadonlyMap<string, number>, analyzedWeekStart: Date): number | null {
  const previousMonday = addCalendarDays(analyzedWeekStart, -7);
  return weeklyValuesByIsoDate.get(formatCalendarDate(previousMonday)) ?? null;
}

export interface PeriodAverageReference {
  average: number | null;
  weeksUsed: Date[];
}

/**
 * Referencia "Media del periodo" (G1): media de las semanas validas
 * anteriores a la semana analizada dentro del periodo seleccionado. Excluye
 * la semana analizada y cualquier semana posterior.
 */
export function computePeriodAverageReference(weeklyValues: readonly WeeklyPoint[], analyzedWeekStart: Date): PeriodAverageReference {
  const priorWeeks = weeklyValues.filter((week) => week.weekStartDate.getTime() < analyzedWeekStart.getTime());
  if (priorWeeks.length === 0) return { average: null, weeksUsed: [] };
  return { average: mean(priorWeeks.map((week) => week.value)), weeksUsed: priorWeeks.map((week) => week.weekStartDate) };
}

/** Diferencia en puntos porcentuales (G3): la medida principal de evolucion. */
export function ppDifference(current: number, reference: number): number {
  return current - reference;
}

/** Variacion relativa (G3): solo calculable con referencia estrictamente positiva. */
export function relativeVariation(current: number, reference: number): number | null {
  if (reference <= 0) return null;
  return (100 * (current - reference)) / reference;
}

export type PerformanceSignal = "mejora" | "estable" | "descenso" | "sin_referencia";

/** Reglas de señales (G4): comprobables, nunca diagnosticos. */
export function resolveSignal(diffPp: number | null): PerformanceSignal {
  if (diffPp === null) return "sin_referencia";
  if (diffPp >= 5) return "mejora";
  if (diffPp <= -5) return "descenso";
  return "estable";
}

export interface PersonLevelValue {
  personId: string;
  level: AnalyticsLevel;
  value: number;
}

export interface CommonPopulationComparison {
  commonPersonIds: string[];
  currentAverage: number | null;
  referenceAverage: number | null;
  diffPp: number | null;
}

/**
 * Poblacion comparable (G2): solo personas con observacion valida en ambos
 * lados Y mismo nivel historico. Nunca atribuye a mejora de rendimiento un
 * cambio de composicion del equipo.
 */
export function computeCommonPopulationComparison(
  current: readonly PersonLevelValue[],
  reference: readonly PersonLevelValue[],
): CommonPopulationComparison {
  const referenceByPerson = new Map(reference.map((entry) => [entry.personId, entry]));
  const commonPairs: { current: PersonLevelValue; reference: PersonLevelValue }[] = [];
  for (const entry of current) {
    const referenceEntry = referenceByPerson.get(entry.personId);
    if (referenceEntry && referenceEntry.level === entry.level) {
      commonPairs.push({ current: entry, reference: referenceEntry });
    }
  }
  if (commonPairs.length === 0) {
    return { commonPersonIds: [], currentAverage: null, referenceAverage: null, diffPp: null };
  }
  const currentAverage = mean(commonPairs.map((pair) => pair.current.value)) as number;
  const referenceAverage = mean(commonPairs.map((pair) => pair.reference.value)) as number;
  return {
    commonPersonIds: commonPairs.map((pair) => pair.current.personId),
    currentAverage,
    referenceAverage,
    diffPp: currentAverage - referenceAverage,
  };
}

/** Umbral de "muestra pequeña" (G3): menos de 3 personas comparables. */
export const SMALL_SAMPLE_THRESHOLD = 3;

export function isSmallSample(comparablePersonCount: number): boolean {
  return comparablePersonCount < SMALL_SAMPLE_THRESHOLD;
}

export type StreakKind = "alta" | "baja" | "cero";

export interface StreakWeek {
  weekStartDate: Date;
  /** `true` solo si la semana cumple la condicion de la racha (parte G4): un hueco, exclusion,
   * "No aplica" o cambio de nivel debe llegar aqui como `false`, nunca omitirse de la lista. */
  qualifies: boolean;
}

export interface Streak {
  startDate: Date;
  endDate: Date;
  length: number;
}

export const MIN_STREAK_LENGTH = 3;

/**
 * Detecta rachas de al menos `MIN_STREAK_LENGTH` semanas de calendario
 * consecutivas que cumplen una condicion (alta/baja/cero). `weeks` debe
 * cubrir todas las semanas de calendario del periodo, incluidas las que no
 * cumplen o carecen de dato: un hueco nunca se comprime para fabricar una
 * racha mas larga.
 */
export function detectStreaks(weeks: readonly StreakWeek[], minLength: number = MIN_STREAK_LENGTH): Streak[] {
  const sorted = [...weeks].sort((a, b) => a.weekStartDate.getTime() - b.weekStartDate.getTime());
  const streaks: Streak[] = [];
  let runStart: Date | null = null;
  let runLength = 0;
  let previousDate: Date | null = null;

  const flush = () => {
    if (runLength >= minLength && runStart !== null && previousDate !== null) {
      streaks.push({ startDate: runStart, endDate: previousDate, length: runLength });
    }
    runLength = 0;
    runStart = null;
  };

  for (const week of sorted) {
    const isConsecutive = previousDate !== null && addCalendarDays(previousDate, 7).getTime() === week.weekStartDate.getTime();
    if (week.qualifies) {
      if (runLength > 0 && isConsecutive) {
        runLength += 1;
      } else {
        flush();
        runStart = week.weekStartDate;
        runLength = 1;
      }
    } else {
      flush();
    }
    previousDate = week.weekStartDate;
  }
  flush();

  return streaks;
}
