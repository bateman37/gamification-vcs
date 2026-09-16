import { rankByComparator, compareNormalizedAlias } from "@/domain/ranking";

/**
 * Ordenacion de la clasificacion general de badges (`1.2.3`, seccion 6.2 del
 * encargo, ver docs/BADGES.md). Funcion pura: la agregacion por persona vive
 * en `badge.service.ts` (lectura de base de datos); este modulo solo decide
 * el orden segun el criterio activo.
 */

export const BADGE_SORT_TOTAL = "TOTAL";
export const BADGE_SORT_MVP = "MVP";
export const BADGE_SORT_TEAM_MVP = "TEAM_MVP";

/** Criterio de ordenacion: `TOTAL`, `MVP`, `TEAM_MVP`, o el `code` de cualquier categoria KPI del catalogo. */
export type BadgeSortKey = string;

export interface BadgeClassificationSourceEntry {
  personId: string;
  fullName: string;
  mvpCount: number;
  teamMvpCount: number;
  totalCount: number;
  /** Conteo por `code` de badge KPI (incluye las categorias historicas sin KPI activo). */
  countByBadgeCode: ReadonlyMap<string, number>;
}

export interface BadgeClassificationEntry extends BadgeClassificationSourceEntry {
  rank: number;
}

function countForSortKey(entry: BadgeClassificationSourceEntry, sortKey: BadgeSortKey): number {
  if (sortKey === BADGE_SORT_TOTAL) return entry.totalCount;
  if (sortKey === BADGE_SORT_MVP) return entry.mvpCount;
  if (sortKey === BADGE_SORT_TEAM_MVP) return entry.teamMvpCount;
  return entry.countByBadgeCode.get(sortKey) ?? 0;
}

/**
 * Orden inicial (MVP, seccion 6.2): mayor MVP, despues mayor total de
 * badges, despues mayor MVP Team, despues nombre alfabetico. Para cualquier
 * otro criterio elegido explicitamente: mayor valor del criterio, despues
 * mayor total de badges, despues nombre alfabetico (el propio encargo separa
 * ambos casos). Las personas con cero en la categoria elegida siguen
 * apareciendo, al final.
 */
export function sortBadgeClassification(
  entries: readonly BadgeClassificationSourceEntry[],
  sortKey: BadgeSortKey,
): BadgeClassificationEntry[] {
  const byNameAsc = (a: BadgeClassificationSourceEntry, b: BadgeClassificationSourceEntry) =>
    compareNormalizedAlias(a.fullName.trim().toLowerCase(), b.fullName.trim().toLowerCase()) || a.personId.localeCompare(b.personId);

  const compareDescending =
    sortKey === BADGE_SORT_MVP
      ? (a: BadgeClassificationSourceEntry, b: BadgeClassificationSourceEntry) => {
          const byMvp = b.mvpCount - a.mvpCount;
          if (byMvp !== 0) return byMvp;
          const byTotal = b.totalCount - a.totalCount;
          if (byTotal !== 0) return byTotal;
          return b.teamMvpCount - a.teamMvpCount;
        }
      : (a: BadgeClassificationSourceEntry, b: BadgeClassificationSourceEntry) => {
          const byCriterion = countForSortKey(b, sortKey) - countForSortKey(a, sortKey);
          if (byCriterion !== 0) return byCriterion;
          return b.totalCount - a.totalCount;
        };

  const ranked = rankByComparator(entries, compareDescending, byNameAsc);
  return ranked.map(({ item, rank }) => ({ ...item, rank }));
}
