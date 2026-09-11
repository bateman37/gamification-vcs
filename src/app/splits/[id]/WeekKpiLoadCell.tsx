import Link from "next/link";
import type { SplitStatus, SplitWeek } from "@prisma/client";

/** Accion de la columna "Carga de KPI" del calendario de semanas. */
export function WeekKpiLoadCell({ splitId, splitStatus, week }: { splitId: string; splitStatus: SplitStatus; week: SplitWeek }) {
  const href = `/splits/${splitId}/weeks/${week.id}/kpis`;

  if (splitStatus === "DRAFT") {
    return <span className="text-xs text-slate-500">Activa el split para introducir KPI</span>;
  }

  if (splitStatus === "CLOSED") {
    return (
      <Link href={href} className="text-sm text-slate-700 underline hover:text-slate-900">
        Ver KPI
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="inline-block rounded-md bg-slate-900 px-3 py-1 text-sm font-medium text-white hover:bg-slate-700"
    >
      Introducir KPI
    </Link>
  );
}
