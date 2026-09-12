import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById, getSplitWeek } from "@/server/services/split.service";
import { getWriterCheckView } from "@/server/services/writer-entry.service";
import { formatCalendarDate } from "@/lib/dates";
import { formatPoints } from "@/lib/format";
import type { StarWriterOutcomeView } from "@/domain/kpis/writer";
import { EmptyState } from "@/components/ui";

function formatOutcome(outcome: StarWriterOutcomeView | null): string {
  if (!outcome) return "-";
  if (outcome.status === "not_applicable") return "No aplica";
  if (outcome.status === "no_data") return "Sin dato";
  return formatPoints(outcome.finalPoints ?? 0);
}

export default async function WriterCheckPage({ params }: { params: { id: string; weekId: string } }) {
  const split = await getSplitById(prisma, params.id);
  if (!split) notFound();
  const week = await getSplitWeek(prisma, params.id, params.weekId);
  if (!week) notFound();

  const view = await getWriterCheckView(prisma, params.id, week.id);
  const backHref = `/splits/${split.id}/weeks/${week.id}/kpis`;

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-text-muted underline hover:text-ink">
          Volver a las cargas de la semana
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Comprobar Redactor estrella</h1>
        <p className="mt-1 text-sm text-text-muted">
          {split.name} - Semana {week.sequenceNumber} ({formatCalendarDate(week.startDate)} a{" "}
          {formatCalendarDate(week.endDate)})
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
                <th className="px-3 py-2 font-medium">Entregados</th>
                <th className="px-3 py-2 font-medium">No entregados</th>
                <th className="px-3 py-2 font-medium">Propuestos</th>
                {view.starWriterActive && <th className="px-3 py-2 font-medium">Redactor estrella</th>}
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row) => (
                <tr key={row.participantId} className="border-b border-border">
                  <td className="px-3 py-2">{row.alias}</td>
                  <td className="px-3 py-2">{row.fullName}</td>
                  <td className="px-3 py-2">{row.level}</td>
                  <td className="px-3 py-2">{row.deliveredArticles ?? "Sin dato"}</td>
                  <td className="px-3 py-2">{row.undeliveredArticles ?? "Sin dato"}</td>
                  <td className="px-3 py-2">{row.proposedArticles ?? "Sin dato"}</td>
                  {view.starWriterActive && <td className="px-3 py-2">{formatOutcome(row.starWriter)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {split.status === "ACTIVE" && (
        <Link
          href={`/splits/${split.id}/weeks/${week.id}/kpis/articulos/introducir`}
          className="block text-sm text-text-muted underline hover:text-ink"
        >
          Actualizar datos
        </Link>
      )}
      <Link
        href={`/splits/${split.id}#kpi-configuracion`}
        className="block text-sm text-text-muted underline hover:text-ink"
      >
        Ir a la configuracion de KPI
      </Link>
    </div>
  );
}
