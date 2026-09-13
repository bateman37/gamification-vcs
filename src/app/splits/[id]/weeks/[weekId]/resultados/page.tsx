import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById, getSplitWeek } from "@/server/services/split.service";
import { computeWeeklyResults } from "@/server/services/weekly-results.service";
import { requireAdminSession } from "@/lib/session";
import { KPI_CATALOG } from "@/domain/kpis/catalog";
import { formatCalendarDate } from "@/lib/dates";
import { EmptyState } from "@/components/ui";
import { WeeklyResultsTable, type ResultRow, type WeekLocationSummary } from "./WeeklyResultsTable";
import { WeekLocationSummaryCard } from "./WeekLocationSummaryCard";
import { FactionWeeklyPreviewTable, type FactionWeeklyPreviewRow } from "./FactionWeeklyPreviewTable";
import { PublishWeekButton } from "./PublishWeekButton";
import { selectFactionTopThree, rankFactions } from "@/domain/faction-ranking";

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
          basePointsBeforeProfession: kpiResult.basePointsBeforeProfession?.toNumber() ?? null,
          professionBonusPoints: kpiResult.professionBonusPoints?.toNumber() ?? null,
          professionApplied: kpiResult.professionApplied,
          professionName: kpiResult.professionNameSnapshot,
          locationBonusPoints: kpiResult.locationBonusPoints?.toNumber() ?? null,
          locationApplied: kpiResult.locationApplied,
          // Instantanea congelada de `PublishedKpiResult` (`0.9.0` / MVP-2D): nunca se
          // recalcula a partir del equipo actual, que puede haber cambiado desde entonces.
          equipmentBonusPoints: kpiResult.equipmentBonusPoints?.toNumber() ?? null,
          equipmentApplied: kpiResult.equipmentApplied,
          kpiRank: kpiResult.kpiRank,
          rankedParticipantCount: kpiResult.rankedParticipantCount,
        })),
        totalKpiPoints: participantResult.totalKpiPoints.toNumber(),
        applicableMaxPoints: participantResult.applicableMaxPoints?.toNumber() ?? null,
        weeklyRank: participantResult.weeklyRank,
        positionPoints: participantResult.positionPoints,
        rankedParticipantCount: participantResult.rankedParticipantCount,
        // `null` en publicaciones anteriores a `1.1.1`: se trata como presente para no reinterpretar
        // ausencia historicamente (ver docs/WEEKLY_ATTENDANCE_AND_HOURS.md).
        attendanceStatus: participantResult.attendanceStatus ?? "PRESENT",
        totalHours: participantResult.totalHoursSnapshot?.toNumber() ?? 0,
        // Una semana publicada siempre explica el bonus con su propia instantanea, nunca con la definicion actual.
        professionName: participantResult.professionNameSnapshot,
        professionKpiNames:
          participantResult.professionKpiCodeA && participantResult.professionKpiCodeB
            ? `${KPI_CATALOG[participantResult.professionKpiCodeA].name} + ${KPI_CATALOG[participantResult.professionKpiCodeB].name}`
            : null,
        professionBonusTotal: participantResult.kpiResults.reduce(
          (sum, kpiResult) => sum + (kpiResult.professionBonusPoints?.toNumber() ?? 0),
          0,
        ),
      }))
      // Presentes por posicion, despues ausentes por alias (seccion F1 del encargo `1.1.1`): un
      // `weeklyRank` nulo siempre se ordena al final, sin convertirlo en `0`.
      .sort((a, b) => (a.weeklyRank ?? Number.POSITIVE_INFINITY) - (b.weeklyRank ?? Number.POSITIVE_INFINITY) || a.alias.localeCompare(b.alias, "es"));

    const presentParticipantCount = publication.participantResults.filter((result) => result.attendanceStatus !== "ABSENT").length;

    // Snapshot congelado al publicar (`0.8.5` / MVP-2C): nunca se consulta una posible
    // configuracion viva distinta de `SplitWeekLocation`.
    const weekLocation: WeekLocationSummary | null =
      publication.locationNameSnapshot && publication.locationKpiCodeSnapshot && publication.locationBonusPercentSnapshot
        ? {
            name: publication.locationNameSnapshot,
            kpiCode: publication.locationKpiCodeSnapshot,
            bonusPercent: publication.locationBonusPercentSnapshot,
          }
        : null;

    const activeKpis = (rows[0]?.kpiCells ?? [])
      .map((cell) => ({ code: cell.kpiCode, name: KPI_CATALOG[cell.kpiCode as keyof typeof KPI_CATALOG]?.name ?? cell.kpiName }))
      .sort((a, b) => (KPI_CATALOG[a.code as keyof typeof KPI_CATALOG]?.order ?? 0) - (KPI_CATALOG[b.code as keyof typeof KPI_CATALOG]?.order ?? 0));

    const factionMembersById = new Map<string, { name: string; color: string; members: { splitParticipantId: string; alias: string; positionPoints: number }[] }>();
    for (const participantResult of publication.participantResults) {
      if (!participantResult.factionId) continue;
      let bucket = factionMembersById.get(participantResult.factionId);
      if (!bucket) {
        bucket = { name: participantResult.factionNameSnapshot ?? "—", color: participantResult.factionColorSnapshot ?? "#94a3b8", members: [] };
        factionMembersById.set(participantResult.factionId, bucket);
      }
      bucket.members.push({ splitParticipantId: participantResult.splitParticipantId, alias: participantResult.aliasSnapshot, positionPoints: participantResult.positionPoints });
    }
    const factionWorking = Array.from(factionMembersById.entries())
      .map(([factionId, bucket]) => ({ factionId, ...bucket, top: selectFactionTopThree(bucket.members) }))
      .filter((entry): entry is typeof entry & { top: NonNullable<typeof entry.top> } => entry.top !== null);
    const factionRanked = rankFactions(
      factionWorking.map((entry) => ({
        factionId: entry.factionId,
        factionName: entry.name,
        score: entry.top.weeklyScore,
        contributionVector: entry.top.topContributors.map((contributor) => contributor.positionPoints),
      })),
    );
    const factionRows: FactionWeeklyPreviewRow[] = factionRanked
      .map(({ item, rank }) => {
        const entry = factionWorking.find((candidate) => candidate.factionId === item.factionId)!;
        return { factionId: entry.factionId, name: entry.name, color: entry.color, weeklyRank: rank, weeklyScore: entry.top.weeklyScore, topContributors: entry.top.topContributors };
      })
      .sort((a, b) => a.weeklyRank - b.weeklyRank);

    return (
      <div className="space-y-6">
        <div>
          <Link href={backHref} className="text-sm text-text-muted underline hover:text-ink">
            Volver a las cargas de la semana
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold">{split.name}</h1>
            <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">Publicada</span>
          </div>
          <p className="mt-1 text-sm text-text-muted">{weekLabel}</p>
          <p className="mt-1 text-sm text-text-muted">
            Publicada el {publication.publishedAt.toLocaleString("es-ES")}.
          </p>
        </div>

        <WeekLocationSummaryCard location={weekLocation} />

        <WeeklyResultsTable
          rows={rows}
          activeKpis={activeKpis}
          presentParticipantCount={presentParticipantCount}
          showProfessionColumn={publication.participantResults.some((result) => result.splitUsedProfessions)}
          weekLocation={weekLocation}
        />

        <FactionWeeklyPreviewTable rows={factionRows} />

        <Link href={backHref} className="inline-block text-sm text-text-muted underline hover:text-ink">
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
          <Link href={backHref} className="text-sm text-text-muted underline hover:text-ink">
            Volver a las cargas de la semana
          </Link>
          <h1 className="mt-2 text-xl font-semibold">{split.name}</h1>
          <p className="mt-1 text-sm text-text-muted">{weekLabel}</p>
        </div>
        <WeekLocationSummaryCard location={results.location} />
        <EmptyState>
          Esta semana todavía no está completa: {results.completeness.loadedCount} de {results.completeness.totalActiveCount} KPI
          activos cargados. Completa todos los KPI activos y guarda las horas semanales de todos los
          participantes aplicables antes de ver los resultados.
        </EmptyState>
        <Link href={backHref} className="inline-block text-sm text-text-muted underline hover:text-ink">
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
        basePointsBeforeProfession: kpiResult.basePointsBeforeProfession,
        professionBonusPoints: kpiResult.professionBonusPoints,
        professionApplied: kpiResult.professionApplied,
        professionName: kpiResult.professionName,
        locationBonusPoints: kpiResult.locationBonusPoints,
        locationApplied: kpiResult.locationApplied,
        // Previsualizacion (`0.9.0` / MVP-2D): refleja el equipo actual del participante,
        // recalculado por `computeWeeklyResults` en cada consulta, nunca persistido aqui.
        equipmentBonusPoints: kpiResult.equipmentBonusPoints,
        equipmentApplied: kpiResult.equipmentApplied,
        kpiRank: kpiResult.kpiRank,
        rankedParticipantCount: kpiResult.rankedParticipantCount,
      })),
      totalKpiPoints: participant.totalKpiPoints,
      applicableMaxPoints: participant.applicableMaxPoints,
      weeklyRank: participant.weeklyRank,
      positionPoints: participant.positionPoints,
      rankedParticipantCount: results.presentParticipantCount,
      attendanceStatus: participant.attendanceStatus,
      totalHours: participant.totalHours,
      professionName: participant.profession?.name ?? null,
      professionKpiNames: participant.profession
        ? `${KPI_CATALOG[participant.profession.kpiCodeA].name} + ${KPI_CATALOG[participant.profession.kpiCodeB].name}`
        : null,
      professionBonusTotal: participant.professionBonusTotal,
    }))
    // Presentes por posicion, despues ausentes por alias (seccion F1 del encargo `1.1.1`).
    .sort((a, b) => (a.weeklyRank ?? Number.POSITIVE_INFINITY) - (b.weeklyRank ?? Number.POSITIVE_INFINITY) || a.alias.localeCompare(b.alias, "es"));

  const activeKpis = results.activeKpiCodes.map((code) => ({ code, name: KPI_CATALOG[code].name }));

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-text-muted underline hover:text-ink">
          Volver a las cargas de la semana
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{split.name}</h1>
          <span className="rounded-full bg-reward-soft px-2 py-0.5 text-xs font-medium text-reward-ink">
            Previsualizacion sin publicar
          </span>
        </div>
        <p className="mt-1 text-sm text-text-muted">{weekLabel}</p>
        <p className="mt-1 text-xs text-text-muted">Calculado el {results.computedAt.toLocaleString("es-ES")}.</p>
        <p className="mt-2 text-sm text-text-muted">
          {results.totalParticipantCount} participantes previstos · {results.presentParticipantCount} presentes ·{" "}
          {results.absentParticipantCount} ausentes · {results.totalActiveKpiCount} KPI activos · {results.totalVacCount} valores en 0
          por ausencia de datos en un origen ya confirmado.
        </p>
      </div>

      <WeekLocationSummaryCard location={results.location} />

      {results.blockingIssues.length > 0 && (
        <div className="rounded-md border border-danger/30 bg-danger-soft p-4 text-sm text-danger-ink">
          <p className="font-medium">No se puede publicar hasta resolver:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {results.blockingIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <WeeklyResultsTable
        rows={rows}
        activeKpis={activeKpis}
        presentParticipantCount={results.presentParticipantCount}
        showProfessionColumn={results.usesProfessions}
        weekLocation={results.location}
        isPreview
      />

      <FactionWeeklyPreviewTable rows={results.factionPreview.factions} />

      <div className="flex flex-wrap items-center gap-3">
        <Link href={backHref} className="rounded-control border border-border-strong px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted">
          Volver
        </Link>
        {results.blockingIssues.length === 0 && <PublishWeekButton splitId={split.id} weekId={week.id} />}
      </div>
    </div>
  );
}
