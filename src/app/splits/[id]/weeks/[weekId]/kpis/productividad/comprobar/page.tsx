import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById, getSplitWeek } from "@/server/services/split.service";
import { getProductivityCheckView } from "@/server/services/productivity-import.service";
import { formatCalendarDate } from "@/lib/dates";
import { formatPoints } from "@/lib/format";
import type { ProductivityKpiOutcomeView } from "@/domain/kpis/productivity";
import { EmptyState } from "@/components/ui";

function formatOutcome(outcome: ProductivityKpiOutcomeView | null): string {
  if (!outcome) return "-";
  if (outcome.status === "not_applicable") return "No aplica";
  if (outcome.status === "no_data") return "Sin dato";
  return formatPoints(outcome.finalPoints ?? 0);
}

export default async function ProductivityCheckPage({
  params,
}: {
  params: { id: string; weekId: string };
}) {
  const split = await getSplitById(prisma, params.id);
  if (!split) notFound();
  const week = await getSplitWeek(prisma, params.id, params.weekId);
  if (!week) notFound();

  const view = await getProductivityCheckView(prisma, params.id, week.id);
  const backHref = `/splits/${split.id}/weeks/${week.id}/kpis`;

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-slate-600 underline hover:text-slate-900">
          Volver a las cargas de la semana
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Comprobar Productividad</h1>
        <p className="mt-1 text-sm text-slate-600">
          {split.name} - Semana {week.sequenceNumber} ({formatCalendarDate(week.startDate)} a{" "}
          {formatCalendarDate(week.endDate)})
        </p>
      </div>

      {view.hasImport && (
        <p className="text-sm text-slate-600">
          Archivo vigente: {view.originalFilename} - cargado el{" "}
          {view.createdAt ? new Date(view.createdAt).toLocaleString("es-ES") : "-"} - {view.sourceRowCount} filas
          fuente, {view.importedRowCount} filas cargadas.
        </p>
      )}

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
                {view.solutionHunterActive && (
                  <>
                    <th className="px-3 py-2 font-medium">Tickets resueltos</th>
                    <th className="px-3 py-2 font-medium">Cazador de soluciones</th>
                  </>
                )}
                {view.dataExplorerActive && (
                  <>
                    <th className="px-3 py-2 font-medium">Tickets con comentario</th>
                    <th className="px-3 py-2 font-medium">Explorador de datos</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row) => (
                <tr key={row.participantId} className="border-b border-slate-100">
                  <td className="px-3 py-2">{row.alias}</td>
                  <td className="px-3 py-2">{row.fullName}</td>
                  <td className="px-3 py-2">{row.level}</td>
                  {view.solutionHunterActive && (
                    <>
                      <td className="px-3 py-2">{row.ticketsResolved ?? "Sin dato"}</td>
                      <td className="px-3 py-2">{formatOutcome(row.solutionHunter)}</td>
                    </>
                  )}
                  {view.dataExplorerActive && (
                    <>
                      <td className="px-3 py-2">{row.ticketsUpdatedWithComment ?? "Sin dato"}</td>
                      <td className="px-3 py-2">{formatOutcome(row.dataExplorer)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link
        href={`/splits/${split.id}#kpi-configuracion`}
        className="inline-block text-sm text-slate-600 underline hover:text-slate-900"
      >
        Ir a la configuracion de KPI
      </Link>
    </div>
  );
}
