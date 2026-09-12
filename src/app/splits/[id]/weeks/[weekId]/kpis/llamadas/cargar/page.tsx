import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById, getSplitWeek } from "@/server/services/split.service";
import { formatCalendarDate } from "@/lib/dates";
import { VoiceUploadForm } from "./VoiceUploadForm";

export default async function VoiceUploadPage({
  params,
}: {
  params: { id: string; weekId: string };
}) {
  const split = await getSplitById(prisma, params.id);
  if (!split) notFound();
  const week = await getSplitWeek(prisma, params.id, params.weekId);
  if (!week) notFound();

  const backHref = `/splits/${split.id}/weeks/${week.id}/kpis`;

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-text-muted underline hover:text-ink">
          Volver a las cargas de la semana
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Cargar Llamadas</h1>
        <p className="mt-1 text-sm text-text-muted">
          {split.name} - Semana {week.sequenceNumber} ({formatCalendarDate(week.startDate)} a{" "}
          {formatCalendarDate(week.endDate)})
        </p>
      </div>

      {split.status !== "ACTIVE" ? (
        <p className="rounded-card border border-dashed border-border-strong px-4 py-6 text-center text-sm text-text-muted">
          Solo se puede cargar o sustituir Llamadas en un split activo.
        </p>
      ) : (
        <VoiceUploadForm splitId={split.id} weekId={week.id} />
      )}
    </div>
  );
}
