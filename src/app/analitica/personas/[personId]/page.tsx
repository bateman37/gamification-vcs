import { requireAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui";
import { buildPersonDetailSummary, buildPersonDetailWeeks, resolveObservations } from "@/domain/analytics";
import { loadParticipantWeekObservationsWithLookback } from "@/server/services/analytics.service";
import { resolveEffectiveScope } from "@/app/analitica/scope";
import type { RawSearchParams } from "@/app/analitica/filters";
import { PersonDetailView } from "@/components/analytics/PersonDetailView";

export default async function PersonaDetailPage({
  params,
  searchParams,
}: {
  params: { personId: string };
  searchParams: RawSearchParams;
}) {
  await requireAdminSession();

  const { filters, effectiveSplitIds, effectiveLevels, startDate, endDate } = await resolveEffectiveScope(prisma, searchParams);

  if (effectiveSplitIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Análisis por persona" />
        <EmptyState>Todavía no hay ninguna semana publicada.</EmptyState>
      </div>
    );
  }

  const observations = await loadParticipantWeekObservationsWithLookback(prisma, {
    splitIds: effectiveSplitIds,
    startDate,
    endDate,
    levels: effectiveLevels,
  });
  const resolvedLookback = resolveObservations(observations, {
    mode: filters.mode,
    exclusionEnabled: filters.exclusionEnabled,
    zeroThreshold: filters.zeroThreshold,
    manualOverrides: filters.manualOverrides,
  });
  const resolvedPeriod = resolvedLookback.filter(
    (o) => o.weekStartDate.getTime() >= startDate.getTime() && o.weekStartDate.getTime() <= endDate.getTime(),
  );

  const personObservations = resolvedPeriod.filter((o) => o.personId === params.personId);
  if (personObservations.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Análisis por persona" description="Sin observaciones publicadas para esta persona en el periodo y los splits seleccionados." />
        <EmptyState>No hay datos para esta persona con los filtros actuales. Prueba a ampliar el periodo o los splits.</EmptyState>
      </div>
    );
  }

  const teamIncluded = resolvedPeriod.filter((o) => !o.excluded);
  const weeks = buildPersonDetailWeeks(params.personId, personObservations, teamIncluded);
  const summary = buildPersonDetailSummary(params.personId, personObservations[0]!.personFullName, weeks);

  return (
    <div className="space-y-6">
      <PageHeader title={summary.personFullName} description="Evolución de esta persona y comparación con el resto de su nivel histórico." />
      <PersonDetailView summary={summary} weeks={weeks} mode={filters.mode} />
    </div>
  );
}
