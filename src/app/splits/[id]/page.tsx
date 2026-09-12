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
import { listProfessionsForSplit } from "@/server/services/profession.service";
import { toProfessionView } from "@/domain/profession-display";
import { computeFactionClassification } from "@/server/services/faction-classification.service";
import { listWeekLocationsForSplit } from "@/server/services/location.service";
import { resolveWeekLocationWindow, findNextWeek } from "@/domain/location-window";
import { getEconomySettings } from "@/server/services/economy.service";
import { listEquipmentSlotsForSplit } from "@/server/services/equipment-slot.service";
import { listStoreItemsForSplit } from "@/server/services/store-item.service";
import { requireAdminSession } from "@/lib/session";
import { TOTAL_KPI_COUNT } from "@/domain/kpis/catalog";
import { formatCalendarDate, currentCalendarDate } from "@/lib/dates";
import { Badge, EmptyState } from "@/components/ui";
import { SPLIT_STATUS_LABELS } from "@/lib/labels";
import { EditSplitDraftForm } from "./EditSplitDraftForm";
import { ActivateSplitButton } from "./ActivateSplitButton";
import { AddParticipantForm } from "./AddParticipantForm";
import { ParticipantEditRow } from "./ParticipantEditRow";
import { KpiConfigSection } from "./KpiConfigSection";
import { PositionPointsSection } from "./PositionPointsSection";
import { SplitDetailNav, type SplitDetailNavItem } from "./SplitDetailNav";
import { SplitDetailMobileNav } from "./SplitDetailMobileNav";
import { WeekKpiLoadCell } from "./WeekKpiLoadCell";
import { WeekKpiLoadedCount } from "./WeekKpiLoadedCount";
import { WeekResultsCell } from "./WeekResultsCell";
import { WeekLocationCell } from "./WeekLocationCell";
import { ClassificationSummarySection } from "./ClassificationSummarySection";
import { FactionsSection } from "./FactionsSection";
import { FactionClassificationSummarySection } from "./FactionClassificationSummarySection";
import { ProfessionsSection } from "./ProfessionsSection";
import { EconomySummarySection } from "./EconomySummarySection";
import { PresentationLaunchSection } from "./PresentationLaunchSection";

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

  const [weeks, participants, people, kpiConfigs, positionPointRules, factions, professions, weekLocations, economySettings, equipmentSlots, storeItems] =
    await Promise.all([
      listSplitWeeks(prisma, split.id),
      listParticipantsForSplit(prisma, split.id),
      listAllPersons(prisma),
      listKpiConfigsForSplit(prisma, split.id),
      listPositionPointRules(prisma, split.id),
      listFactionsForSplit(prisma, split.id),
      listProfessionsForSplit(prisma, split.id),
      listWeekLocationsForSplit(prisma, split.id),
      getEconomySettings(prisma, split.id),
      listEquipmentSlotsForSplit(prisma, split.id),
      listStoreItemsForSplit(prisma, split.id),
    ]);
  const [kpiLoadSummaries, publications, classification, factionClassification] = await Promise.all([
    getWeeklyKpiLoadSummary(prisma, split.id, weeks),
    prisma.weekPublication.findMany({ where: { splitWeekId: { in: weeks.map((week) => week.id) } } }),
    computeSplitClassification(prisma, split.id),
    computeFactionClassification(prisma, split.id),
  ]);
  const publishedAtByWeekId = new Map(publications.map((publication) => [publication.splitWeekId, publication.publishedAt]));
  const hasAnyPublication = publications.length > 0;

  const now = currentCalendarDate();
  const locationByWeekId = new Map(weekLocations.map((location) => [location.splitWeekId, location]));
  const nextWeek = findNextWeek(weeks, now);

  const participatingPersonIds = new Set(participants.map((participant) => participant.personId));
  const availablePeople = people.filter((person) => !participatingPersonIds.has(person.id));

  const professionViews = professions.map(toProfessionView);
  const activeKpiCount = kpiConfigs.filter((config) => config.isActive).length;
  const canActivate = split.status === "DRAFT" && participants.length > 0 && activeKpiCount > 0;
  const showAddParticipant = split.status !== "CLOSED";

  const navItems: SplitDetailNavItem[] = [
    { href: "#resumen", label: "Resumen", icon: "ClipboardList" },
    { href: "#calendario-semanas", label: "Calendario de semanas", icon: "Calendar" },
    { href: "#clasificacion-general-individual", label: "Clasificación general individual", icon: "Trophy" },
    { href: "#clasificacion-general-facciones", label: "Clasificación general facciones", icon: "Award" },
    { href: "#facciones", label: "Facciones", icon: "Flag" },
    { href: "#profesiones", label: "Profesiones", icon: "Briefcase" },
    { href: "#economia", label: "Economía y mercado", icon: "Store" },
    { href: "#participantes", label: "Participantes", icon: "Users" },
    ...(showAddParticipant ? [{ href: "#anadir-participante", label: "Anadir participante", icon: "UserPlus" }] : []),
    { href: "#kpi-configuracion", label: "KPI del split", icon: "SlidersHorizontal" },
    { href: "#puntos-posicion", label: "Puntos por posicion semanal", icon: "ListOrdered" },
    ...(split.status === "DRAFT" ? [{ href: "#editar-split", label: "Editar split", icon: "Settings" }] : []),
  ];

  return (
    <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      <SplitDetailNav items={navItems} />

      <div className="space-y-8 lg:min-w-0">
        <SplitDetailMobileNav items={navItems} />
        <div id="resumen" className="scroll-mt-20">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{split.name}</h1>
            <Badge tone={STATUS_TONE[split.status]}>{SPLIT_STATUS_LABELS[split.status]}</Badge>
          </div>
          {split.description && <p className="mt-1 text-sm text-text-muted">{split.description}</p>}
          <p className="mt-1 text-sm text-text-muted">
            Inicio: {formatCalendarDate(split.startDate)} - {split.numberOfWeeks} semanas
          </p>
          <p className="mt-2 text-sm text-text-muted">
            KPI activos: {activeKpiCount} de {TOTAL_KPI_COUNT}.{" "}
            <a href="#kpi-configuracion" className="underline hover:text-ink">
              Ir a la configuracion de KPI
            </a>
          </p>
          {activeKpiCount === 0 && (
            <p className="mt-1 text-sm text-reward-ink">
              Este split no tiene ningun KPI activo. Configura al menos uno en la seccion &quot;KPI del
              split&quot;.
            </p>
          )}

          {split.status === "DRAFT" && (
            <div className="mt-4">
              {canActivate ? (
                <ActivateSplitButton splitId={split.id} />
              ) : (
                <p className="text-sm text-text-muted">
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

        <section id="calendario-semanas" className="scroll-mt-20 space-y-3">
          <h2 className="text-lg font-semibold">Calendario de semanas</h2>
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-canvas text-text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Semana</th>
                  <th className="px-3 py-2 font-medium">Inicio</th>
                  <th className="px-3 py-2 font-medium">Fin</th>
                  <th className="px-3 py-2 font-medium">KPI cargados</th>
                  <th className="px-3 py-2 font-medium">Carga de KPI</th>
                  <th className="px-3 py-2 font-medium">Localización</th>
                  <th className="px-3 py-2 font-medium">Resultados</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => {
                  const summary = kpiLoadSummaries.get(week.id) ?? { loadedCount: 0, totalActiveCount: 0 };
                  const publishedAt = publishedAtByWeekId.get(week.id) ?? null;
                  const location = locationByWeekId.get(week.id) ?? null;
                  const locationWindow = resolveWeekLocationWindow(now, week, publishedAt !== null);
                  return (
                    <tr key={week.id} className={`border-b border-border ${publishedAt ? "bg-success-soft/60" : ""}`}>
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
                        <WeekLocationCell
                          splitId={split.id}
                          weekId={week.id}
                          location={location}
                          status={locationWindow.status}
                          editable={locationWindow.editable && split.status !== "CLOSED"}
                          isNextWeek={nextWeek?.id === week.id}
                        />
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

        <PresentationLaunchSection splitId={split.id} weeks={weeks} publishedAtByWeekId={publishedAtByWeekId} />

        <ClassificationSummarySection splitId={split.id} classification={classification} />

        <FactionClassificationSummarySection splitId={split.id} classification={factionClassification} />

        <FactionsSection splitId={split.id} splitStatus={split.status} factions={factions} hasAnyPublication={hasAnyPublication} />

        <ProfessionsSection
          splitId={split.id}
          splitStatus={split.status}
          professions={professions}
          hasAnyPublication={hasAnyPublication}
        />

        <EconomySummarySection
          splitId={split.id}
          marketStatus={economySettings.marketStatus}
          slotCount={equipmentSlots.length}
          itemCount={storeItems.length}
        />

        <section id="participantes" className="scroll-mt-20 space-y-3">
          <h2 className="text-lg font-semibold">Participantes</h2>
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-canvas text-text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Persona</th>
                  <th className="px-3 py-2 font-medium">Alias</th>
                  <th className="px-3 py-2 font-medium">Nivel</th>
                  <th className="px-3 py-2 font-medium">Facción</th>
                  <th className="px-3 py-2 font-medium">Profesión</th>
                  <th className="px-3 py-2 text-center font-medium">Semana inicial</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {participants.map((participant) => (
                  <ParticipantEditRow
                    key={participant.id}
                    splitId={split.id}
                    participant={{
                      ...participant,
                      profession: participant.profession ? toProfessionView(participant.profession) : null,
                    }}
                    factions={factions}
                    professions={professionViews}
                    professionLocked={hasAnyPublication}
                  />
                ))}
              </tbody>
            </table>
            {participants.length === 0 && (
              <div className="p-4">
                <EmptyState>Todavía no hay participantes en este split.</EmptyState>
              </div>
            )}
          </div>

          {showAddParticipant && (
            <div id="anadir-participante" className="scroll-mt-20">
              <AddParticipantForm
                splitId={split.id}
                people={availablePeople}
                weeks={weeks}
                splitStatus={split.status}
                factions={factions}
                professions={professionViews}
                professionRequired={hasAnyPublication && professionViews.length > 0}
              />
            </div>
          )}
        </section>

        <KpiConfigSection splitId={split.id} splitStatus={split.status} kpiConfigs={kpiConfigs} locked={hasAnyPublication} />

        <PositionPointsSection splitId={split.id} splitStatus={split.status} rules={positionPointRules} locked={hasAnyPublication} />

        {split.status === "DRAFT" && (
          <section id="editar-split" className="scroll-mt-20 space-y-3">
            <h2 className="text-lg font-semibold">Editar split</h2>
            <EditSplitDraftForm split={split} />
          </section>
        )}
      </div>
    </div>
  );
}
