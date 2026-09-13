import { addCalendarDays, formatCalendarDate, isoWeekday } from "@/lib/dates";
import {
  collapseSimultaneousSplits,
  collapseWeeksToPersonPeriod,
  computeDispersionStats,
  computeHierarchicalAverage,
  mean,
  type DispersionStats,
  type WeightedCell,
} from "./aggregation";
import {
  computeCommonPopulationComparison,
  computePeriodAverageReference,
  findPreviousWeekReference,
  ppDifference,
  type PersonLevelValue,
} from "./comparison";
import { periodKeyFor } from "./dates";
import { bucketForPercentage, buildDistribution, type DistributionBucket } from "./distribution";
import { computeTeamPointsPerHour } from "./pph";
import type { ResolvedObservation } from "./observation";
import type { AnalyticsLevel, TemporalGrouping } from "./types";

/**
 * Ensambla las observaciones ya resueltas (`ResolvedObservation`) en los
 * modelos de vista de los seis bloques (parte H del encargo). Sigue siendo
 * una capa pura: recibe ya cargadas tanto las observaciones del periodo
 * seleccionado como una ventana de "lookback" de 7 dias adicionales, para
 * que la referencia "Semana anterior" pueda resolverse aunque quede fuera
 * del intervalo visible (parte G1), sin ampliar el periodo ni su cobertura.
 */

export type ComparisonMode = "semana_anterior" | "media_periodo";

function weightedCells(observations: readonly ResolvedObservation[], valueOf: (o: ResolvedObservation) => number | null): WeightedCell[] {
  const out: WeightedCell[] = [];
  for (const observation of observations) {
    const value = valueOf(observation);
    if (value === null) continue;
    out.push({ personId: observation.personId, splitId: observation.splitId, weekKey: formatCalendarDate(observation.weekStartDate), value });
  }
  return out;
}

function personLevelValuesForWeek(
  observations: readonly ResolvedObservation[],
  weekTime: number,
  valueOf: (o: ResolvedObservation) => number | null,
): PersonLevelValue[] {
  const byPerson = new Map<string, { values: number[]; level: AnalyticsLevel }>();
  for (const observation of observations) {
    if (observation.weekStartDate.getTime() !== weekTime) continue;
    const value = valueOf(observation);
    if (value === null) continue;
    const entry = byPerson.get(observation.personId) ?? { values: [], level: observation.levelSnapshot };
    entry.values.push(value);
    // Simplificacion documentada (docs/DECISIONS.md): si la persona cambio de nivel dentro de la
    // misma semana de calendario (dos splits simultaneos con niveles distintos), se usa el ultimo
    // visto; el detalle por persona sigue mostrando el nivel real de cada fila.
    entry.level = observation.levelSnapshot;
    byPerson.set(observation.personId, entry);
  }
  return [...byPerson.entries()].map(([personId, entry]) => ({ personId, level: entry.level, value: mean(entry.values) as number }));
}

/** Media personal de las semanas de un periodo anteriores a `beforeWeekTime` (para "Media del resto"/G3 a nivel persona). */
function personLevelValuesForPriorWeeks(
  observations: readonly ResolvedObservation[],
  beforeWeekTime: number,
  valueOf: (o: ResolvedObservation) => number | null,
): PersonLevelValue[] {
  const scoped = observations.filter((o) => o.weekStartDate.getTime() < beforeWeekTime);
  const cells = weightedCells(scoped, valueOf);
  const personWeek = collapseSimultaneousSplits(cells);
  const perPerson = collapseWeeksToPersonPeriod(personWeek);
  const levelByPerson = new Map<string, AnalyticsLevel>();
  for (const observation of scoped) levelByPerson.set(observation.personId, observation.levelSnapshot);
  return [...perPerson.entries()].map(([personId, value]) => ({ personId, level: levelByPerson.get(personId) as AnalyticsLevel, value }));
}

export interface KpiPerformanceRow {
  kpiCode: string;
  kpiName: string;
  teamAveragePoints: number | null;
  teamAveragePercentage: number | null;
  /** Puntos por hora del equipo para este KPI (razon de sumas, G2). */
  teamPointsPerHour: number | null;
  medianPercentage: number | null;
  minPercentage: number | null;
  maxPercentage: number | null;
  currentValue: number | null;
  referenceValue: number | null;
  diffPp: number | null;
  commonPersonCount: number;
  analyzablePersonCount: number;
  measurementCount: number;
  zeroCount: number;
  missingCount: number;
  notApplicableCount: number;
  byLevel: Record<AnalyticsLevel, number | null>;
}

