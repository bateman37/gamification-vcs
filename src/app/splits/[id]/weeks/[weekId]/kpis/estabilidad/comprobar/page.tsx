import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById, getSplitWeek } from "@/server/services/split.service";
import { getStabilityCheckView } from "@/server/services/stability-entry.service";
import { formatCalendarDate } from "@/lib/dates";
import { formatPoints } from "@/lib/format";
import type { StabilityGuardianOutcomeView } from "@/domain/kpis/stability";
import { EmptyState } from "@/components/ui";

function formatOutcome(outcome: StabilityGuardianOutcomeView | null): string {
  if (!outcome) return "-";
  if (outcome.status === "not_applicable") return "No aplica";
  if (outcome.status === "no_data") return "Sin dato";
  return formatPoints(outcome.finalPoints ?? 0);
}

export default async function StabilityCheckPage({ params }: { params: { id: string; weekId: string } }) {
  const split = await getSplitById(prisma, params.id);
  if (!split) notFound();
  const week = await getSplitWeek(prisma, params.id, params.weekId);
  if (!week) notFound();

  const view = await getStabilityCheckView(prisma, params.id, week.id);
  const backHref = `/splits/${split.id}/weeks/${week.id}/kpis`;

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-text-muted underline hover:text-ink">
          Volver a las cargas de la semana
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Comprobar Guardian de la Estabilidad</h1>
        <p className="mt-1 text-sm text-text-muted">
          {split.name} - Semana {week.sequenceNumber} ({formatCalendarDate(week.startDate)} a{" "}
          {formatCalendarDate(week.endDate)})
        </p>
      </div>

      {view.noApplicableN2 ? (
        <EmptyState>No hay participantes de nivel N2 aplicables a esta semana. No aplica esta semana.</EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-canvas text-text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Alias</th>
                  <th className="px-3 py-2 font-medium">Nombre real</th>
                  <th className="px-3 py-2 font-medium">Nivel</th>
                  <th className="px-3 py-2 font-medium">Resultados de estabilidad</th>
                  {view.stabilityGuardianActive && <th className="px-3 py-2 font-medium">Guardian de la Estabilidad</th>}
                </tr>
              </thead>
              <tbody>
                {view.rows.map((row) => (
                  <tr key={row.participantId} className="border-b border-border">
                    <td className="px-3 py-2">{row.alias}</td>
                    <td className="px-3 py-2">{row.fullName}</td>
                    <td className="px-3 py-2">{row.level}</td>
                    <td className="px-3 py-2">{row.resultValue ?? "Sin dato"}</td>
                    {view.stabilityGuardianActive && <td className="px-3 py-2">{formatOutcome(row.stabilityGuardian)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {split.status === "ACTIVE" && (
            <Link
              href={`/splits/${split.id}/weeks/${week.id}/kpis/estabilidad/introducir`}
              className="inline-block text-sm text-text-muted underline hover:text-ink"
            >
              Actualizar datos
            </Link>
          )}
        </>
      )}

      <Link
        href={`/splits/${split.id}#kpi-configuracion`}
        className="block text-sm text-text-muted underline hover:text-ink"
      >
        Ir a la configuración de KPI
      </Link>
    </div>
  );
}
