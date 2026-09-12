import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById, getSplitWeek } from "@/server/services/split.service";
import { getWriterFormView } from "@/server/services/writer-entry.service";
import { formatCalendarDate } from "@/lib/dates";
import { WriterEntryForm } from "./WriterEntryForm";

export default async function WriterEntryPage({ params }: { params: { id: string; weekId: string } }) {
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
        <h1 className="mt-2 text-xl font-semibold">Introducir Redactor estrella</h1>
        <p className="mt-1 text-sm text-text-muted">
          {split.name} - Semana {week.sequenceNumber} ({formatCalendarDate(week.startDate)} a{" "}
          {formatCalendarDate(week.endDate)})
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Escribe los articulos no entregados como un conteo positivo: el calculo aplica la resta automaticamente.
          Los tres ceros son una entrada valida y completa.
        </p>
        <Link
          href={`/splits/${split.id}#kpi-configuracion`}
          className="mt-1 inline-block text-sm text-text-muted underline hover:text-ink"
        >
          Ir a la configuracion de KPI
        </Link>
      </div>

      {split.status !== "ACTIVE" ? (
        <p className="rounded-card border border-dashed border-border-strong px-4 py-6 text-center text-sm text-text-muted">
          Solo se puede introducir o actualizar Redactor estrella en un split activo.
        </p>
      ) : (
        <WriterEntryForm splitId={split.id} weekId={week.id} formView={await getWriterFormView(prisma, split.id, week.id)} />
      )}
    </div>
  );
}
