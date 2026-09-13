import Link from "next/link";
import { Badge, SectionHeader, StatCard } from "@/components/ui";
import type { AnalyticsMeasure, AnalyticsSnapshot } from "@/domain/analytics";
import { formatDateEs, formatPercentEs, formatPointsEs, formatPpEs } from "./format";
import { TrendLineChart } from "./charts/TrendLineChart";
import { ANALYTICS_COLORS } from "./colors";

/**
 * Bloque 1 - Vision general (parte H2 del encargo, actualizado en `1.1.1`):
 * entender la seleccion en unos segundos. Nunca fuerza un "mejor"/"peor"
 * cuando falta referencia. La antigua política de posibles ausencias (parte
 * F de `1.1.0`) se sustituye por la asistencia real publicada: una ausencia
 * confirmada queda siempre fuera de rendimiento, sin revisión manual.
 */
export function OverviewTab({ snapshot, measure }: { snapshot: AnalyticsSnapshot; measure: AnalyticsMeasure }) {
  const { overview, coverage } = snapshot;

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Personas analizables"
          value={`${coverage.personsAnalyzable} de ${coverage.personsWithResults}`}
          helpText="Presentes con al menos una semana en el periodo."
        />
        <StatCard
          label="Semanas-persona"
          value={`${coverage.observationsConsolidated}`}
          helpText={`${coverage.observationsOriginal} observaciones originales · ${formatPointsEs(coverage.totalHoursAnalyzed)} horas analizadas`}
        />
        <StatCard label="Media semanal de puntos KPI" value={formatPointsEs(overview.averageWeeklyPoints)} tone="primary" helpText="Por persona, jerarquía E2/E3" />
        <StatCard
          label="Índice KPI medio del equipo"
          value={formatPercentEs(overview.teamIndex)}
          tone="game"
          helpText={overview.teamIndexMedian !== null ? `Mediana ${formatPercentEs(overview.teamIndexMedian)}` : undefined}
        />
        <StatCard
          label="Asistencia"
          value={coverage.attendancePercentage === null ? "Sin datos" : `${formatPointsEs(coverage.attendancePercentage)} %`}
          tone={coverage.absentCount > 0 ? "reward" : "ink"}
          helpText={`${coverage.absentCount} ausencia(s)${coverage.unknownLegacyCount > 0 ? ` · ${coverage.unknownLegacyCount} semana(s) sin cobertura legacy` : ""}`}
        />
      </dl>

      {measure === "pph" && (
        <StatCard label="Puntos KPI por hora del equipo" value={overview.teamPointsPerHour === null ? "No calculable" : formatPointsEs(overview.teamPointsPerHour)} tone="primary" />
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

      {(() => {
        const trendPoints = measure === "pph" ? snapshot.pphTrend : snapshot.trend;
        const trendFormatter = measure === "pph" ? formatPointsEs : formatPercentEs;
        const trendLabel = measure === "pph" ? "Puntos por hora del equipo" : "Índice del equipo (%)";
        return (
          <div className="rounded-card border border-border bg-surface p-4">
            <SectionHeader
              title="Tendencia del equipo"
              description={
                measure === "pph"
                  ? "Puntos KPI por hora (razón de sumas), agrupado según el filtro seleccionado."
                  : "Índice KPI medio normalizado (% del máximo base), agrupado según el filtro seleccionado."
              }
            />
            <TrendLineChart
              data={trendPoints.map((p) => ({ label: p.periodLabel, valor: p.teamIndex }))}
              series={[{ key: "valor", name: trendLabel, color: ANALYTICS_COLORS.primary }]}
            />
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-text-muted">Ver datos</summary>
              <table className="mt-2 w-full text-left text-xs">
                <thead>
                  <tr className="text-text-muted">
                    <th className="py-1">Periodo</th>
                    <th className="py-1">{trendLabel}</th>
                    <th className="py-1">Personas</th>
                  </tr>
                </thead>
                <tbody>
                  {trendPoints.map((p) => (
                    <tr key={p.periodKey}>
                      <td className="py-0.5">{p.periodLabel}</td>
                      <td className="py-0.5">{p.teamIndex === null ? "—" : trendFormatter(p.teamIndex)}</td>
                      <td className="py-0.5">{p.analyzablePersonCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        );
      })()}

      <div className="rounded-card border border-border bg-surface p-4">
        <SectionHeader
          title="Resumen por KPI"
          description={measure === "pph" ? "Puntos KPI por hora del equipo (razón de sumas)." : measure === "points" ? "Media semanal del equipo, en puntos." : "Media del equipo en % del máximo base configurado."}
        />
        <ul className="mt-2 divide-y divide-border text-sm">
          {snapshot.kpiPerformance.map((row) => {
            const value =
              measure === "pph" ? row.teamPointsPerHour : measure === "points" ? row.teamAveragePoints : row.teamAveragePercentage;
            const formatter = measure === "percentage" ? formatPercentEs : formatPointsEs;
            return (
              <li key={row.kpiCode} className="flex items-center justify-between gap-4 py-1.5">
                <span>{row.kpiName}</span>
                <span className="tabular font-medium">{value === null ? "Sin datos suficientes" : formatter(value)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
