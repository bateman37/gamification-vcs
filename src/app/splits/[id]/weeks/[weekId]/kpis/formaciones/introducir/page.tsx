import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById, getSplitWeek } from "@/server/services/split.service";
import { getApprenticeFormView } from "@/server/services/apprentice-entry.service";
import { formatCalendarDate } from "@/lib/dates";
import { ApprenticeEntryForm } from "./ApprenticeEntryForm";

export default async function ApprenticeEntryPage({ params }: { params: { id: string; weekId: string } }) {
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
        <h1 className="mt-2 text-xl font-semibold">Introducir Aprendiz experto</h1>
        <p className="mt-1 text-sm text-slate-600">
          {split.name} - Semana {week.sequenceNumber} ({formatCalendarDate(week.startDate)} a{" "}
          {formatCalendarDate(week.endDate)})
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Formaciones completadas. El valor <strong>0</strong> es valido; no puede superar el maximo configurado
          para el split.
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
          Solo se puede introducir o actualizar Aprendiz experto en un split activo.
        </p>
      ) : (
        <ApprenticeEntryForm splitId={split.id} weekId={week.id} formView={await getApprenticeFormView(prisma, split.id, week.id)} />
      )}
    </div>
  );
}
