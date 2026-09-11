import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById, listSplitWeeks } from "@/server/services/split.service";
import { listParticipantsForSplit } from "@/server/services/participant.service";
import { listAllPersons } from "@/server/services/person.service";
import { listKpiConfigsForSplit } from "@/server/services/kpi.service";
import { listPositionPointRules } from "@/server/services/position-points.service";
import { getWeeklyKpiLoadSummary } from "@/server/services/kpi-load-summary.service";
import { computeSplitClassification } from "@/server/services/classification.service";
import { listFactionsForSplit } from "@/server/services/faction.service";
import { computeFactionClassification } from "@/server/services/faction-classification.service";
import { requireAdminSession } from "@/lib/session";
import { TOTAL_KPI_COUNT } from "@/domain/kpis/catalog";
import { formatCalendarDate } from "@/lib/dates";
import { Badge, EmptyState } from "@/components/ui";
import { SPLIT_STATUS_LABELS } from "@/lib/labels";
import { EditSplitDraftForm } from "./EditSplitDraftForm";
import { ActivateSplitButton } from "./ActivateSplitButton";
import { AddParticipantForm } from "./AddParticipantForm";
import { ParticipantEditRow } from "./ParticipantEditRow";
import { KpiConfigSection } from "./KpiConfigSection";
import { PositionPointsSection } from "./PositionPointsSection";
import { SplitDetailNav, type SplitDetailNavItem } from "./SplitDetailNav";
import { WeekKpiLoadCell } from "./WeekKpiLoadCell";
import { WeekKpiLoadedCount } from "./WeekKpiLoadedCount";
import { WeekResultsCell } from "./WeekResultsCell";
import { ClassificationSummarySection } from "./ClassificationSummarySection";
import { FactionsSection } from "./FactionsSection";
import { FactionClassificationSummarySection } from "./FactionClassificationSummarySection";

const STATUS_TONE: Record<string, "slate" | "green" | "gray"> = {
  DRAFT: "slate",
  ACTIVE: "green",
  CLOSED: "gray",
};

