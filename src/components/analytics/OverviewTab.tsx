import Link from "next/link";
import { Alert, Badge, SectionHeader, StatCard } from "@/components/ui";
import type { AnalyticsSnapshot } from "@/domain/analytics";
import { formatDateEs, formatPercentEs, formatPointsEs, formatPpEs } from "./format";
import { TrendLineChart } from "./charts/TrendLineChart";
import { ANALYTICS_COLORS } from "./colors";
import { buildAnalyticsHref, type RawSearchParams } from "@/app/analitica/filters";

/**
 * Bloque 1 - Vision general (parte H2 del encargo): entender la seleccion en
 * unos segundos. Nunca fuerza un "mejor"/"peor" cuando falta referencia.
 */
export function OverviewTab({ snapshot, searchParams }: { snapshot: AnalyticsSnapshot; searchParams: RawSearchParams }) {
  const { overview, coverage } = snapshot;

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Personas analizables"
          value={`${coverage.personsAnalyzable} de ${coverage.personsWithResults}`}
          helpText="Con al menos una observación no excluida en el periodo."
        />
        <StatCard
          label="Semanas / publicaciones"
          value={`${snapshot.periodWeekStartDates.length} sem.`}
          helpText={`${coverage.observationsOriginal} publicaciones de split, ${coverage.observationsConsolidated} persona-semana`}
        />
        <StatCard label="Media semanal de puntos KPI" value={formatPointsEs(overview.averageWeeklyPoints)} tone="primary" helpText="Por persona, jerarquía E2/E3" />
        <StatCard
          label="Índice KPI medio del equipo"
          value={formatPercentEs(overview.teamIndex)}
          tone="game"
          helpText={overview.teamIndexMedian !== null ? `Mediana ${formatPercentEs(overview.teamIndexMedian)}` : undefined}
        />
        <StatCard
          label="Observaciones excluidas"
          value={coverage.excludedCount}
          tone={coverage.excludedCount > 0 ? "reward" : "ink"}
          helpText={
            <Link href={buildAnalyticsHref(searchParams, { tab: "personas" })} className="underline">
              Ver exclusiones en Análisis por persona
            </Link>
          }
        />
      </dl>

      {coverage.excludedWithPositiveValue > 0 && (
        <Alert tone="warning">
          {coverage.excludedWithPositiveValue} observación(es) excluida(s) por la política de posibles ausencias contienen también algún valor
          positivo: revísalas antes de sacar conclusiones (pestaña Análisis por persona).
        </Alert>
      )}

      <div className="rounded-card border border-border bg-surface p-4">
        <SectionHeader
          title="Semana analizada y comparación"
          description={
            snapshot.analyzedWeekStart
              ? `Semana del ${formatDateEs(snapshot.analyzedWeekStart)}, comparada con ${
                  snapshot.comparisonMode === "semana_anterior" ? "la semana anterior" : "la media de las semanas anteriores del período"
                }.`
              : "No hay semanas publicadas en el periodo seleccionado."
          }
        />
        {overview.current === null || overview.reference === null ? (
          <p className="mt-3 text-sm text-text-muted">
            {snapshot.comparisonMode === "semana_anterior" ? "Sin referencia en la semana anterior." : "Sin semanas anteriores del período para calcular la media."}
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <StatCard label="Valor actual" value={formatPercentEs(overview.current)} />
            <StatCard label="Referencia" value={formatPercentEs(overview.reference)} />
            <StatCard label="Diferencia" value={formatPpEs(overview.diffPp)} tone={overview.diffPp !== null && overview.diffPp >= 5 ? "success" : overview.diffPp !== null && overview.diffPp <= -5 ? "danger" : "ink"} />
            <Badge tone={overview.commonPersonCount < 3 ? "amber" : "green"}>Comparación sobre {overview.commonPersonCount} personas comunes</Badge>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-text-muted">KPI con mayor mejora</p>
            {overview.topImprovingKpis.length === 0 ? (
              <p className="text-sm text-text-muted">Sin mejoras destacables o sin referencia suficiente.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {overview.topImprovingKpis.map((k) => (
                  <li key={k.kpiCode}>
                    {k.kpiName}: <span className="font-medium text-success">{formatPpEs(k.diffPp)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-text-muted">KPI con mayor descenso</p>
            {overview.topDecliningKpis.length === 0 ? (
              <p className="text-sm text-text-muted">Sin descensos destacables o sin referencia suficiente.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {overview.topDecliningKpis.map((k) => (
                  <li key={k.kpiCode}>
                    {k.kpiName}: <span className="font-medium text-danger">{formatPpEs(k.diffPp)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-text-muted">Personas con mayor mejora</p>
            {overview.topImprovingPersons.length === 0 ? (
              <p className="text-sm text-text-muted">Sin mejoras destacables o sin referencia suficiente.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {overview.topImprovingPersons.map((p) => (
                  <li key={p.personId}>
                    <Link href={`/analitica/personas/${p.personId}`} className="text-primary hover:underline">
                      {p.personFullName}
                    </Link>
                    : <span className="font-medium text-success">{formatPpEs(p.diffPp)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-text-muted">Personas con mayor descenso</p>
            {overview.topDecliningPersons.length === 0 ? (
              <p className="text-sm text-text-muted">Sin descensos destacables o sin referencia suficiente.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {overview.topDecliningPersons.map((p) => (
                  <li key={p.personId}>
                    <Link href={`/analitica/personas/${p.personId}`} className="text-primary hover:underline">
                      {p.personFullName}
                    </Link>
                    : <span className="font-medium text-danger">{formatPpEs(p.diffPp)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface p-4">
        <SectionHeader title="Tendencia del equipo" description="Índice KPI medio normalizado (% del máximo base), agrupado según el filtro seleccionado." />
        <TrendLineChart
          data={snapshot.trend.map((p) => ({ label: p.periodLabel, indice: p.teamIndex }))}
          series={[{ key: "indice", name: "Índice del equipo (%)", color: ANALYTICS_COLORS.primary }]}
        />
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-text-muted">Ver datos</summary>
          <table className="mt-2 w-full text-left text-xs">
            <thead>
              <tr className="text-text-muted">
                <th className="py-1">Periodo</th>
                <th className="py-1">Índice</th>
                <th className="py-1">Personas</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.trend.map((p) => (
                <tr key={p.periodKey}>
                  <td className="py-0.5">{p.periodLabel}</td>
                  <td className="py-0.5">{formatPercentEs(p.teamIndex)}</td>
                  <td className="py-0.5">{p.analyzablePersonCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>

      <div className="rounded-card border border-border bg-surface p-4">
        <SectionHeader title="Resumen por KPI" description="Media del equipo en % del máximo base configurado." />
        <ul className="mt-2 divide-y divide-border text-sm">
          {snapshot.kpiPerformance.map((row) => (
            <li key={row.kpiCode} className="flex items-center justify-between gap-4 py-1.5">
              <span>{row.kpiName}</span>
              <span className="tabular font-medium">{formatPercentEs(row.teamAveragePercentage)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
