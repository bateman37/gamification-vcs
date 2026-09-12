import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listSplitsWithParticipantCount } from "@/server/services/split.service";
import { formatCalendarDate, addCalendarDays } from "@/lib/dates";
import { SPLIT_STATUS_LABELS } from "@/lib/labels";
import { Badge, EmptyState } from "@/components/ui";
import { requireAdminSession } from "@/lib/session";

const STATUS_TONE: Record<string, "slate" | "green" | "gray"> = {
  DRAFT: "slate",
  ACTIVE: "green",
  CLOSED: "gray",
};

export default async function SplitsPage() {
  await requireAdminSession();
  const splits = await listSplitsWithParticipantCount(prisma);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Splits</h1>
          <p className="text-sm text-text-muted">Ediciones de la gamificación periódica.</p>
        </div>
        <Link
          href="/splits/nuevo"
          className="rounded-control bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90"
        >
          Crear split
        </Link>
      </div>

      <div className="rounded-card border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-canvas text-text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Fechas</th>
              <th className="px-3 py-2 text-center font-medium">Semanas</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 text-center font-medium">Participantes</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {splits.map((split) => {
              const endDate = addCalendarDays(split.startDate, split.numberOfWeeks * 7 - 1);
              return (
                <tr key={split.id} className="border-b border-border">
                  <td className="px-3 py-2 font-medium">{split.name}</td>
                  <td className="px-3 py-2 text-text-muted">
                    {formatCalendarDate(split.startDate)} - {formatCalendarDate(endDate)}
                  </td>
                  <td className="px-3 py-2 text-center">{split.numberOfWeeks}</td>
                  <td className="px-3 py-2">
                    <Badge tone={STATUS_TONE[split.status]}>{SPLIT_STATUS_LABELS[split.status]}</Badge>
                  </td>
                  <td className="px-3 py-2 text-center">{split.participantCount}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/splits/${split.id}`} className="text-sm font-medium text-ink underline">
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {splits.length === 0 && (
          <div className="p-4">
            <EmptyState>Todavía no hay splits creados.</EmptyState>
          </div>
        )}
      </div>
    </div>
  );
}
