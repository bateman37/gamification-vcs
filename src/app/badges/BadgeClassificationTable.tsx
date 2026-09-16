import Link from "next/link";
import { TableContainer, TABLE_HEAD_ROW_CLASSES, TABLE_ROW_HOVER_CLASSES, Badge } from "@/components/ui";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { BADGE_SORT_MVP, BADGE_SORT_TEAM_MVP, BADGE_SORT_TOTAL } from "@/domain/badges/badge-classification";
import type { BadgeClassificationResult } from "@/server/services/badge.service";

/**
 * Clasificacion general de badges (seccion 6.2 del encargo): selector de
 * criterio compacto (nunca catorce columnas fijas) mas una tabla con las
 * columnas esenciales y un desglose accesible por categoria KPI dentro de
 * cada fila (`<details>`, sin JavaScript de cliente).
 */

function sortHref(key: string): string {
  const params = new URLSearchParams();
  params.set("vista", "clasificacion");
  params.set("orden", key);
  return `/badges?${params.toString()}`;
}

function sortLabelFor(key: string, kpiCategories: readonly { code: string; name: string }[]): string {
  if (key === BADGE_SORT_MVP) return "MVP";
  if (key === BADGE_SORT_TEAM_MVP) return "MVP Team";
  if (key === BADGE_SORT_TOTAL) return "Total de badges";
  return kpiCategories.find((category) => category.code === key)?.name ?? key;
}

function SortPill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active ? "bg-ink text-white" : "bg-surface-muted text-text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

export function BadgeClassificationTable({ data, sortKey }: { data: BadgeClassificationResult; sortKey: string }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Ordenar clasificación de badges por">
        <SortPill href={sortHref(BADGE_SORT_MVP)} active={sortKey === BADGE_SORT_MVP}>
          MVP
        </SortPill>
        <SortPill href={sortHref(BADGE_SORT_TEAM_MVP)} active={sortKey === BADGE_SORT_TEAM_MVP}>
          MVP Team
        </SortPill>
        <SortPill href={sortHref(BADGE_SORT_TOTAL)} active={sortKey === BADGE_SORT_TOTAL}>
          Total de badges
        </SortPill>
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-text-muted hover:text-ink">
            Categoría KPI…
          </summary>
          <div className="absolute z-10 mt-1 flex max-h-64 w-60 flex-col gap-1 overflow-y-auto rounded-card border border-border bg-surface p-2 shadow-soft">
            {data.kpiCategories.map((category) => (
              <Link
                key={category.code}
                href={sortHref(category.code)}
                aria-current={sortKey === category.code ? "true" : undefined}
                className={`rounded-control px-2 py-1 text-xs ${
                  sortKey === category.code ? "bg-ink text-white" : "text-ink hover:bg-surface-muted"
                }`}
              >
                {category.name}
              </Link>
            ))}
          </div>
        </details>
      </div>
      <p className="text-xs text-text-muted">
        Ordenado por: <span className="font-medium text-ink">{sortLabelFor(sortKey, data.kpiCategories)}</span> (descendente).
      </p>

      <TableContainer>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className={TABLE_HEAD_ROW_CLASSES}>
              <th scope="col" className="px-3 py-2">
                Pos.
              </th>
              <th scope="col" className="px-3 py-2">
                Persona
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                MVP
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                MVP Team
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Badges KPI
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Total
              </th>
              <th scope="col" className="px-3 py-2">
                Desglose
              </th>
            </tr>
          </thead>
          <tbody>
            {data.entries.map((entry) => {
              const kpiTotal = entry.totalCount - entry.mvpCount - entry.teamMvpCount;
              const breakdown = data.kpiCategories
                .map((category) => ({ ...category, count: entry.countByBadgeCode.get(category.code) ?? 0 }))
                .filter((category) => category.count > 0);
              return (
                <tr key={entry.personId} className={TABLE_ROW_HOVER_CLASSES}>
                  <td className="tabular px-3 py-2">{entry.rank}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <InitialsAvatar fullName={entry.fullName} />
                      <span className="font-medium text-ink">{entry.fullName}</span>
                    </div>
                  </td>
                  <td className="tabular px-3 py-2 text-right">
                    {entry.mvpCount > 0 ? <Badge tone="reward">{entry.mvpCount}</Badge> : "0"}
                  </td>
                  <td className="tabular px-3 py-2 text-right">
                    {entry.teamMvpCount > 0 ? <Badge tone="game">{entry.teamMvpCount}</Badge> : "0"}
                  </td>
                  <td className="tabular px-3 py-2 text-right">{kpiTotal}</td>
                  <td className="tabular px-3 py-2 text-right font-semibold">{entry.totalCount}</td>
                  <td className="px-3 py-2">
                    {breakdown.length === 0 ? (
                      <span className="text-xs text-text-muted">—</span>
                    ) : (
                      <details>
                        <summary className="cursor-pointer text-xs text-primary">Ver desglose</summary>
                        <ul className="mt-1 space-y-0.5 text-xs text-text-muted">
                          {breakdown.map((category) => (
                            <li key={category.code}>
                              {category.name}: {category.count}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableContainer>
    </div>
  );
}
