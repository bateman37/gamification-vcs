import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById, getSplitWeek } from "@/server/services/split.service";
import { getChronomancyCheckView } from "@/server/services/chronomancy-entry.service";
import { formatCalendarDate } from "@/lib/dates";
import { formatPoints } from "@/lib/format";
import type { WorkChronomancyOutcomeView } from "@/domain/kpis/chronomancy";
import { AVISO_LABEL } from "@/domain/kpi-load-status-display";
import { EmptyState } from "@/components/ui";

function formatOutcome(outcome: WorkChronomancyOutcomeView | null): string {
  if (!outcome) return "-";
  if (outcome.status === "not_applicable") return "No aplica";
  if (outcome.status === "no_data") return "Sin dato";
  if (outcome.status === "vac") return AVISO_LABEL;
  return formatPoints(outcome.finalPoints ?? 0);
}

function formatOccupancy(outcome: WorkChronomancyOutcomeView | null): string {
  if (!outcome) return "-";
  if (outcome.status === "vac") return "0 %";
  if (outcome.status !== "computed" || outcome.occupancy === undefined) return "-";
  return `${formatPoints(outcome.occupancy * 100)} %`;
}

export default async function ChronomancyCheckPage({ params }: { params: { id: string; weekId: string } }) {
  const split = await getSplitById(prisma, params.id);
  if (!split) notFound();
  const week = await getSplitWeek(prisma, params.id, params.weekId);
  if (!week) notFound();

  const view = await getChronomancyCheckView(prisma, params.id, week.id);
  const backHref = `/splits/${split.id}/weeks/${week.id}/kpis`;

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-slate-600 underline hover:text-slate-900">
          Volver a las cargas de la semana
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Comprobar Cronomagia laboral</h1>
        <p className="mt-1 text-sm text-slate-600">
          {split.name} - Semana {week.sequenceNumber} ({formatCalendarDate(week.startDate)} a{" "}
          {formatCalendarDate(week.endDate)})
        </p>
      </div>

      {view.rows.length === 0 ? (
        <EmptyState>No hay participantes aplicables en esta semana.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Alias</th>
                <th className="px-3 py-2 font-medium">Nombre real</th>
                <th className="px-3 py-2 font-medium">Nivel</th>
                <th className="px-3 py-2 font-medium">Horas productivas</th>
                <th className="px-3 py-2 font-medium">Horas totales</th>
                <th className="px-3 py-2 font-medium">Occupancy</th>
                {view.workChronomancyActive && <th className="px-3 py-2 font-medium">Cronomagia laboral</th>}
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row) => (
                <tr key={row.participantId} className="border-b border-slate-100">
                  <td className="px-3 py-2">{row.alias}</td>
                  <td className="px-3 py-2">{row.fullName}</td>
                  <td className="px-3 py-2">{row.level}</td>
                  <td className="px-3 py-2">{row.productiveHours ?? "Sin dato"}</td>
                  <td className="px-3 py-2">{row.totalHours ?? "Sin dato"}</td>
                  <td className="px-3 py-2">{formatOccupancy(row.workChronomancy)}</td>
                  {view.workChronomancyActive && <td className="px-3 py-2">{formatOutcome(row.workChronomancy)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {split.status === "ACTIVE" && (
        <Link
          href={`/splits/${split.id}/weeks/${week.id}/kpis/cronomagia/introducir`}
          className="block text-sm text-slate-600 underline hover:text-slate-900"
        >
          Actualizar datos
        </Link>
      )}
      <Link
        href={`/splits/${split.id}#kpi-configuracion`}
        className="block text-sm text-slate-600 underline hover:text-slate-900"
      >
        Ir a la configuracion de KPI
      </Link>
    </div>
  );
}