function buildKpiPerformanceRow(
  periodResolved: readonly ResolvedObservation[],
  lookbackResolved: readonly ResolvedObservation[],
  kpiCode: string,
  kpiName: string,
  analyzedWeekTime: number | null,
  comparisonMode: ComparisonMode,
): KpiPerformanceRow {
  const cellOf = (o: ResolvedObservation) => o.cells.find((c) => c.kpiCode === kpiCode) ?? null;

  const pointsCells = weightedCells(periodResolved, (o) => cellOf(o)?.x ?? null);
  const percentCells = weightedCells(periodResolved, (o) => cellOf(o)?.q ?? null);
  const pointsResult = computeHierarchicalAverage(pointsCells);
  const percentResult = computeHierarchicalAverage(percentCells);
  const pphResult = computeTeamPointsPerHour(periodResolved, (o) => cellOf(o)?.x ?? null);
  const sortedPercentages = [...percentResult.personPeriodValues.values()].sort((a, b) => a - b);
  const stats = computeDispersionStats(sortedPercentages);

  let currentValue: number | null = null;
  let referenceValue: number | null = null;
  let commonPersonCount = 0;

  if (analyzedWeekTime !== null) {
    const currentPersons = personLevelValuesForWeek(periodResolved, analyzedWeekTime, (o) => cellOf(o)?.q ?? null);
    let referencePersons: PersonLevelValue[];
    if (comparisonMode === "semana_anterior") {
      const previousWeekTime = addCalendarDays(new Date(analyzedWeekTime), -7).getTime();
      referencePersons = personLevelValuesForWeek(lookbackResolved, previousWeekTime, (o) => cellOf(o)?.q ?? null);
    } else {
      referencePersons = personLevelValuesForPriorWeeks(periodResolved, analyzedWeekTime, (o) => cellOf(o)?.q ?? null);
    }
    const comparison = computeCommonPopulationComparison(currentPersons, referencePersons);
    currentValue = comparison.currentAverage;
    referenceValue = comparison.referenceAverage;
    commonPersonCount = comparison.commonPersonIds.length;
  }

  let zeroCount = 0;
  let missingCount = 0;
  let notApplicableCount = 0;
  let measurementCount = 0;
  for (const observation of periodResolved) {
    const cell = cellOf(observation);
    if (!cell) continue;
    if (cell.status === "NOT_APPLICABLE") {
      notApplicableCount += 1;
    } else if (cell.included) {
      measurementCount += 1;
      if (cell.x === 0) zeroCount += 1;
    } else {
      missingCount += 1;
    }
  }

  const byLevel = {
    N0: computeHierarchicalAverage(weightedCells(periodResolved.filter((o) => o.levelSnapshot === "N0"), (o) => cellOf(o)?.q ?? null)).teamAverage,
    N1: computeHierarchicalAverage(weightedCells(periodResolved.filter((o) => o.levelSnapshot === "N1"), (o) => cellOf(o)?.q ?? null)).teamAverage,
    N2: computeHierarchicalAverage(weightedCells(periodResolved.filter((o) => o.levelSnapshot === "N2"), (o) => cellOf(o)?.q ?? null)).teamAverage,
  };

  return {
    kpiCode,
    kpiName,
    teamAveragePoints: pointsResult.teamAverage,
    teamAveragePercentage: percentResult.teamAverage,
    teamPointsPerHour: pphResult.teamPointsPerHour,
    byLevel,
    medianPercentage: stats.median,
    minPercentage: stats.min,
    maxPercentage: stats.max,
    currentValue,
    referenceValue,
    diffPp: currentValue !== null && referenceValue !== null ? ppDifference(currentValue, referenceValue) : null,
    commonPersonCount,
    analyzablePersonCount: percentResult.analyzablePersonCount,
    measurementCount,
    zeroCount,
    missingCount,
    notApplicableCount,
  };
}

