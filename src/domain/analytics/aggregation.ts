/**
 * Diccionario matematico obligatorio (parte E del encargo): jerarquia de
 * medias explicita para que dos splits simultaneos o varias semanas de una
 * persona nunca dupliquen su peso. Funciones puras y genericas, reutilizadas
 * tanto para medias por KPI (E2) como para el indice total normalizado (E3).
 */

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/** Mediana con interpolacion de los dos centrales en tamano par (E4). */
export function median(sortedValues: readonly number[]): number | null {
  return quantile(sortedValues, 0.5);
}

/**
 * Cuartil con interpolacion lineal, indice `(n - 1) x p` (E4). `values` debe
 * venir ya ordenado ascendentemente.
 */
export function quantile(sortedValues: readonly number[], p: number): number | null {
  const n = sortedValues.length;
  if (n === 0) return null;
  if (n === 1) return sortedValues[0] ?? null;
  const idx = (n - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  const lowerValue = sortedValues[lower] as number;
  if (lower === upper) return lowerValue;
  const upperValue = sortedValues[upper] as number;
  const fraction = idx - lower;
  return lowerValue + (upperValue - lowerValue) * fraction;
}

export interface DispersionStats {
  count: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  q1: number | null;
  q3: number | null;
  iqr: number | null;
}

export function computeDispersionStats(values: readonly number[]): DispersionStats {
  if (values.length === 0) {
    return { count: 0, mean: null, median: null, min: null, max: null, q1: null, q3: null, iqr: null };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  return {
    count: sorted.length,
    mean: mean(sorted),
    median: median(sorted),
    min: sorted[0] ?? null,
    max: sorted[sorted.length - 1] ?? null,
    q1,
    q3,
    iqr: q1 !== null && q3 !== null ? q3 - q1 : null,
  };
}

/** Celda pesada por persona, split y clave de semana (E2/E5/D5). */
export interface WeightedCell {
  personId: string;
  splitId: string;
  weekKey: string;
  value: number;
}

/**
 * Paso 1 de la jerarquia (E2/D5): colapsa splits simultaneos de la misma
 * persona en la misma semana con una media simple, para que dos splits el
 * mismo lunes no dupliquen el peso de esa persona esa semana. Devuelve un
 * mapa `personId__weekKey -> valor`.
 */
export function collapseSimultaneousSplits(cells: readonly WeightedCell[]): Map<string, number> {
  const groups = new Map<string, number[]>();
  for (const cell of cells) {
    const key = `${cell.personId}__${cell.weekKey}`;
    const list = groups.get(key);
    if (list) list.push(cell.value);
    else groups.set(key, [cell.value]);
  }
  const out = new Map<string, number>();
  for (const [key, values] of groups) {
    out.set(key, mean(values) as number);
  }
  return out;
}

/**
 * Paso 2 de la jerarquia (E2): media simple de los valores semanales validos
 * de cada persona en el periodo. Recibe el mapa `personId__weekKey -> valor`
 * de `collapseSimultaneousSplits` y devuelve `personId -> valor del periodo`.
 */
export function collapseWeeksToPersonPeriod(personWeekValues: ReadonlyMap<string, number>): Map<string, number> {
  const byPerson = new Map<string, number[]>();
  for (const [key, value] of personWeekValues) {
    const personId = key.split("__")[0] as string;
    const list = byPerson.get(personId);
    if (list) list.push(value);
    else byPerson.set(personId, [value]);
  }
  const out = new Map<string, number>();
  for (const [personId, values] of byPerson) {
    out.set(personId, mean(values) as number);
  }
  return out;
}

export interface HierarchicalAverageResult {
  /** Media del equipo: media simple de los valores personales del periodo. */
  teamAverage: number | null;
  /** Valor de cada persona en el periodo (paso 2), para mediana/distribucion. */
  personPeriodValues: Map<string, number>;
  /** Numero de personas con al menos un valor valido. */
  analyzablePersonCount: number;
}

/**
 * Aplica los tres pasos de E2/E3 sobre celdas persona-split-semana ya
 * resueltas (valor en `%` o en puntos, segun lo que llame): colapsa splits
 * simultaneos, despues semanas del periodo, despues media del equipo.
 */
export function computeHierarchicalAverage(cells: readonly WeightedCell[]): HierarchicalAverageResult {
  const personWeekValues = collapseSimultaneousSplits(cells);
  const personPeriodValues = collapseWeeksToPersonPeriod(personWeekValues);
  const teamAverage = mean([...personPeriodValues.values()]);
  return { teamAverage, personPeriodValues, analyzablePersonCount: personPeriodValues.size };
}

export interface CellForTotals {
  included: boolean;
  x: number | null;
  max: number | null;
}

export interface ObservationTotals {
  /** "Puntuacion total valida": suma de puntos de los KPI incluidos, o `null` sin ninguno. */
  totalPointsValid: number | null;
  /** "Indice total normalizado": 100 x suma puntos / suma maximos, mismo conjunto en numerador y denominador. */
  indexNormalized: number | null;
  includedKpiCount: number;
  indexEligibleKpiCount: number;
}

/**
 * Indicador total KPI de una persona-split-semana (E3): la puntuacion total
 * valida usa todos los KPI incluidos con puntos validos; el indice
 * normalizado usa exclusivamente el subconjunto que ademas tiene un maximo
 * base valido (`> 0`), en numerador y denominador a la vez.
 */
export function computeObservationTotals(cells: readonly CellForTotals[]): ObservationTotals {
  let sumPoints = 0;
  let includedCount = 0;
  let sumIndexPoints = 0;
  let sumMax = 0;
  let eligibleCount = 0;

  for (const cell of cells) {
    if (!cell.included || cell.x === null) continue;
    sumPoints += cell.x;
    includedCount += 1;
    if (cell.max !== null && cell.max > 0) {
      sumIndexPoints += cell.x;
      sumMax += cell.max;
      eligibleCount += 1;
    }
  }

  return {
    totalPointsValid: includedCount > 0 ? sumPoints : null,
    indexNormalized: eligibleCount > 0 ? (100 * sumIndexPoints) / sumMax : null,
    includedKpiCount: includedCount,
    indexEligibleKpiCount: eligibleCount,
  };
}
