import Link from "next/link";
import type { WeekKpiLoadSummary } from "@/server/services/kpi-load-summary.service";

/** Columna "Resultados" del calendario de semanas (seccion 4.2 de docs/RESULTS_PUBLICATION.md). */
export function WeekResultsCell({
  splitId,
  weekId,
  summary,
  publishedAt,
}: {
  splitId: string;
  weekId: string;
  summary: WeekKpiLoadSummary;
  publishedAt: Date | null;
}) {
  const href = `/splits/${splitId}/weeks/${weekId}/resultados`;

  if (publishedAt) {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-block w-fit rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">Publicada</span>
        <Link href={href} className="text-sm text-slate-700 underline hover:text-slate-900">
          Ver resultados
        </Link>
      </div>
    );
  }

  const isComplete = summary.totalActiveCount > 0 && summary.loadedCount === summary.totalActiveCount;
  if (!isComplete) {
    return (
      <span className="text-xs text-slate-500" title={`Pendientes: ${summary.loadedCount} de ${summary.totalActiveCount} KPI cargados`}>
        Pendientes ({summary.loadedCount}/{summary.totalActiveCount})
      </span>
    );
  }

  return (
    <Link href={href} className="inline-block rounded-md border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50">
      Mostrar resultados
    </Link>
  );
}
