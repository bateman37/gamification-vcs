import Link from "next/link";
import { Badge, SectionHeader, TABLE_HEAD_ROW_CLASSES, TABLE_ROW_HOVER_CLASSES, TableContainer } from "@/components/ui";
import { DISTRIBUTION_BUCKET_LABELS, DISTRIBUTION_BUCKET_ORDER, type AnalyticsSnapshot } from "@/domain/analytics";
import { formatPercentEs, formatPointsEs, formatPpEs } from "./format";
import { TrendLineChart } from "./charts/TrendLineChart";
import { SimpleBarChart } from "./charts/SimpleBarChart";
import { ANALYTICS_COLORS, LEVEL_COLORS } from "./colors";
import { buildAnalyticsHref, type RawSearchParams } from "@/app/analitica/filters";

/** Bloque 2 - Rendimiento por KPI (parte H3 del encargo). */
export function KpiPerformanceTab({
  snapshot,
  selectedKpi,
  searchParams,
}: {
  snapshot: AnalyticsSnapshot;
  selectedKpi: string | null;
  searchParams: RawSearchParams;
}) {
  const detailRow = selectedKpi ? snapshot.kpiPerformance.find((r) => r.kpiCode === selectedKpi) : null;

  return (
    <div className="space-y-6">
      <div className="rounded-card border border-border bg-surface p-4">
        <SectionHeader title="Indicadores" description="Media del equipo, mediana, mínimo/máximo entre personas y comparación con la referencia elegida." />
        <TableContainer>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={TABLE_HEAD_ROW_CLASSES}>
                <th className="px-3 py-2">KPI</th>
                <th className="px-3 py-2">Media (%)</th>
                <th className="px-3 py-2">Media (pts)</th>
                <th className="px-3 py-2">Mediana</th>
                <th className="px-3 py-2">Mín–Máx</th>
                <th className="px-3 py-2">Actual</th>
                <th className="px-3 py-2">Referencia</th>
                <th className="px-3 py-2">Diferencia</th>
                <th className="px-3 py-2">Personas / mediciones</th>
                <th className="px-3 py-2">Ceros / ausentes / no aplica</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.kpiPerformance.map((row) => (
                <tr key={row.kpiCode} className={TABLE_ROW_HOVER_CLASSES}>
                  <td className="px-3 py-2 font-medium">
                    <Link href={buildAnalyticsHref(searchParams, { kpi: row.kpiCode })} className="text-primary hover:underline">
                      {row.kpiName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 tabular">{formatPercentEs(row.teamAveragePercentage)}</td>
                  <td className="px-3 py-2 tabular">{formatPointsEs(row.teamAveragePoints)}</td>
                  <td className="px-3 py-2 tabular">{formatPercentEs(row.medianPercentage)}</td>
                  <td className="px-3 py-2 tabular">
                    {row.minPercentage !== null && row.maxPercentage !== null ? `${formatPercentEs(row.minPercentage)} – ${formatPercentEs(row.maxPercentage)}` : "—"}
                  </td>
                  <td className="px-3 py-2 tabular">{formatPercentEs(row.currentValue)}</td>
                  <td className="px-3 py-2 tabular">{formatPercentEs(row.referenceValue)}</td>
                  <td className="px-3 py-2 tabular">{formatPpEs(row.diffPp)}</td>
                  <td className="px-3 py-2 tabular">
                    {row.analyzablePersonCount} personas / {row.measurementCount} mediciones
                  </td>
                  <td className="px-3 py-2 tabular">
                    {row.zeroCount} / {row.missingCount} / {row.notApplicableCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      </div>

      {detailRow && (
        <div className="rounded-card border border-border bg-surface p-4">
          <SectionHeader
            title={`Detalle: ${detailRow.kpiName}`}
            description="Máximo base configurado = 100 %. La referencia de 100 % es el máximo de esa instantánea, no un nuevo objetivo."
            actions={
              <Link href={buildAnalyticsHref(searchParams, { kpi: null })} className="text-sm text-primary hover:underline">
                Cerrar detalle
              </Link>
            }
          />
          <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-text-muted">Evolución de la media del equipo</p>
              <TrendLineChart
                data={(snapshot.kpiTrend[detailRow.kpiCode] ?? []).map((p) => ({ label: p.periodLabel, valor: p.teamIndex }))}
                series={[{ key: "valor", name: `${detailRow.kpiName} (%)`, color: ANALYTICS_COLORS.primary }]}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-text-muted">Distribución del equipo</p>
              <SimpleBarChart
                data={DISTRIBUTION_BUCKET_ORDER.map((bucket) => ({
                  label: DISTRIBUTION_BUCKET_LABELS[bucket],
                  value: snapshot.distribution.perKpi[detailRow.kpiCode]?.buckets[bucket] ?? 0,
                }))}
                valueSuffix=" personas"
              />
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-text-muted">Comparación por nivel histórico</p>
            <div className="flex flex-wrap gap-3">
              {(["N0", "N1", "N2"] as const).map((level) => (
                <Badge key={level} tone={level === "N0" ? "info" : level === "N1" ? "primary" : "game"}>
                  <span style={{ color: LEVEL_COLORS[level] }}>{level}</span>: {formatPercentEs(detailRow.byLevel[level])}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
