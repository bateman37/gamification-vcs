import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById, getSplitWeek } from "@/server/services/split.service";
import { getStabilityFormView } from "@/server/services/stability-entry.service";
import { formatCalendarDate } from "@/lib/dates";
import { StabilityEntryForm } from "./StabilityEntryForm";

export default async function StabilityEntryPage({ params }: { params: { id: string; weekId: string } }) {
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
        <h1 className="mt-2 text-xl font-semibold">Introducir Guardian de la Estabilidad</h1>
        <p className="mt-1 text-sm text-text-muted">
          {split.name} - Semana {week.sequenceNumber} ({formatCalendarDate(week.startDate)} a{" "}
          {formatCalendarDate(week.endDate)})
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Solo se muestran los participantes de nivel N2 aplicables a esta semana. Un resultado de{" "}
          <strong>0</strong> es un dato real, no significa vacaciones.
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
          Solo se puede introducir o actualizar Guardian de la Estabilidad en un split activo.
        </p>
      ) : (
        <StabilityEntryForm splitId={split.id} weekId={week.id} formView={await getStabilityFormView(prisma, split.id, week.id)} />
      )}
    </div>
  );
}
