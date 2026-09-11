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

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-slate-600 underline hover:text-slate-900">
          Volver a las cargas de la semana
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Introducir Cronomagia laboral</h1>
        <p className="mt-1 text-sm text-slate-600">
          {split.name} - Semana {week.sequenceNumber} ({formatCalendarDate(week.startDate)} a{" "}
          {formatCalendarDate(week.endDate)})
        </p>
        <p className="mt-2 text-sm text-slate-600">
          <strong>Horas totales = 0</strong> significa vacaciones toda la semana (VAC): la fila se guarda igual y
          cuenta como completa, pero no otorga puntos. Las horas productivas pueden superar las horas totales, no es
          un error.
        </p>
        <Link
          href={`/splits/${split.id}#kpi-configuracion`}
          className="mt-1 inline-block text-sm text-slate-600 underline hover:text-slate-900"
        >
          Ir a la configuracion de KPI
        </Link>
      </div>

      {split.status !== "ACTIVE" ? (
        <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          Solo se puede introducir o actualizar Cronomagia laboral en un split activo.
        </p>
      ) : (
        <ChronomancyEntryForm splitId={split.id} weekId={week.id} formView={await getChronomancyFormView(prisma, split.id, week.id)} />
      )}
    </div>
  );
}