export interface TeamEvolutionPoint {
  periodKey: string;
  periodLabel: string;
  sortDate: Date;
  teamIndex: number | null;
  analyzablePersonCount: number;
}

/**
 * Todas las semanas de calendario (lunes) entre `start` y `end`, ambos
 * inclusive, alineadas al primer lunes en o despues de `start`. Sirve para
 * sembrar el eje temporal de una serie agregada del equipo, para que una
 * semana sin ninguna publicacion aparezca como hueco real (parte D2/H4), no
 * como una linea que salte por encima de el.
 */
function enumerateCalendarWeeks(start: Date, end: Date): Date[] {
  const startWeekday = isoWeekday(start);
  let cursor = startWeekday === 1 ? start : addCalendarDays(start, 8 - startWeekday);
  const weeks: Date[] = [];
  while (cursor.getTime() <= end.getTime()) {
    weeks.push(cursor);
    cursor = addCalendarDays(cursor, 7);
  }
  return weeks;
}

/**
 * Serie agregada del equipo (o de un subconjunto ya filtrado por nivel/KPI/
 * persona). El bucket de cada periodo se identifica solo por fecha de
 * calendario (splitId vacio en `periodKeyFor`), a proposito: dos splits
 * simultaneos comparten un unico punto de la curva (parte D5), su
 * consolidacion ya la aplica `computeHierarchicalAverage` sobre las celdas
 * de cada bucket.
 */
function buildTrend(
  resolved: readonly ResolvedObservation[],
  grouping: TemporalGrouping,
  periodStart: Date,
  periodEnd: Date,
  valueOf: (o: ResolvedObservation) => number | null,
): TeamEvolutionPoint[] {
  const byPeriod = new Map<string, { label: string; sortDate: Date; cells: WeightedCell[] }>();

  for (const weekStart of enumerateCalendarWeeks(periodStart, periodEnd)) {
    const period = periodKeyFor(grouping, weekStart, "");
    if (!byPeriod.has(period.key)) byPeriod.set(period.key, { label: period.label, sortDate: period.sortDate, cells: [] });
  }

  for (const observation of resolved) {
    const value = valueOf(observation);
    if (value === null) continue;
    const period = periodKeyFor(grouping, observation.weekStartDate, "");
    const bucket = byPeriod.get(period.key) ?? { label: period.label, sortDate: period.sortDate, cells: [] };
    bucket.cells.push({ personId: observation.personId, splitId: observation.splitId, weekKey: formatCalendarDate(observation.weekStartDate), value });
    byPeriod.set(period.key, bucket);
  }
  const points: TeamEvolutionPoint[] = [];
  for (const [periodKey, bucket] of byPeriod) {
    const result = bucket.cells.length > 0 ? computeHierarchicalAverage(bucket.cells) : { teamAverage: null, analyzablePersonCount: 0 };
    points.push({ periodKey, periodLabel: bucket.label, sortDate: bucket.sortDate, teamIndex: result.teamAverage, analyzablePersonCount: result.analyzablePersonCount });
  }
  return points.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());
}

/**
 * Serie de Puntos por hora del equipo, por periodo (G2/G4): dentro de cada
 * bucket (semana/mes/año), razon de sumas por persona y despues media
 * simple entre personas, nunca promedio de porcentajes ya agregados.
 */
function buildPphTrend(
  resolved: readonly ResolvedObservation[],
  grouping: TemporalGrouping,
  periodStart: Date,
  periodEnd: Date,
  pointsOf: (o: ResolvedObservation) => number | null,
): TeamEvolutionPoint[] {
  const byPeriod = new Map<string, { label: string; sortDate: Date; observations: ResolvedObservation[] }>();

  for (const weekStart of enumerateCalendarWeeks(periodStart, periodEnd)) {
    const period = periodKeyFor(grouping, weekStart, "");
    if (!byPeriod.has(period.key)) byPeriod.set(period.key, { label: period.label, sortDate: period.sortDate, observations: [] });
  }

  for (const observation of resolved) {
    const period = periodKeyFor(grouping, observation.weekStartDate, "");
    const bucket = byPeriod.get(period.key) ?? { label: period.label, sortDate: period.sortDate, observations: [] };
    bucket.observations.push(observation);
    byPeriod.set(period.key, bucket);
  }

  const points: TeamEvolutionPoint[] = [];
  for (const [periodKey, bucket] of byPeriod) {
    const result = computeTeamPointsPerHour(bucket.observations, pointsOf);
    points.push({
      periodKey,
      periodLabel: bucket.label,
      sortDate: bucket.sortDate,
      teamIndex: result.teamPointsPerHour,
      analyzablePersonCount: result.analyzablePersonCount,
    });
  }
  return points.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());
}

