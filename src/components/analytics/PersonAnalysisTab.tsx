import Link from "next/link";
import { Badge, SectionHeader, TABLE_HEAD_ROW_CLASSES, TABLE_ROW_HOVER_CLASSES, TableContainer } from "@/components/ui";
import type { AnalyticsSnapshot } from "@/domain/analytics";
import { formatPercentEs, formatPointsEs, formatPpEs } from "./format";
import { KPI_CATALOG } from "@/domain/kpis/catalog";
import { ExclusionsPanel } from "./ExclusionsPanel";
import type { RawSearchParams } from "@/app/analitica/filters";

/** Bloque 5 - Análisis por persona (parte H6 del encargo). */
export function PersonAnalysisTab({ snapshot, searchParams }: { snapshot: AnalyticsSnapshot; searchParams: RawSearchParams }) {
  return (
    <div className="space-y-6">
      <div className="rounded-card border border-border bg-surface p-4">
        <SectionHeader title="Personas" description="Una fila por persona real (personId), sin alias ni facciones." />
        <TableContainer>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={TABLE_HEAD_ROW_CLASSES}>
                <th className="px-3 py-2">Persona</th>
                <th className="px-3 py-2">Nivel</th>
                <th className="px-3 py-2">Semanas válidas / excluidas</th>
                <th className="px-3 py-2">Media semanal puntos</th>
                <th className="px-3 py-2">Índice KPI medio</th>
                <th className="px-3 py-2">Actual</th>
                <th className="px-3 py-2">Referencia</th>
                <th className="px-3 py-2">Diferencia</th>
                <th className="px-3 py-2">Mejor / peor KPI</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.personRows.map((row) => (
                <tr key={row.personId} className={TABLE_ROW_HOVER_CLASSES}>
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/analitica/personas/${row.personId}`} className="text-primary hover:underline">
                      {row.personFullName}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.levels.length > 1 ? <Badge tone="amber">Varios niveles</Badge> : row.levels[0] ?? "—"}</td>
                  <td className="px-3 py-2 tabular">
                    {row.validWeekCount} / {row.excludedWeekCount}
                  </td>
                  <td className="px-3 py-2 tabular">{formatPointsEs(row.averageWeeklyPoints)}</td>
                  <td className="px-3 py-2 tabular">{formatPercentEs(row.teamIndex)}</td>
                  <td className="px-3 py-2 tabular">{formatPercentEs(row.currentValue)}</td>
                  <td className="px-3 py-2 tabular">{formatPercentEs(row.referenceValue)}</td>
                  <td className="px-3 py-2 tabular">{formatPpEs(row.diffPp)}</td>
                  <td className="px-3 py-2 text-xs">
                    {row.bestKpi && <div>▲ {KPI_CATALOG[row.bestKpi.kpiCode as keyof typeof KPI_CATALOG]?.name ?? row.bestKpi.kpiCode} ({formatPercentEs(row.bestKpi.percentage)})</div>}
                    {row.worstKpi && <div>▼ {KPI_CATALOG[row.worstKpi.kpiCode as keyof typeof KPI_CATALOG]?.name ?? row.worstKpi.kpiCode} ({formatPercentEs(row.worstKpi.percentage)})</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
        {snapshot.personRows.length === 0 && <p className="mt-3 text-sm text-text-muted">Sin personas analizables con los filtros actuales.</p>}
      </div>

      <ExclusionsPanel exclusions={snapshot.exclusions} searchParams={searchParams} />
    </div>
  );
}
