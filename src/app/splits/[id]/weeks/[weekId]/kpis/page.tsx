import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById, getSplitWeek } from "@/server/services/split.service";
import { listKpiConfigsForSplit } from "@/server/services/kpi.service";
import { getProductivityLoadStatus } from "@/server/services/productivity-import.service";
import { getEscalationLoadStatus } from "@/server/services/escalation-import.service";
import { getQualityLoadStatus } from "@/server/services/quality-import.service";
import { getVoiceLoadStatus } from "@/server/services/voice-import.service";
import { getStabilityLoadStatus } from "@/server/services/stability-entry.service";
import { getChronomancyLoadStatus } from "@/server/services/chronomancy-entry.service";
import { getWriterLoadStatus } from "@/server/services/writer-entry.service";
import { getStudentLoadStatus } from "@/server/services/student-entry.service";
import { getApprenticeLoadStatus } from "@/server/services/apprentice-entry.service";
import { KPI_CATALOG_LIST, KPI_CATALOG } from "@/domain/kpis/catalog";
import { buildWeeklyLoadGroups, type LoadCoverageStatus, type LoadOrigin } from "@/domain/kpis/loadGroups";
import { getWeeklyKpiLoadSummary } from "@/server/services/kpi-load-summary.service";
import { getWeekLocation } from "@/server/services/location.service";
import { locationBonusLabel } from "@/domain/location-bonus";
import { requireAdminSession } from "@/lib/session";
import { formatCalendarDate } from "@/lib/dates";
import { Badge } from "@/components/ui";
import { StatusIndicator } from "./StatusIndicator";

const LOCATION_STATUS_LABEL: Record<string, string> = {
  PROXIMA: "Proxima",
  ACTIVA: "Activa",
  FINALIZADA: "Finalizada",
  PUBLICADA: "Publicada",
};

const LOCATION_STATUS_TONE: Record<string, "slate" | "green" | "gray"> = {
  PROXIMA: "slate",
  ACTIVA: "green",
  FINALIZADA: "gray",
  PUBLICADA: "gray",
};

