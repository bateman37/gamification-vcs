import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById, getSplitWeek } from "@/server/services/split.service";
import { listKpiConfigsForSplit } from "@/server/services/kpi.service";
import { getWeekLocation } from "@/server/services/location.service";
import { KPI_CATALOG } from "@/domain/kpis/catalog";
import { requireAdminSession } from "@/lib/session";
import { formatCalendarDateEs } from "@/lib/dates";
import { locationBonusLabel } from "@/domain/location-bonus";
import { Badge } from "@/components/ui";
import { WeekLocationForm } from "./WeekLocationForm";

const STATUS_LABEL: Record<string, string> = {
  PROXIMA: "Proxima",
  ACTIVA: "Activa",
  FINALIZADA: "Finalizada",
  PUBLICADA: "Publicada",
};

const STATUS_TONE: Record<string, "slate" | "green" | "gray" | "amber"> = {
  PROXIMA: "slate",
  ACTIVA: "green",
  FINALIZADA: "gray",
  PUBLICADA: "gray",
};

export default async function WeekLocationPage({ params }: { params: { id: string; weekId: string } }) {
  await requireAdminSession();
  const split = await getSplitById(prisma, params.id);
  if (!split) notFound();
  const week = await getSplitWeek(prisma, params.id, params.weekId);
  if (!week) notFound();

  const [{ location, window }, kpiConfigs] = await Promise.all([
    getWeekLocation(prisma, split.id, week.id),
    listKpiConfigsForSplit(prisma, split.id),
  ]);

  const activeKpis = kpiConfigs
    .filter((config) => config.isActive)
    .map((config) => ({ code: config.kpiCode, name: KPI_CATALOG[config.kpiCode].name }));

  const backHref = `/splits/${split.id}`;
  const editable = window.editable && split.status !== "CLOSED";

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-slate-600 underline hover:text-slate-900">
          Volver al split
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Localizacion de la semana {week.sequenceNumber}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {split.name} · {formatCalendarDateEs(week.startDate)} — {formatCalendarDateEs(week.endDate)}
        </p>
        <div className="mt-2">
          <Badge tone={STATUS_TONE[window.status]}>{STATUS_LABEL[window.status]}</Badge>
        </div>
      </div>

      {editable ? (
        <WeekLocationForm
          splitId={split.id}
          weekId={week.id}
          weekStartDate={week.startDate}
          weekEndDate={week.endDate}
          activeKpis={activeKpis}
          initialLocation={location}
        />
      ) : (
        <div className="max-w-lg space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          {location ? (
            <>
              <p className="text-base font-semibold">{location.name}</p>
              <p className="text-slate-600">Potencia: {KPI_CATALOG[location.kpiCode].name}</p>
              <p className="text-slate-600">Bonus para todos los participantes: {locationBonusLabel(location.bonusPercent)}</p>
            </>
          ) : (
            <p className="text-slate-500">Esta semana no tiene localizacion.</p>
          )}
          <p className="text-xs text-slate-500">
            {window.status === "PUBLICADA"
              ? "Esta semana ya esta publicada: su localizacion es de solo lectura."
              : split.status === "CLOSED"
                ? "Este split esta cerrado: su localizacion es de solo lectura."
                : "Esta semana ya ha comenzado: su localizacion ya no se puede crear, editar ni eliminar."}
          </p>
        </div>
      )}
    </div>
  );
}
