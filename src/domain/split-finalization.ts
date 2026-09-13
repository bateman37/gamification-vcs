import type { KpiCode } from "@/domain/kpis/catalog";

/**
 * Resumen final de un split (`1.2.2`, ver docs/DECISIONS.md). Funciones
 * puras: reciben entradas ya ranking oficial (calculadas por
 * `computeSplitClassification`/`computeFactionClassification`/
 * `computeSplitKpiClassification`, nunca reimplementadas aqui) y las
 * agrupan para el texto de la noticia final. Los empates se respetan
 * siempre: varias personas o facciones pueden compartir la posicion
 * ganadora.
 */

export interface FinalizationRankedName {
  rank: number;
  name: string;
}

export interface FinalizationPodiumEntry {
  rank: 1 | 2 | 3;
  names: string[];
}

export interface FinalizationFactionWinner {
  hasFactionData: boolean;
  names: string[];
}

export interface FinalizationKpiWinnerGroup {
  kpiCode: KpiCode;
  kpiName: string;
  hasApplicableData: boolean;
  sum: number;
  winners: string[];
}

export interface SplitFinalizationSummary {
  podium: FinalizationPodiumEntry[];
  factionWinner: FinalizationFactionWinner;
  kpiWinners: FinalizationKpiWinnerGroup[];
}

/**
 * Podio individual (rank 1 a 3) de la clasificacion general oficial
 * acumulada. Si un puesto no tiene ninguna entrada (menos de tres personas
 * en el split, o un empate que salta un rank), esa posicion se omite en vez
 * de inventar un orden.
 */
export function buildFinalizationPodium(entries: readonly FinalizationRankedName[]): FinalizationPodiumEntry[] {
  const podium: FinalizationPodiumEntry[] = [];
  for (const rank of [1, 2, 3] as const) {
    const names = entries.filter((entry) => entry.rank === rank).map((entry) => entry.name);
    if (names.length > 0) podium.push({ rank, names });
  }
  return podium;
}

/** Faccion(es) con `rank === 1` de la clasificacion acumulada de facciones. */
export function buildFinalizationFactionWinner(
  hasFactionData: boolean,
  entries: readonly FinalizationRankedName[],
): FinalizationFactionWinner {
  if (!hasFactionData) return { hasFactionData: false, names: [] };
  return { hasFactionData: true, names: entries.filter((entry) => entry.rank === 1).map((entry) => entry.name) };
}

/**
 * Ganador(es) de un KPI concreto: quienes tengan la mayor suma de
 * `finalPoints` a lo largo del split (`rank === 1` de
 * `computeSplitKpiClassification`). Sin entradas aplicables, se marca
 * `hasApplicableData: false` en vez de inventar un ganador.
 */
export function buildFinalizationKpiWinner(
  kpiCode: KpiCode,
  kpiName: string,
  entries: readonly { rank: number; name: string; sum: number }[],
): FinalizationKpiWinnerGroup {
  const winners = entries.filter((entry) => entry.rank === 1);
  if (winners.length === 0) {
    return { kpiCode, kpiName, hasApplicableData: false, sum: 0, winners: [] };
  }
  return { kpiCode, kpiName, hasApplicableData: true, sum: winners[0]!.sum, winners: winners.map((entry) => entry.name) };
}
