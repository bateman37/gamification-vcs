import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById, getSplitWeek } from "@/server/services/split.service";
import { listKpiConfigsForSplit } from "@/server/services/kpi.service";
import { getProductivityLoadStatus } from "@/server/services/productivity-import.service";
import { KPI_CATALOG_LIST } from "@/domain/kpis/catalog";
import { buildWeeklyLoadGroups } from "@/domain/kpis/loadGroups";
import { formatCalendarDate } from "@/lib/dates";
import { StatusIndicator } from "./StatusIndicator";

export default async function WeeklyKpisPage({
  params,
}: {
  params: { id: string; weekId: string };
}) {
  const split = await getSplitById(prisma, params.id);
  if (!split) notFound();
  const week = await getSplitWeek(prisma, params.id, params.weekId);
  if (!week) notFound();

  const kpiConfigs = await listKpiConfigsForSplit(prisma, split.id);
  const activeCatalogEntries = KPI_CATALOG_LIST.filter((entry) =>
    kpiConfigs.some((config) => config.kpiCode === entry.code && config.isActive),
  );
  const productivityStatus = await getProductivityLoadStatus(prisma, split.id, week.id, week.sequenceNumber);
  const groups = buildWeeklyLoadGroups(activeCatalogEntries, productivityStatus);

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
      </div>

      {activeCatalogEntries.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          Este split no tiene ningun KPI activo.
        </p>
      ) : (
        <ul className="space-y-3">
          {groups.map((group) => {
            const canLoad = group.implemented && split.status === "ACTIVE";
            const canCheck = group.implemented && group.status !== "PENDING";
            return (
              <li key={group.key} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">{group.title}</h2>
                    <p className="text-sm text-slate-600">{group.kpiNames.join(" y ")}</p>
                    {!group.implemented && (
                      <p className="mt-1 text-xs text-slate-500">Carga todavia no implementada.</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusIndicator status={group.status} />
                    <div className="flex gap-2">
                      {canLoad ? (
                        <Link
                          href={`/splits/${split.id}/weeks/${week.id}/kpis/productividad/cargar`}
                          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                        >
                          Cargar
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="rounded-md bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-400"
                        >
                          Cargar
                        </button>
                      )}
                      {canCheck ? (
                        <Link
                          href={`/splits/${split.id}/weeks/${week.id}/kpis/productividad/comprobar`}
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
    </div>
  );
}
