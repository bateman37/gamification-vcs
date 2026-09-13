import Link from "next/link";
import { SectionHeader, StatCard } from "@/components/ui";
import type { AnalyticsMeasure, AnalyticsSnapshot } from "@/domain/analytics";
import { DISTRIBUTION_BUCKET_LABELS, DISTRIBUTION_BUCKET_ORDER } from "@/domain/analytics";
import { formatNumberEs, formatPercentEs, formatPointsEs } from "./format";
import { SimpleBarChart } from "./charts/SimpleBarChart";
import { buildAnalyticsHref, type RawSearchParams } from "@/app/analitica/filters";
import { KPI_CATALOG_LIST } from "@/domain/kpis/catalog";

/** Bloque 4 - Distribución y consistencia (parte H5 del encargo). */
export function DistributionTab({
  snapshot,
  selectedKpi,
  measure,
  searchParams,
}: {
  snapshot: AnalyticsSnapshot;
  selectedKpi: string | null;
  measure: AnalyticsMeasure;
  searchParams: RawSearchParams;
}) {
  // Puntos por hora solo tiene distribucion propia para el indice total (razon de sumas, G2): un
  // KPI concreto sigue distribuyendose por `%` del maximo base.
  const usesPph = measure === "pph" && !selectedKpi;
  const stats = usesPph
    ? snapshot.distribution.totalPointsPerHour.stats
    : selectedKpi
      ? snapshot.distribution.perKpi[selectedKpi]?.stats
      : snapshot.distribution.totalIndex.stats;
  const buckets = selectedKpi ? snapshot.distribution.perKpi[selectedKpi]?.buckets : usesPph ? undefined : snapshot.distribution.totalIndex.buckets;
  const label = selectedKpi ? KPI_CATALOG_LIST.find((k) => k.code === selectedKpi)?.name ?? selectedKpi : usesPph ? "Puntos por hora del equipo" : "Índice total normalizado";
  const formatter = usesPph ? formatPointsEs : formatPercentEs;

  const barData = DISTRIBUTION_BUCKET_ORDER.map((bucket) => ({ label: DISTRIBUTION_BUCKET_LABELS[bucket], value: buckets?.[bucket] ?? 0 }));

  return (
    <div className="space-y-6">
      <div className="rounded-card border border-border bg-surface p-4">
        <SectionHeader title="Selecciona qué distribuir" />
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href={buildAnalyticsHref(searchParams, { kpi: null })} className={`rounded-control px-2 py-1 text-xs ${!selectedKpi ? "bg-ink text-white" : "border border-border-strong"}`}>
            Índice total
          </Link>
          {KPI_CATALOG_LIST.map((kpi) => (
            <Link
              key={kpi.code}
              href={buildAnalyticsHref(searchParams, { kpi: kpi.code })}
              className={`rounded-control px-2 py-1 text-xs ${selectedKpi === kpi.code ? "bg-ink text-white" : "border border-border-strong"}`}
            >
              {kpi.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface p-4">
        <SectionHeader title={label} description="Cada persona cuenta una vez en esta distribución (media del periodo ya consolidada)." />
        {stats && stats.count === 1 && <p className="mt-2 text-sm text-text-muted">Muestra de 1 persona: no se presenta como prueba de consistencia del equipo.</p>}
        {stats && stats.count === 0 ? (
          <p className="mt-2 text-sm text-text-muted">Sin datos suficientes.</p>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Media" value={formatter(stats?.mean ?? null)} />
              <StatCard label="Mediana" value={formatter(stats?.median ?? null)} />
              <StatCard label="Mín / Máx" value={`${formatter(stats?.min ?? null)} / ${formatter(stats?.max ?? null)}`} />
              <StatCard label="Q1 / Q3 (RIC)" value={`${formatter(stats?.q1 ?? null)} / ${formatter(stats?.q3 ?? null)}`} helpText={stats?.iqr !== null && stats?.iqr !== undefined ? `RIC: ${formatNumberEs(stats.iqr)}` : undefined} />
            </dl>
            {usesPph ? (
              <p className="mt-4 text-xs text-text-muted">
                Puntos por hora no se agrupa por intervalos de porcentaje: consulta la media, mediana y rango anteriores.
              </p>
            ) : (
              <div className="mt-4">
                <SimpleBarChart data={barData} valueSuffix=" personas" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
