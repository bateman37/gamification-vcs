import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById, getSplitWeek } from "@/server/services/split.service";
import { getEscalationCheckView } from "@/server/services/escalation-import.service";
import { formatCalendarDate } from "@/lib/dates";
import { formatPoints } from "@/lib/format";
import type { EscalationTamerOutcomeView } from "@/domain/kpis/escalation";
import { EmptyState } from "@/components/ui";

function formatOutcome(outcome: EscalationTamerOutcomeView | null): string {
  if (!outcome) return "-";
  if (outcome.status === "not_applicable") return "No aplica";
  if (outcome.status === "no_escalation_data") return "Sin dato de Escalados";
  if (outcome.status === "no_productivity_data") return "Falta Productividad";
  if (outcome.status === "zero_updates") return "No calculable: Actualizaciones es 0";
  return formatPoints(outcome.finalPoints ?? 0);
}

export default async function EscalationCheckPage({
  params,
}: {
  params: { id: string; weekId: string };
}) {
  const split = await getSplitById(prisma, params.id);
  if (!split) notFound();
  const week = await getSplitWeek(prisma, params.id, params.weekId);
  if (!week) notFound();

  const view = await getEscalationCheckView(prisma, params.id, week.id);
  const backHref = `/splits/${split.id}/weeks/${week.id}/kpis`;

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-slate-600 underline hover:text-slate-900">
          Volver a las cargas de la semana
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Comprobar Domador de Escaladas</h1>
        <p className="mt-1 text-sm text-slate-600">
          {split.name} - Semana {week.sequenceNumber} ({formatCalendarDate(week.startDate)} a{" "}
          {formatCalendarDate(week.endDate)})
        </p>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
        <p>
          Escalados: <span className="font-medium">{view.hasEscalationImport ? "cargado" : "pendiente"}</span>
          {!view.hasEscalationImport && (
            <>
              {" "}
              -{" "}
              <Link href={`/splits/${split.id}/weeks/${week.id}/kpis/escalados/cargar`} className="underline hover:text-slate-900">
                Cargar Escalados
              </Link>
            </>
          )}
        </p>
        <p>
          Productividad: <span className="font-medium">{view.hasProductivityImport ? "cargado" : "pendiente"}</span>
          {!view.hasProductivityImport && (
            <>
              {" "}
              -{" "}
              <Link
                href={`/splits/${split.id}/weeks/${week.id}/kpis/productividad/cargar`}
                className="underline hover:text-slate-900"
              >
                Cargar Productividad
              </Link>
            </>
          )}
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
                <th className="px-3 py-2 font-medium">Reasignaciones de grupo</th>
                <th className="px-3 py-2 font-medium">Actualizaciones</th>
                {view.escalationTamerActive && <th className="px-3 py-2 font-medium">Domador de Escaladas</th>}
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row) => (
                <tr key={row.participantId} className="border-b border-slate-100">
                  <td className="px-3 py-2">{row.alias}</td>
                  <td className="px-3 py-2">{row.fullName}</td>
                  <td className="px-3 py-2">{row.level}</td>
                  <td className="px-3 py-2">{row.groupReassignments ?? "Sin dato"}</td>
                  <td className="px-3 py-2">{row.updates ?? "Sin dato"}</td>
                  {view.escalationTamerActive && <td className="px-3 py-2">{formatOutcome(row.escalationTamer)}</td>}
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
