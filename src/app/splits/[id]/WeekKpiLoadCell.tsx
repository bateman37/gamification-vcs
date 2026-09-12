import Link from "next/link";
import type { SplitStatus, SplitWeek } from "@prisma/client";

/** Accion de la columna "Carga de KPI" del calendario de semanas. */
export function WeekKpiLoadCell({ splitId, splitStatus, week }: { splitId: string; splitStatus: SplitStatus; week: SplitWeek }) {
  const href = `/splits/${splitId}/weeks/${week.id}/kpis`;

  if (splitStatus === "DRAFT") {
    return <span className="text-xs text-text-muted">Activa el split para introducir KPI</span>;
  }

  if (splitStatus === "CLOSED") {
    return (
      <Link href={href} className="text-sm text-ink underline hover:text-ink">
        Ver KPI
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="inline-block rounded-control bg-ink px-3 py-1 text-sm font-medium text-white hover:bg-ink/90"
    >
      Introducir KPI
    </Link>
  );
}