export interface PersonSummaryRow {
  personId: string;
  personFullName: string;
  levels: AnalyticsLevel[];
  validWeekCount: number;
  excludedWeekCount: number;
  averageWeeklyPoints: number | null;
  teamIndex: number | null;
  /** Puntos KPI por hora del periodo para esta persona (razon de sumas, G2). */
  pointsPerHour: number | null;
  currentValue: number | null;
  referenceValue: number | null;
  diffPp: number | null;
  bestKpi: { kpiCode: string; percentage: number } | null;
  worstKpi: { kpiCode: string; percentage: number } | null;
}

function buildPersonRows(
  periodResolved: readonly ResolvedObservation[],
  lookbackResolved: readonly ResolvedObservation[],
  analyzedWeekTime: number | null,
  comparisonMode: ComparisonMode,
): PersonSummaryRow[] {
  const byPerson = new Map<string, ResolvedObservation[]>();
  for (const observation of periodResolved) {
    const list = byPerson.get(observation.personId);
    if (list) list.push(observation);
    else byPerson.set(observation.personId, [observation]);
  }
  const pphByPerson = computeTeamPointsPerHour(
    periodResolved.filter((o) => !o.excluded),
    (o) => o.totals.totalPointsValid,
  ).personPointsPerHour;

  const rows: PersonSummaryRow[] = [];
  for (const [personId, observations] of byPerson) {
    const included = observations.filter((o) => !o.excluded);
    const levels = [...new Set(observations.map((o) => o.levelSnapshot))];
    const pointsCells = weightedCells(included, (o) => o.totals.totalPointsValid);
    const indexCells = weightedCells(included, (o) => o.totals.indexNormalized);
    const pointsResult = computeHierarchicalAverage(pointsCells);
    const indexResult = computeHierarchicalAverage(indexCells);

    let currentValue: number | null = null;
    let referenceValue: number | null = null;
    if (analyzedWeekTime !== null) {
      const currentWeek = observations.filter((o) => !o.excluded && o.weekStartDate.getTime() === analyzedWeekTime);
      currentValue = mean(currentWeek.map((o) => o.totals.indexNormalized).filter((v): v is number => v !== null));
      if (comparisonMode === "semana_anterior") {
        const previousWeekTime = addCalendarDays(new Date(analyzedWeekTime), -7).getTime();
        const previousObservations = lookbackResolved.filter(
          (o) => o.personId === personId && !o.excluded && o.weekStartDate.getTime() === previousWeekTime,
        );
        referenceValue = mean(previousObservations.map((o) => o.totals.indexNormalized).filter((v): v is number => v !== null));
      } else {
        const priorObservations = included.filter((o) => o.weekStartDate.getTime() < analyzedWeekTime);
        const priorCells = weightedCells(priorObservations, (o) => o.totals.indexNormalized);
        referenceValue = collapseWeeksToPersonPeriod(collapseSimultaneousSplits(priorCells)).get(personId) ?? null;
      }
    }

    const kpiPercentages = new Map<string, number[]>();
    for (const observation of included) {
      for (const cell of observation.cells) {
        if (!cell.included || cell.q === null) continue;
        const list = kpiPercentages.get(cell.kpiCode);
        if (list) list.push(cell.q);
        else kpiPercentages.set(cell.kpiCode, [cell.q]);
      }
    }
    let bestKpi: { kpiCode: string; percentage: number } | null = null;
    let worstKpi: { kpiCode: string; percentage: number } | null = null;
    for (const [kpiCode, values] of kpiPercentages) {
      const avg = mean(values) as number;
      if (bestKpi === null || avg > bestKpi.percentage) bestKpi = { kpiCode, percentage: avg };
      if (worstKpi === null || avg < worstKpi.percentage) worstKpi = { kpiCode, percentage: avg };
    }

    rows.push({
      personId,
      personFullName: observations[0]?.personFullName ?? "",
      levels,
      validWeekCount: included.length,
      excludedWeekCount: observations.length - included.length,
      averageWeeklyPoints: pointsResult.teamAverage,
      teamIndex: indexResult.teamAverage,
      pointsPerHour: pphByPerson.get(personId) ?? null,
      currentValue,
      referenceValue,
      diffPp: currentValue !== null && referenceValue !== null ? ppDifference(currentValue, referenceValue) : null,
      bestKpi,
      worstKpi,
    });
  }
  return rows.sort((a, b) => a.personFullName.localeCompare(b.personFullName, "es"));
}

