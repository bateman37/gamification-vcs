import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById, getSplitWeek } from "@/server/services/split.service";
import { getStudentFormView } from "@/server/services/student-entry.service";
import { formatCalendarDate } from "@/lib/dates";
import { StudentEntryForm } from "./StudentEntryForm";

export default async function StudentEntryPage({ params }: { params: { id: string; weekId: string } }) {
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
        <h1 className="mt-2 text-xl font-semibold">Introducir Estudiante entusiasta</h1>
        <p className="mt-1 text-sm text-text-muted">
          {split.name} - Semana {week.sequenceNumber} ({formatCalendarDate(week.startDate)} a{" "}
          {formatCalendarDate(week.endDate)})
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Horas de dedicacion a la formacion. Un valor <strong>0</strong> es un dato valido y completo.
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
          Solo se puede introducir o actualizar Estudiante entusiasta en un split activo.
        </p>
      ) : (
        <StudentEntryForm splitId={split.id} weekId={week.id} formView={await getStudentFormView(prisma, split.id, week.id)} />
      )}
    </div>
  );
}
