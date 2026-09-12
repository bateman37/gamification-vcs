import { requireAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { buildAnalyticsSnapshot, resolveObservations, DEFAULT_ZERO_THRESHOLD } from "@/domain/analytics";
import { KPI_CATALOG_FOR_ANALYTICS, loadParticipantWeekObservationsWithLookback } from "@/server/services/analytics.service";
import { ANALYTICS_TABS, type RawSearchParams } from "./filters";
import { resolveEffectiveScope } from "./scope";
import { AnalyticsFiltersPanel } from "@/components/analytics/AnalyticsFiltersPanel";
import { AnalyticsTabsNav } from "@/components/analytics/AnalyticsTabsNav";
import { OverviewTab } from "@/components/analytics/OverviewTab";
import { KpiPerformanceTab } from "@/components/analytics/KpiPerformanceTab";
import { TeamEvolutionTab } from "@/components/analytics/TeamEvolutionTab";
import { DistributionTab } from "@/components/analytics/DistributionTab";
import { PersonAnalysisTab } from "@/components/analytics/PersonAnalysisTab";
import { GamificationImpactTab } from "@/components/analytics/GamificationImpactTab";
import { buildGamificationTabData } from "@/server/services/analytics-gamification.service";

export default async function AnaliticaPage({ searchParams }: { searchParams: RawSearchParams }) {
  await requireAdminSession();

  const { filters, splitOptions, effectiveSplitIds, effectiveLevels, startDate, endDate } = await resolveEffectiveScope(prisma, searchParams);

  if (effectiveSplitIds.length === 0 || splitOptions.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analítica avanzada" description="Analiza al equipo y a cada persona a partir de las semanas publicadas." />
        <p className="rounded-card border border-dashed border-border-strong px-4 py-10 text-center text-sm text-text-muted">
          Todavía no hay ninguna semana publicada. Esta analítica se activa en cuanto exista al menos una publicación.
        </p>
      </div>
    );
  }

  const lookbackObservations = await loadParticipantWeekObservationsWithLookback(prisma, {
    splitIds: effectiveSplitIds,
    startDate,
    endDate,
    levels: effectiveLevels,
  });

  const resolvedLookback = resolveObservations(lookbackObservations, {
    mode: filters.mode,
    exclusionEnabled: filters.exclusionEnabled,
    zeroThreshold: filters.zeroThreshold,
    manualOverrides: filters.manualOverrides,
  });
  const resolvedPeriod = resolvedLookback.filter((o) => o.weekStartDate.getTime() >= startDate.getTime() && o.weekStartDate.getTime() <= endDate.getTime());

  const snapshot = buildAnalyticsSnapshot(
    resolvedPeriod,
    resolvedLookback,
    KPI_CATALOG_FOR_ANALYTICS,
    filters.grouping,
    filters.comparisonMode,
    startDate,
    endDate,
    filters.analyzedWeek ?? undefined,
  );

  const gamificationData =
    filters.tab === "gamificacion"
      ? await buildGamificationTabData(prisma, {
          splitIds: effectiveSplitIds,
          startDate,
          endDate,
          levels: effectiveLevels,
          exclusionEnabled: filters.exclusionEnabled,
          zeroThreshold: filters.zeroThreshold,
          manualOverrides: filters.manualOverrides,
        })
      : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Analítica avanzada" description="Analiza el rendimiento del equipo y de cada persona a partir de semanas publicadas. No sustituye a Resultados." />

      <AnalyticsFiltersPanel
        searchParams={searchParams}
        splitOptions={splitOptions}
        filters={filters}
        effectiveSplitIds={effectiveSplitIds}
        startDate={startDate}
        endDate={endDate}
        periodWeekStartDates={snapshot.periodWeekStartDates}
        defaultZeroThreshold={DEFAULT_ZERO_THRESHOLD}
      />

      <AnalyticsTabsNav tabs={ANALYTICS_TABS} activeTab={filters.tab} searchParams={searchParams} />

      {filters.tab === "vision-general" && <OverviewTab snapshot={snapshot} searchParams={searchParams} />}
      {filters.tab === "rendimiento-kpi" && <KpiPerformanceTab snapshot={snapshot} selectedKpi={filters.selectedKpi} searchParams={searchParams} />}
      {filters.tab === "evolucion" && <TeamEvolutionTab snapshot={snapshot} filters={filters} searchParams={searchParams} />}
      {filters.tab === "distribucion" && <DistributionTab snapshot={snapshot} selectedKpi={filters.selectedKpi} searchParams={searchParams} />}
      {filters.tab === "personas" && <PersonAnalysisTab snapshot={snapshot} searchParams={searchParams} />}
      {filters.tab === "gamificacion" && gamificationData && <GamificationImpactTab data={gamificationData} startDate={startDate} endDate={endDate} />}
    </div>
  );
}