export interface AnalyticsSnapshot {
  analyzedWeekStart: Date | null;
  comparisonMode: ComparisonMode;
  periodWeekStartDates: Date[];
  coverage: {
    personsWithResults: number;
    personsAnalyzable: number;
    observationsOriginal: number;
    observationsConsolidated: number;
    /** Observaciones ausentes (`attendanceStatus = ABSENT`), fuera de rendimiento. */
    absentCount: number;
    /** Observaciones de publicaciones anteriores a `1.1.1`, sin `attendanceStatus`: cobertura legacy desconocida, tambien fuera de rendimiento. */
    unknownLegacyCount: number;
    /** `100 * presentes / (presentes + ausentes)`, solo entre observaciones con asistencia conocida. `null` sin ninguna. */
    attendancePercentage: number | null;
    /** Suma de horas totales de las observaciones presentes del periodo. */
    totalHoursAnalyzed: number;
  };
  overview: {
    averageWeeklyPoints: number | null;
    teamIndex: number | null;
    teamIndexMedian: number | null;
    /** Puntos KPI por hora del equipo (razon de sumas, G2/G4). */
    teamPointsPerHour: number | null;
    current: number | null;
    reference: number | null;
    diffPp: number | null;
    commonPersonCount: number;
    topImprovingKpis: { kpiCode: string; kpiName: string; diffPp: number }[];
    topDecliningKpis: { kpiCode: string; kpiName: string; diffPp: number }[];
    topImprovingPersons: { personId: string; personFullName: string; diffPp: number }[];
    topDecliningPersons: { personId: string; personFullName: string; diffPp: number }[];
  };
  trend: TeamEvolutionPoint[];
  /** Serie temporal de Puntos por hora del equipo (razon de sumas por periodo, G2/G4). */
  pphTrend: TeamEvolutionPoint[];
  perLevelTrend: Record<AnalyticsLevel, TeamEvolutionPoint[]>;
  /** Serie temporal del `%` medio del equipo, por KPI (bloque 3: selección de KPI concretos). */
  kpiTrend: Record<string, TeamEvolutionPoint[]>;
  /** Serie temporal del indice normalizado por persona (bloque 3: hasta 5 personas). Solo personas analizables. */
  personTrend: Record<string, TeamEvolutionPoint[]>;
  kpiPerformance: KpiPerformanceRow[];
  distribution: {
    totalIndex: { stats: DispersionStats; buckets: Record<DistributionBucket, number> };
    /** Dispersion de Puntos por hora personales del periodo (razon de sumas). Sin intervalos de porcentaje: la escala de PPH no es un `%` del maximo. */
    totalPointsPerHour: { stats: DispersionStats };
    perKpi: Record<string, { stats: DispersionStats; buckets: Record<DistributionBucket, number> }>;
  };
  personRows: PersonSummaryRow[];
}

export interface KpiCatalogRef {
  code: string;
  name: string;
}

