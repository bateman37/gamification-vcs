import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById, getSplitWeek } from "@/server/services/split.service";
import { getEscalationCheckView } from "@/server/services/escalation-import.service";
import { formatCalendarDate } from "@/lib/dates";
import { formatPoints } from "@/lib/format";
import type { EscalationTamerOutcomeView } from "@/domain/kpis/escalation";
import { AVISO_LABEL } from "@/domain/kpi-load-status-display";
import { EmptyState } from "@/components/ui";

function formatOutcome(outcome: EscalationTamerOutcomeView | null): string {
  if (!outcome) return "-";
  if (outcome.status === "not_applicable") return "No aplica";
  if (outcome.status === "no_escalation_data") return "Sin dato de Escalados";
  if (outcome.status === "vac") return AVISO_LABEL;
  if (outcome.status === "no_productivity_data") return "Falta Productividad";
  if (outcome.status === "zero_updates") return "No calculable: Actualizaciones es 0";
  return formatPoints(outcome.finalPoints ?? 0);
}

const INFERRED_ZERO_TITLE =
  "El fichero de Escalados esta cargado y la persona no aparece; se interpreta como cero reasignaciones.";

/**
 * Reasignaciones de grupo mostradas: la fila real del Excel si existe, `0
 * (inferido)` cuando la carga existe pero la persona falta y hay
 * Productividad (hotfix `MVP-1C.3 / INPUT-1C`), `AVISO` cuando falta en
 * ambos origenes (hotfix `AVISO`/`0`, ver docs/DECISIONS.md), o `Sin dato`
 * en el resto de casos (por ejemplo, no existe la carga de Escalados).
 */
function formatReassignments(row: { groupReassignments: number | undefined; escalationTamer: EscalationTamerOutcomeView | null }): {
  text: string;
  title?: string;
} {
  if (row.groupReassignments !== undefined) return { text: String(row.groupReassignments) };
  const outcome = row.escalationTamer;
  if (outcome?.inferred && (outcome.status === "computed" || outcome.status === "zero_updates")) {
    return { text: "0 (inferido)", title: INFERRED_ZERO_TITLE };
  }
  if (outcome?.status === "vac") return { text: AVISO_LABEL };
  return { text: "Sin dato" };
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
        <Link href={backHref} className="text-sm text-text-muted underline hover:text-ink">
          Volver a las cargas de la semana
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Comprobar Domador de Escaladas</h1>
        <p className="mt-1 text-sm text-text-muted">
          {split.name} - Semana {week.sequenceNumber} ({formatCalendarDate(week.startDate)} a{" "}
          {formatCalendarDate(week.endDate)})
        </p>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-text-muted">
        <p>
          Escalados: <span className="font-medium">{view.hasEscalationImport ? "cargado" : "pendiente"}</span>
          {!view.hasEscalationImport && (
            <>
              {" "}
              -{" "}
              <Link href={`/splits/${split.id}/weeks/${week.id}/kpis/escalados/cargar`} className="underline hover:text-ink">
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
                className="underline hover:text-ink"
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
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-canvas text-text-muted">
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
              {view.rows.map((row) => {
                const reassignments = formatReassignments(row);
                return (
                  <tr key={row.participantId} className="border-b border-border">
                    <td className="px-3 py-2">{row.alias}</td>
                    <td className="px-3 py-2">{row.fullName}</td>
                    <td className="px-3 py-2">{row.level}</td>
                    <td className="px-3 py-2" title={reassignments.title}>
                      {reassignments.text}
                    </td>
                    <td className="px-3 py-2">{row.updates ?? "Sin dato"}</td>
                    {view.escalationTamerActive && <td className="px-3 py-2">{formatOutcome(row.escalationTamer)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Link
        href={`/splits/${split.id}#kpi-configuracion`}
        className="inline-block text-sm text-text-muted underline hover:text-ink"
      >
        Ir a la configuracion de KPI
      </Link>
    </div>
  );
}