export default async function WeeklyKpisPage({
  params,
}: {
  params: { id: string; weekId: string };
}) {
  await requireAdminSession();
  const split = await getSplitById(prisma, params.id);
  if (!split) notFound();
  const week = await getSplitWeek(prisma, params.id, params.weekId);
  if (!week) notFound();

  const [loadSummaryByWeek, publication, { location, window: locationWindow }] = await Promise.all([
    getWeeklyKpiLoadSummary(prisma, split.id, [week]),
    prisma.weekPublication.findUnique({ where: { splitWeekId: week.id } }),
    getWeekLocation(prisma, split.id, week.id),
  ]);
  const loadSummary = loadSummaryByWeek.get(week.id) ?? { loadedCount: 0, totalActiveCount: 0 };
  const isWeekComplete = loadSummary.totalActiveCount > 0 && loadSummary.loadedCount === loadSummary.totalActiveCount;
  const resultsHref = `/splits/${split.id}/weeks/${week.id}/resultados`;

  const kpiConfigs = await listKpiConfigsForSplit(prisma, split.id);
  const activeCatalogEntries = KPI_CATALOG_LIST.filter((entry) =>
    kpiConfigs.some((config) => config.kpiCode === entry.code && config.isActive),
  );
  const activeCodes = new Set(activeCatalogEntries.map((entry) => entry.code));

  const coverageByOrigin: Partial<Record<LoadOrigin, LoadCoverageStatus>> = {};
  if (activeCodes.has("SOLUTION_HUNTER") || activeCodes.has("DATA_EXPLORER")) {
    coverageByOrigin.PRODUCTIVITY = await getProductivityLoadStatus(prisma, split.id, week.id, week.sequenceNumber);
  }
  if (activeCodes.has("ESCALATION_TAMER")) {
    coverageByOrigin.ESCALATION_TAMER = await getEscalationLoadStatus(prisma, split.id, week.id, week.sequenceNumber);
  }
  if (activeCodes.has("MASTER_CRAFTSMAN")) {
    coverageByOrigin.MASTER_CRAFTSMAN = await getQualityLoadStatus(prisma, split.id, week.id, week.sequenceNumber);
  }
  if (activeCodes.has("VOICE_AMBASSADOR")) {
    coverageByOrigin.VOICE_AMBASSADOR = await getVoiceLoadStatus(prisma, split.id, week.id, week.sequenceNumber);
  }
  if (activeCodes.has("STABILITY_GUARDIAN")) {
    coverageByOrigin.STABILITY_GUARDIAN = await getStabilityLoadStatus(prisma, split.id, week.id, week.sequenceNumber);
  }
  if (activeCodes.has("WORK_CHRONOMANCY")) {
    coverageByOrigin.WORK_CHRONOMANCY = await getChronomancyLoadStatus(prisma, split.id, week.id, week.sequenceNumber);
  }
  if (activeCodes.has("STAR_WRITER")) {
    coverageByOrigin.STAR_WRITER = await getWriterLoadStatus(prisma, split.id, week.id, week.sequenceNumber);
  }
  if (activeCodes.has("ENTHUSIASTIC_STUDENT")) {
    coverageByOrigin.ENTHUSIASTIC_STUDENT = await getStudentLoadStatus(prisma, split.id, week.id, week.sequenceNumber);
  }
  if (activeCodes.has("EXPERT_APPRENTICE")) {
    coverageByOrigin.EXPERT_APPRENTICE = await getApprenticeLoadStatus(prisma, split.id, week.id, week.sequenceNumber);
  }

  // Domador de Escaladas depende de Productividad aunque Cazador de soluciones y
  // Explorador de datos esten inactivos (ver docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md).
  const productivityImportExists = activeCodes.has("ESCALATION_TAMER")
    ? (await prisma.productivityImport.findUnique({ where: { splitWeekId: week.id } })) !== null
    : false;

  const groups = buildWeeklyLoadGroups(activeCatalogEntries, coverageByOrigin);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/splits/${split.id}`} className="text-sm text-slate-600 underline hover:text-slate-900">
          Volver al split
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{split.name}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Semana {week.sequenceNumber} - {formatCalendarDate(week.startDate)} a {formatCalendarDate(week.endDate)}
        </p>
        {split.status === "DRAFT" && (
          <p className="mt-2 text-sm text-amber-700">Activa el split para introducir KPI.</p>
        )}
        {split.status === "CLOSED" && (
          <p className="mt-2 text-sm text-slate-500">El split esta cerrado: solo puedes consultar los KPI.</p>
        )}
        {publication && (
          <p className="mt-2 text-sm font-medium text-sky-700">
            Semana publicada: los datos estan bloqueados y no se pueden modificar.
          </p>
        )}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {location ? (
              <>
                <p className="text-sm font-semibold text-slate-800">{location.name}</p>
                <p className="text-sm text-slate-600">
                  Potencia: {KPI_CATALOG[location.kpiCode].name} · {locationBonusLabel(location.bonusPercent)}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">Esta semana no tiene localizacion.</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={LOCATION_STATUS_TONE[locationWindow.status]}>{LOCATION_STATUS_LABEL[locationWindow.status]}</Badge>
            {locationWindow.editable && (
              <Link
                href={`/splits/${split.id}/weeks/${week.id}/localizacion`}
                className="text-sm font-medium text-slate-700 underline hover:text-slate-900"
              >
                {location ? "Editar" : "Configurar"}
              </Link>
            )}
            {!locationWindow.editable && location && (
              <Link
                href={`/splits/${split.id}/weeks/${week.id}/localizacion`}
                className="text-sm text-slate-600 underline hover:text-slate-900"
              >
                Ver
              </Link>
            )}
          </div>
        </div>
      </section>

      {activeCatalogEntries.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          Este split no tiene ningun KPI activo.
        </p>
      ) : (
        <ul className="space-y-3">
          {groups.map((group) => {
            const canLoad = group.implemented && split.status === "ACTIVE" && !publication;
            const canCheck = group.implemented && group.status !== "PENDING";
            const loadAction = group.mode === "MANUAL" ? "introducir" : "cargar";
            const loadLabel = group.mode === "MANUAL" ? "Introducir datos" : "Cargar";
            const loadHref = group.routeSlug ? `/splits/${split.id}/weeks/${week.id}/kpis/${group.routeSlug}/${loadAction}` : "#";
            const checkHref = group.routeSlug ? `/splits/${split.id}/weeks/${week.id}/kpis/${group.routeSlug}/comprobar` : "#";
            return (
              <li key={group.key} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">{group.title}</h2>
                    <p className="text-sm text-slate-600">{group.kpiNames.join(" y ")}</p>
                    {!group.implemented && (
                      <p className="mt-1 text-xs text-slate-500">Carga todavia no implementada.</p>
                    )}
                    {group.key === "ESCALATION_TAMER" && !productivityImportExists && (
                      <p className="mt-1 text-xs text-amber-700">
                        Falta Productividad de esta semana.{" "}
                        <Link
                          href={`/splits/${split.id}/weeks/${week.id}/kpis/productividad/cargar`}
                          className="underline hover:text-amber-900"
                        >
                          Cargar Productividad
                        </Link>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusIndicator status={group.status} vacCount={group.vacCount} />
                    <div className="flex gap-2">
                      {canLoad ? (
                        <Link
                          href={loadHref}
                          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                        >
                          {loadLabel}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="rounded-md bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-400"
                        >
                          {loadLabel}
                        </button>
                      )}
                      {canCheck ? (
                        <Link
                          href={checkHref}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Comprobar
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-400"
                        >
                          Comprobar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {activeCatalogEntries.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-700">
              KPI cargados: {loadSummary.loadedCount}/{loadSummary.totalActiveCount}
            </p>
            {publication ? (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">Semana publicada</span>
                <Link href={resultsHref} className="text-sm font-medium text-slate-700 underline hover:text-slate-900">
                  Ver resultados
                </Link>
              </div>
            ) : isWeekComplete ? (
              <Link
                href={resultsHref}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Ver resultados de la semana
              </Link>
            ) : (
              <div className="text-right">
                <button type="button" disabled className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-400">
                  Ver resultados de la semana
                </button>
                <p className="mt-1 text-xs text-slate-500">
                  Completa los {loadSummary.totalActiveCount} KPI activos para poder ver los resultados.
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