export default async function SplitDetailPage({ params }: { params: { id: string } }) {
  await requireAdminSession();
  const split = await getSplitById(prisma, params.id);
  if (!split) {
    notFound();
  }

  const [weeks, participants, people, kpiConfigs, positionPointRules, factions] = await Promise.all([
    listSplitWeeks(prisma, split.id),
    listParticipantsForSplit(prisma, split.id),
    listAllPersons(prisma),
    listKpiConfigsForSplit(prisma, split.id),
    listPositionPointRules(prisma, split.id),
    listFactionsForSplit(prisma, split.id),
  ]);
  const [kpiLoadSummaries, publications, classification, factionClassification] = await Promise.all([
    getWeeklyKpiLoadSummary(prisma, split.id, weeks),
    prisma.weekPublication.findMany({ where: { splitWeekId: { in: weeks.map((week) => week.id) } } }),
    computeSplitClassification(prisma, split.id),
    computeFactionClassification(prisma, split.id),
  ]);
  const publishedAtByWeekId = new Map(publications.map((publication) => [publication.splitWeekId, publication.publishedAt]));
  const hasAnyPublication = publications.length > 0;

  const participatingPersonIds = new Set(participants.map((participant) => participant.personId));
  const availablePeople = people.filter((person) => !participatingPersonIds.has(person.id));

  const activeKpiCount = kpiConfigs.filter((config) => config.isActive).length;
  const canActivate = split.status === "DRAFT" && participants.length > 0 && activeKpiCount > 0;
  const showAddParticipant = split.status !== "CLOSED";

  const navItems: SplitDetailNavItem[] = [
    { href: "#resumen", label: "Resumen" },
    { href: "#calendario-semanas", label: "Calendario de semanas" },
    { href: "#clasificacion-general-individual", label: "Clasificacion general individual" },
    { href: "#clasificacion-general-facciones", label: "Clasificacion general facciones" },
    { href: "#facciones", label: "Facciones" },
    { href: "#participantes", label: "Participantes" },
    ...(showAddParticipant ? [{ href: "#anadir-participante", label: "Anadir participante" }] : []),
    { href: "#kpi-configuracion", label: "KPI del split" },
    { href: "#puntos-posicion", label: "Puntos por posicion semanal" },
    ...(split.status === "DRAFT" ? [{ href: "#editar-split", label: "Editar split" }] : []),
  ];

  return (
    <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      <SplitDetailNav items={navItems} />

      <div className="space-y-8 lg:min-w-0">
        <div id="resumen" className="scroll-mt-6">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{split.name}</h1>
            <Badge tone={STATUS_TONE[split.status]}>{SPLIT_STATUS_LABELS[split.status]}</Badge>
          </div>
          {split.description && <p className="mt-1 text-sm text-slate-600">{split.description}</p>}
          <p className="mt-1 text-sm text-slate-600">
            Inicio: {formatCalendarDate(split.startDate)} - {split.numberOfWeeks} semanas
          </p>
          <p className="mt-2 text-sm text-slate-600">
            KPI activos: {activeKpiCount} de {TOTAL_KPI_COUNT}.{" "}
            <a href="#kpi-configuracion" className="underline hover:text-slate-900">
              Ir a la configuracion de KPI
            </a>
          </p>
          {activeKpiCount === 0 && (
            <p className="mt-1 text-sm text-amber-700">
              Este split no tiene ningun KPI activo. Configura al menos uno en la seccion &quot;KPI del
              split&quot;.
            </p>
          )}

          {split.status === "DRAFT" && (
            <div className="mt-4">
              {canActivate ? (
                <ActivateSplitButton splitId={split.id} />
              ) : (
                <p className="text-sm text-slate-500">
                  {participants.length === 0 && activeKpiCount === 0
                    ? "Anade al menos un participante y activa al menos un KPI para poder activar el split."
                    : participants.length === 0
                      ? "Anade al menos un participante para poder activar el split."
                      : "Activa al menos un KPI para poder activar el split."}
                </p>
              )}
            </div>
          )}
        </div>

        <section id="calendario-semanas" className="scroll-mt-6 space-y-3">
          <h2 className="text-lg font-semibold">Calendario de semanas</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Semana</th>
                  <th className="px-3 py-2 font-medium">Inicio</th>
                  <th className="px-3 py-2 font-medium">Fin</th>
                  <th className="px-3 py-2 font-medium">KPI cargados</th>
                  <th className="px-3 py-2 font-medium">Carga de KPI</th>
                  <th className="px-3 py-2 font-medium">Resultados</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => {
                  const summary = kpiLoadSummaries.get(week.id) ?? { loadedCount: 0, totalActiveCount: 0 };
                  const publishedAt = publishedAtByWeekId.get(week.id) ?? null;
                  return (
                    <tr key={week.id} className={`border-b border-slate-100 ${publishedAt ? "bg-sky-50/60" : ""}`}>
                      <td className="px-3 py-2">{week.sequenceNumber}</td>
                      <td className="px-3 py-2">{formatCalendarDate(week.startDate)}</td>
                      <td className="px-3 py-2">{formatCalendarDate(week.endDate)}</td>
                      <td className="px-3 py-2">
                        <WeekKpiLoadedCount summary={summary} />
                      </td>
                      <td className="px-3 py-2">
                        <WeekKpiLoadCell splitId={split.id} splitStatus={split.status} week={week} />
                      </td>
                      <td className="px-3 py-2">
                        <WeekResultsCell splitId={split.id} weekId={week.id} summary={summary} publishedAt={publishedAt} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <ClassificationSummarySection splitId={split.id} classification={classification} />

        <FactionClassificationSummarySection splitId={split.id} classification={factionClassification} />

        <FactionsSection splitId={split.id} splitStatus={split.status} factions={factions} hasAnyPublication={hasAnyPublication} />

        <section id="participantes" className="scroll-mt-6 space-y-3">
          <h2 className="text-lg font-semibold">Participantes</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Persona</th>
                  <th className="px-3 py-2 font-medium">Alias</th>
                  <th className="px-3 py-2 font-medium">Nivel</th>
                  <th className="px-3 py-2 font-medium">Faccion</th>
                  <th className="px-3 py-2 text-center font-medium">Semana inicial</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {participants.map((participant) => (
                  <ParticipantEditRow key={participant.id} splitId={split.id} participant={participant} factions={factions} />
                ))}
              </tbody>
            </table>
            {participants.length === 0 && (
              <div className="p-4">
                <EmptyState>Todavia no hay participantes en este split.</EmptyState>
              </div>
            )}
          </div>

          {showAddParticipant && (
            <div id="anadir-participante" className="scroll-mt-6">
              <AddParticipantForm
                splitId={split.id}
                people={availablePeople}
                weeks={weeks}
                splitStatus={split.status}
                factions={factions}
              />
            </div>
          )}
        </section>

        <KpiConfigSection splitId={split.id} splitStatus={split.status} kpiConfigs={kpiConfigs} locked={hasAnyPublication} />

        <PositionPointsSection splitId={split.id} splitStatus={split.status} rules={positionPointRules} locked={hasAnyPublication} />

        {split.status === "DRAFT" && (
          <section id="editar-split" className="scroll-mt-6 space-y-3">
            <h2 className="text-lg font-semibold">Editar split</h2>
            <EditSplitDraftForm split={split} />
          </section>
        )}
      </div>
    </div>
  );
}