export function buildAnalyticsSnapshot(
  periodResolved: readonly ResolvedObservation[],
  lookbackResolved: readonly ResolvedObservation[],
  kpiCatalog: readonly KpiCatalogRef[],
  grouping: TemporalGrouping,
  comparisonMode: ComparisonMode,
  periodStart: Date,
  periodEnd: Date,
  analyzedWeekOverride?: Date,
): AnalyticsSnapshot {
  const includedPeriod = periodResolved.filter((o) => !o.excluded);
  const periodWeekStartDates = [...new Set(periodResolved.map((o) => o.weekStartDate.getTime()))]
    .sort((a, b) => a - b)
    .map((t) => new Date(t));

  const analyzedWeekStart =
    analyzedWeekOverride ?? (periodWeekStartDates.length > 0 ? (periodWeekStartDates[periodWeekStartDates.length - 1] as Date) : null);
  const analyzedWeekTime = analyzedWeekStart?.getTime() ?? null;

  const kpiPerformance = kpiCatalog.map((kpi) => buildKpiPerformanceRow(includedPeriod, lookbackResolved, kpi.code, kpi.name, analyzedWeekTime, comparisonMode));

  const trend = buildTrend(includedPeriod, grouping, periodStart, periodEnd, (o) => o.totals.indexNormalized);
  const pphTrend = buildPphTrend(includedPeriod, grouping, periodStart, periodEnd, (o) => o.totals.totalPointsValid);
  const perLevelTrend = {
    N0: buildTrend(
      includedPeriod.filter((o) => o.levelSnapshot === "N0"),
      grouping,
      periodStart,
      periodEnd,
      (o) => o.totals.indexNormalized,
    ),
    N1: buildTrend(
      includedPeriod.filter((o) => o.levelSnapshot === "N1"),
      grouping,
      periodStart,
      periodEnd,
      (o) => o.totals.indexNormalized,
    ),
    N2: buildTrend(
      includedPeriod.filter((o) => o.levelSnapshot === "N2"),
      grouping,
      periodStart,
      periodEnd,
      (o) => o.totals.indexNormalized,
    ),
  };

  const kpiTrend: Record<string, TeamEvolutionPoint[]> = {};
  for (const kpi of kpiCatalog) {
    const cellOf = (o: ResolvedObservation) => o.cells.find((c) => c.kpiCode === kpi.code) ?? null;
    kpiTrend[kpi.code] = buildTrend(includedPeriod, grouping, periodStart, periodEnd, (o) => cellOf(o)?.q ?? null);
  }

  const personTrend: Record<string, TeamEvolutionPoint[]> = {};
  for (const personId of new Set(includedPeriod.map((o) => o.personId))) {
    personTrend[personId] = buildTrend(
      includedPeriod.filter((o) => o.personId === personId),
      grouping,
      periodStart,
      periodEnd,
      (o) => o.totals.indexNormalized,
    );
  }

  const pointsResult = computeHierarchicalAverage(weightedCells(includedPeriod, (o) => o.totals.totalPointsValid));
  const indexResult = computeHierarchicalAverage(weightedCells(includedPeriod, (o) => o.totals.indexNormalized));
  const sortedIndexValues = [...indexResult.personPeriodValues.values()].sort((a, b) => a - b);
  const totalIndexStats = computeDispersionStats(sortedIndexValues);
  const teamPphResult = computeTeamPointsPerHour(includedPeriod, (o) => o.totals.totalPointsValid);
  const sortedPphValues = [...teamPphResult.personPointsPerHour.values()].sort((a, b) => a - b);
  const totalPphStats = computeDispersionStats(sortedPphValues);

  let current: number | null = null;
  let reference: number | null = null;
  let commonPersonCount = 0;
  if (analyzedWeekTime !== null) {
    const currentPersons = personLevelValuesForWeek(includedPeriod, analyzedWeekTime, (o) => o.totals.indexNormalized);
    let referencePersons: PersonLevelValue[];
    if (comparisonMode === "semana_anterior") {
      const previousWeekTime = addCalendarDays(new Date(analyzedWeekTime), -7).getTime();
      referencePersons = personLevelValuesForWeek(
        lookbackResolved.filter((o) => !o.excluded),
        previousWeekTime,
        (o) => o.totals.indexNormalized,
      );
    } else {
      referencePersons = personLevelValuesForPriorWeeks(includedPeriod, analyzedWeekTime, (o) => o.totals.indexNormalized);
    }
    const comparison = computeCommonPopulationComparison(currentPersons, referencePersons);
    current = comparison.currentAverage;
    reference = comparison.referenceAverage;
    commonPersonCount = comparison.commonPersonIds.length;
  }

  const kpiWithDiff = kpiPerformance.filter((row): row is KpiPerformanceRow & { diffPp: number } => row.diffPp !== null);
  const sortedByDiffDesc = [...kpiWithDiff].sort((a, b) => b.diffPp - a.diffPp);
  const topImprovingKpis = sortedByDiffDesc.filter((row) => row.diffPp > 0).slice(0, 3);
  const topDecliningKpis = [...sortedByDiffDesc].reverse().filter((row) => row.diffPp < 0).slice(0, 3);

  const personRows = buildPersonRows(includedPeriod, lookbackResolved, analyzedWeekTime, comparisonMode);
  const personWithDiff = personRows.filter((row): row is PersonSummaryRow & { diffPp: number } => row.diffPp !== null);
  const sortedPersonsByDiffDesc = [...personWithDiff].sort((a, b) => b.diffPp - a.diffPp);
  const topImprovingPersons = sortedPersonsByDiffDesc
    .filter((row) => row.diffPp > 0)
    .slice(0, 3)
    .map((row) => ({ personId: row.personId, personFullName: row.personFullName, diffPp: row.diffPp }));
  const topDecliningPersons = [...sortedPersonsByDiffDesc]
    .reverse()
    .filter((row) => row.diffPp < 0)
    .slice(0, 3)
    .map((row) => ({ personId: row.personId, personFullName: row.personFullName, diffPp: row.diffPp }));

  const perKpiDistribution: Record<string, { stats: DispersionStats; buckets: Record<DistributionBucket, number> }> = {};
  for (const kpi of kpiCatalog) {
    const cellOf = (o: ResolvedObservation) => o.cells.find((c) => c.kpiCode === kpi.code) ?? null;
    const percentResult = computeHierarchicalAverage(weightedCells(includedPeriod, (o) => cellOf(o)?.q ?? null));
    const sorted = [...percentResult.personPeriodValues.values()].sort((a, b) => a - b);
    perKpiDistribution[kpi.code] = { stats: computeDispersionStats(sorted), buckets: buildDistribution(sorted) };
  }

  const personsWithResults = new Set(periodResolved.map((o) => o.personId)).size;
  const personsAnalyzable = new Set(includedPeriod.map((o) => o.personId)).size;
  const observationsConsolidated = new Set(periodResolved.map((o) => `${o.personId}__${formatCalendarDate(o.weekStartDate)}`)).size;
  const absentCount = periodResolved.filter((o) => o.attendance === "ABSENT").length;
  const unknownLegacyCount = periodResolved.filter((o) => o.attendance === "UNKNOWN_LEGACY").length;
  const knownAttendanceCount = periodResolved.length - unknownLegacyCount;
  const totalHoursAnalyzed = includedPeriod.reduce((sum, o) => sum + (o.hours ?? 0), 0);

  return {
    analyzedWeekStart,
    comparisonMode,
    periodWeekStartDates,
    coverage: {
      personsWithResults,
      personsAnalyzable,
      observationsOriginal: periodResolved.length,
      observationsConsolidated,
      absentCount,
      unknownLegacyCount,
      attendancePercentage: knownAttendanceCount > 0 ? (100 * (knownAttendanceCount - absentCount)) / knownAttendanceCount : null,
      totalHoursAnalyzed,
    },
    overview: {
      averageWeeklyPoints: pointsResult.teamAverage,
      teamIndex: indexResult.teamAverage,
      teamIndexMedian: totalIndexStats.median,
      teamPointsPerHour: teamPphResult.teamPointsPerHour,
      current,
      reference,
      diffPp: current !== null && reference !== null ? ppDifference(current, reference) : null,
      commonPersonCount,
      topImprovingKpis: topImprovingKpis.map((row) => ({ kpiCode: row.kpiCode, kpiName: row.kpiName, diffPp: row.diffPp })),
      topDecliningKpis: topDecliningKpis.map((row) => ({ kpiCode: row.kpiCode, kpiName: row.kpiName, diffPp: row.diffPp })),
      topImprovingPersons,
      topDecliningPersons,
    },
    trend,
    pphTrend,
    perLevelTrend,
    kpiTrend,
    personTrend,
    kpiPerformance,
    distribution: {
      totalIndex: { stats: totalIndexStats, buckets: buildDistribution(sortedIndexValues) },
      totalPointsPerHour: { stats: totalPphStats },
      perKpi: perKpiDistribution,
    },
    personRows,
  };
}

export { bucketForPercentage };
