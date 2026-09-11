import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById, getSplitWeek } from "@/server/services/split.service";
import { computeWeeklyResults } from "@/server/services/weekly-results.service";
import { requireAdminSession } from "@/lib/session";
import { KPI_CATALOG } from "@/domain/kpis/catalog";
import { formatCalendarDate } from "@/lib/dates";
import { EmptyState } from "@/components/ui";
import { WeeklyResultsTable, type ResultRow } from "./WeeklyResultsTable";
import { PublishWeekButton } from "./PublishWeekButton";

export default async function WeeklyResultsPage({ params }: { params: { id: string; weekId: string } }) {
  await requireAdminSession();
  const split = await getSplitById(prisma, params.id);
  if (!split) notFound();
  const week = await getSplitWeek(prisma, params.id, params.weekId);
  if (!week) notFound();

  const backHref = `/splits/${split.id}/weeks/${week.id}/kpis`;
  const weekLabel = `Semana ${week.sequenceNumber} (${formatCalendarDate(week.startDate)} a ${formatCalendarDate(week.endDate)})`;

  const publication = await prisma.weekPublication.findUnique({
    where: { splitWeekId: week.id },
    include: { participantResults: { include: { kpiResults: true } } },
  });

  if (publication) {
    const rows: ResultRow[] = publication.participantResults
      .map((participantResult) => ({
        splitParticipantId: participantResult.splitParticipantId,
        alias: participantResult.aliasSnapshot,
        fullName: participantResult.fullNameSnapshot,
        level: participantResult.levelSnapshot,
        kpiCells: participantResult.kpiResults.map((kpiResult) => ({
          kpiCode: kpiResult.kpiCode,
          kpiName: kpiResult.kpiNameSnapshot,
          status: kpiResult.outcomeStatus,
          finalPoints: kpiResult.finalPoints?.toNumber() ?? null,
          baseMax: kpiResult.baseMax?.toNumber() ?? null,
          capped: kpiResult.capped,
          kpiRank: kpiResult.kpiRank,
          rankedParticipantCount: kpiResult.rankedParticipantCount,
        })),
        totalKpiPoints: participantResult.totalKpiPoints.toNumber(),
        applicableMaxPoints: participantResult.applicableMaxPoints?.toNumber() ?? null,
        weeklyRank: participantResult.weeklyRank,
        positionPoints: participantResult.positionPoints,
        rankedParticipantCount: participantResult.rankedParticipantCount,
      }))
      .sort((a, b) => a.weeklyRank - b.weeklyRank || a.alias.localeCompare(b.alias, "es"));

    const activeKpis = (rows[0]?.kpiCells ?? [])
      .map((cell) => ({ code: cell.kpiCode, name: KPI_CATALOG[cell.kpiCode as keyof typeof KPI_CATALOG]?.name ?? cell.kpiName }))
      .sort((a, b) => (KPI_CATALOG[a.code as keyof typeof KPI_CATALOG]?.order ?? 0) - (KPI_CATALOG[b.code as keyof typeof KPI_CATALOG]?.order ?? 0));

    return (
      <div className="space-y-6">
        <div>
          <Link href={backHref} className="text-sm text-slate-600 underline hover:text-slate-900">
            Volver a las cargas de la semana
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold">{split.name}</h1>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">Publicada</span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{weekLabel}</p>
          <p className="mt-1 text-sm text-slate-600">
            Publicada el {publication.publishedAt.toLocaleString("es-ES")}.
          </p>
        </div>

        <WeeklyResultsTable rows={rows} activeKpis={activeKpis} />

        <Link href={backHref} className="inline-block text-sm text-slate-600 underline hover:text-slate-900">
          Volver
        </Link>
      </div>
    );
  }

  const results = await computeWeeklyResults(prisma, split.id, week.id);

  if (!results.isComplete) {
    return (
      <div className="space-y-6">
        <div>
          <Link href={backHref} className="text-sm text-slate-600 underline hover:text-slate-900">
            Volver a las cargas de la semana
          </Link>
          <h1 className="mt-2 text-xl font-semibold">{split.name}</h1>
          <p className="mt-1 text-sm text-slate-600">{weekLabel}</p>
        </div>
        <EmptyState>
          Esta semana todavia no esta completa: {results.completeness.loadedCount} de {results.completeness.totalActiveCount} KPI
          activos cargados. Completa todos los KPI activos antes de ver los resultados.
        </EmptyState>
        <Link href={backHref} className="inline-block text-sm text-slate-600 underline hover:text-slate-900">
          Ir a las cargas de la semana
        </Link>
      </div>
    );
  }

  const rows: ResultRow[] = results.participants
    .map((participant) => ({
      splitParticipantId: participant.splitParticipantId,
      alias: participant.alias,
      fullName: participant.fullName,
      level: participant.level,
      kpiCells: participant.kpiResults.map((kpiResult) => ({
        kpiCode: kpiResult.kpiCode,
        kpiName: kpiResult.kpiName,
        status: kpiResult.status,
        finalPoints: kpiResult.finalPoints,
        baseMax: kpiResult.baseMax,
        capped: kpiResult.capped,
        kpiRank: kpiResult.kpiRank,
        rankedParticipantCount: kpiResult.rankedParticipantCount,
      })),
      totalKpiPoints: participant.totalKpiPoints,
      applicableMaxPoints: participant.applicableMaxPoints,
      weeklyRank: participant.weeklyRank,
      positionPoints: participant.positionPoints,
      rankedParticipantCount: results.participants.length,
    }))
    .sort((a, b) => a.weeklyRank - b.weeklyRank || a.alias.localeCompare(b.alias, "es"));

  const activeKpis = results.activeKpiCodes.map((code) => ({ code, name: KPI_CATALOG[code].name }));

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-slate-600 underline hover:text-slate-900">
          Volver a las cargas de la semana
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{split.name}</h1>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Previsualizacion sin publicar
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">{weekLabel}</p>
        <p className="mt-1 text-xs text-slate-500">Calculado el {results.computedAt.toLocaleString("es-ES")}.</p>
        <p className="mt-2 text-sm text-slate-600">
          {results.totalParticipantCount} participantes - {results.totalActiveKpiCount} KPI activos - {results.totalVacCount} VAC en
          total.
        </p>
      </div>

      {results.blockingIssues.length > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">No se puede publicar hasta resolver:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {results.blockingIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <WeeklyResultsTable rows={rows} activeKpis={activeKpis} />

      <div className="flex flex-wrap items-center gap-3">
        <Link href={backHref} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Volver
        </Link>
        {results.blockingIssues.length === 0 && <PublishWeekButton splitId={split.id} weekId={week.id} />}
      </div>
    </div>
  );
}
