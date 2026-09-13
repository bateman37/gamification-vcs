import Link from "next/link";
import { SectionHeader } from "@/components/ui";
import type { AnalyticsSnapshot } from "@/domain/analytics";
import type { ParsedAnalyticsFilters, RawSearchParams } from "@/app/analitica/filters";
import { buildAnalyticsHref } from "@/app/analitica/filters";
import { TrendLineChart, type TrendPoint, type TrendSeriesDef } from "./charts/TrendLineChart";
import { LEVEL_COLORS, SERIES_PALETTE } from "./colors";
import { KPI_CATALOG_LIST } from "@/domain/kpis/catalog";
import { HiddenPassthroughFields } from "./HiddenPassthroughFields";

type EvolutionView = "equipo" | "niveles" | "personas";

function parseView(raw: string | string[] | undefined): EvolutionView {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "niveles" || value === "personas" ? value : "equipo";
}

/** Bloque 3 - Evolución del equipo (parte H4 del encargo). */
export function TeamEvolutionTab({
  snapshot,
  filters,
  searchParams,
}: {
  snapshot: AnalyticsSnapshot;
  filters: ParsedAnalyticsFilters;
  searchParams: RawSearchParams;
}) {
  const view = parseView(searchParams.evolucionVista);

  let series: TrendSeriesDef[] = [];
  let chartData: TrendPoint[] = [];

  if (view === "niveles") {
    const labels = snapshot.perLevelTrend.N0.map((p) => p.periodLabel);
    chartData = labels.map((label, index) => ({
      label,
      N0: snapshot.perLevelTrend.N0[index]?.teamIndex ?? null,
      N1: snapshot.perLevelTrend.N1[index]?.teamIndex ?? null,
      N2: snapshot.perLevelTrend.N2[index]?.teamIndex ?? null,
    }));
    series = [
      { key: "N0", name: "Nivel N0", color: LEVEL_COLORS.N0 },
      { key: "N1", name: "Nivel N1", color: LEVEL_COLORS.N1 },
      { key: "N2", name: "Nivel N2", color: LEVEL_COLORS.N2 },
    ];
  } else if (view === "personas") {
    const personIds = filters.selectedPersonIds.filter((id) => snapshot.personTrend[id]);
    const labelSource = personIds[0] ? snapshot.personTrend[personIds[0]] : snapshot.trend;
    chartData = (labelSource ?? []).map((point, index) => {
      const row: TrendPoint = { label: point.periodLabel };
      for (const personId of personIds) {
        row[personId] = snapshot.personTrend[personId]?.[index]?.teamIndex ?? null;
      }
      return row;
    });
    series = personIds.map((personId, index) => ({
      key: personId,
      name: snapshot.personRows.find((p) => p.personId === personId)?.personFullName ?? personId,
      color: SERIES_PALETTE[index % SERIES_PALETTE.length] as string,
    }));
  } else {
    const kpiCode = filters.selectedKpi;
    const points = kpiCode ? snapshot.kpiTrend[kpiCode] ?? [] : snapshot.trend;
    chartData = points.map((p) => ({ label: p.periodLabel, valor: p.teamIndex }));
    const kpiName = kpiCode ? KPI_CATALOG_LIST.find((k) => k.code === kpiCode)?.name ?? kpiCode : "Índice del equipo";
    series = [{ key: "valor", name: `${kpiName} (%)`, color: "#2563EB" }];
  }

  return (
    <div className="space-y-6">
      <div className="rounded-card border border-border bg-surface p-4">
        <SectionHeader
          title="Vista"
          description="No se combinan a la vez todos los KPI, todos los niveles y todas las personas: elige un modo de visualización."
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {(["equipo", "niveles", "personas"] as const).map((v) => (
            <Link
              key={v}
              href={buildAnalyticsHref(searchParams, { evolucionVista: v })}
              className={`rounded-control px-3 py-1.5 text-sm font-medium ${view === v ? "bg-ink text-white" : "border border-border-strong text-text-muted hover:bg-surface-muted"}`}
            >
              {v === "equipo" ? "Equipo / KPI" : v === "niveles" ? "Comparar niveles" : "Comparar personas"}
            </Link>
          ))}
        </div>

        {view === "equipo" && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={buildAnalyticsHref(searchParams, { kpi: null })} className={`rounded-control px-2 py-1 text-xs ${!filters.selectedKpi ? "bg-ink text-white" : "border border-border-strong"}`}>
              Índice total
            </Link>
            {KPI_CATALOG_LIST.map((kpi) => (
              <Link
                key={kpi.code}
                href={buildAnalyticsHref(searchParams, { kpi: kpi.code })}
                className={`rounded-control px-2 py-1 text-xs ${filters.selectedKpi === kpi.code ? "bg-ink text-white" : "border border-border-strong"}`}
              >
                {kpi.name}
              </Link>
            ))}
          </div>
        )}

        {view === "personas" && (
          <form method="get" action="/analitica" className="mt-3 space-y-2">
            <HiddenPassthroughFields searchParams={searchParams} excludeKeys={["personas"]} />
            <div className="flex max-h-40 flex-wrap gap-x-4 gap-y-1 overflow-y-auto text-sm">
              {snapshot.personRows.map((person) => (
                <label key={person.personId} className="flex items-center gap-1">
                  <input type="checkbox" name="personas" value={person.personId} defaultChecked={filters.selectedPersonIds.includes(person.personId)} />
                  {person.personFullName}
                </label>
              ))}
            </div>
            <button type="submit" className="rounded-control border border-border-strong px-3 py-1.5 text-sm font-medium hover:bg-surface-muted">
              Comparar (máx. 5)
            </button>
          </form>
        )}
      </div>

      <div className="rounded-card border border-border bg-surface p-4">
        <TrendLineChart data={chartData} series={series} height={340} />
      </div>
    </div>
  );
}
