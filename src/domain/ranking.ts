import { Prisma } from "@prisma/client";

/**
 * Ranking de competicion (equivalente a `RANK.EQ` descendente de Excel):
 * empates exactos reciben la misma posicion y la siguiente posicion salta
 * el numero correspondiente (1, 2, 2, 4). Funcion pura, generica y
 * reutilizada tanto por el ranking semanal (puntos por posicion) como por
 * el ranking de cada KPI individual (ver docs/RESULTS_PUBLICATION.md).
 *
 * La comparacion de puntuaciones usa `Prisma.Decimal` sin redondeo: dos
 * puntuaciones solo se consideran empatadas si son exactamente iguales.
 * `tiebreak` decide unicamente el orden visual entre empatados (por
 * ejemplo, alias normalizado y despues id); nunca cambia la posicion
 * asignada.
 */

export interface RankedEntry<T> {
  item: T;
  rank: number;
}

/**
 * Version general: `compareDescending` decide tanto el orden como el
 * empate (debe devolver `0` solo cuando dos elementos empatan realmente en
 * todos los criterios de negocio). `tiebreak` solo decide el orden visual
 * estable entre empatados (por ejemplo alias y despues id): nunca cambia
 * la posicion asignada. Usada por la clasificacion acumulada del split
 * (dos criterios: puntos por posicion y despues puntos KPI).
 */
export function rankByComparator<T>(
  items: readonly T[],
  compareDescending: (a: T, b: T) => number,
  tiebreak: (a: T, b: T) => number,
): RankedEntry<T>[] {
  const sorted = [...items].sort((a, b) => {
    const comparison = compareDescending(a, b);
    if (comparison !== 0) return comparison;
    return tiebreak(a, b);
  });

  const result: RankedEntry<T>[] = [];
  let previousItem: T | null = null;
  let previousRank = 0;

  sorted.forEach((item, index) => {
    if (previousItem !== null && compareDescending(previousItem, item) === 0) {
      result.push({ item, rank: previousRank });
    } else {
      const rank = index + 1;
      result.push({ item, rank });
      previousRank = rank;
    }
    previousItem = item;
  });

  return result;
}

/** Compara dos `Prisma.Decimal` en orden descendente (mayor primero), sin redondeo. */
export function compareDecimalDescending(a: Prisma.Decimal, b: Prisma.Decimal): number {
  return b.comparedTo(a);
}

/** Caso particular de `rankByComparator` con una unica puntuacion Decimal: ranking semanal y ranking por KPI. */
export function rankByScoreDescending<T>(
  items: readonly T[],
  score: (item: T) => Prisma.Decimal,
  tiebreak: (a: T, b: T) => number,
): RankedEntry<T>[] {
  return rankByComparator(items, (a, b) => compareDecimalDescending(score(a), score(b)), tiebreak);
}

/** Compara dos alias ya normalizados (minusculas, sin espacios exteriores), para desempatar el orden visual sin conceder ninguna ventaja de negocio. */
export function compareNormalizedAlias(aliasA: string, aliasB: string): number {
  return aliasA.localeCompare(aliasB, "es");
}
