import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById, getSplitWeek } from "@/server/services/split.service";
import { getChronomancyFormView } from "@/server/services/chronomancy-entry.service";
import { formatCalendarDate } from "@/lib/dates";
import { ChronomancyEntryForm } from "./ChronomancyEntryForm";

export default async function ChronomancyEntryPage({ params }: { params: { id: string; weekId: string } }) {
  const split = await getSplitById(prisma, params.id);
  if (!split) notFound();
  const week = await getSplitWeek(prisma, params.id, params.weekId);
  if (!week) notFound();

  const backHref = `/splits/${split.id}/weeks/${week.id}/kpis`;
  const formView = split.status === "ACTIVE" ? await getChronomancyFormView(prisma, split.id, week.id) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-text-muted underline hover:text-ink">
          Volver a las cargas de la semana
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Horas semanales y Cronomagia laboral</h1>
        <p className="mt-1 text-sm text-text-muted">
          {split.name} - Semana {week.sequenceNumber} ({formatCalendarDate(week.startDate)} a{" "}
          {formatCalendarDate(week.endDate)})
        </p>
        <p className="mt-2 text-sm text-text-muted">
          {formView
            ? formView.chronomancyActive
              ? "Dato de asistencia obligatorio · KPI activo"
              : "Dato de asistencia obligatorio · KPI inactivo"
            : null}
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Dejar <strong>horas totales</strong> a 0 o en blanco al guardar significa{" "}
          <strong>Ausencia · Sin datos semanales</strong>: la fila se guarda igual, cuenta como completa y no otorga
          puntos de ningún KPI esa semana. Horas productivas pueden superar las horas totales cuando aplican, no es un
          error.
        </p>
        <Link
          href={`/splits/${split.id}#kpi-configuracion`}
          className="mt-1 inline-block text-sm text-text-muted underline hover:text-ink"
        >
          Ir a la configuración de KPI
        </Link>
      </div>

      {!formView ? (
        <p className="rounded-card border border-dashed border-border-strong px-4 py-6 text-center text-sm text-text-muted">
          Solo se puede introducir o actualizar horas semanales en un split activo.
        </p>
      ) : (
        <ChronomancyEntryForm splitId={split.id} weekId={week.id} formView={formView} />
      )}
    </div>
  );
}
