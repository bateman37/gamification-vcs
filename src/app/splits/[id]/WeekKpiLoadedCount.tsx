import type { WeekKpiLoadSummary } from "@/server/services/kpi-load-summary.service";

/**
 * Columna "KPI cargados" del calendario de semanas: `n/X` de los KPI
 * activos completos para esa semana (ver docs/MANUAL_KPI_ENTRY.md).
 * Calculado siempre al consultar, nunca persistido. El color no es la
 * unica senal: siempre acompana un texto accesible.
 */
export function WeekKpiLoadedCount({ summary }: { summary: WeekKpiLoadSummary }) {
  const { loadedCount, totalActiveCount } = summary;

  if (totalActiveCount === 0) {
    return (
      <span className="text-sm text-slate-500" title="Este split no tiene ningun KPI activo.">
        0/0
      </span>
    );
  }

  const complete = loadedCount === totalActiveCount;
  const accessibleText = complete
    ? "Carga semanal completa"
    : `${loadedCount} de ${totalActiveCount} KPI cargados`;

  return (
    <span className={`text-sm font-medium ${complete ? "text-green-700" : "text-slate-700"}`} title={accessibleText}>
      {loadedCount}/{totalActiveCount}
      <span className="sr-only"> - {accessibleText}</span>
    </span>
  );
}
