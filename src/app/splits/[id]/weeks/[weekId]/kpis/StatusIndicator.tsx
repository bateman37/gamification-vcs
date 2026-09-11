import type { LoadGroupStatus } from "@/domain/kpis/loadGroups";

const STATUS_CONFIG: Record<LoadGroupStatus, { label: string; dotClassName: string; textClassName: string }> = {
  PENDING: { label: "Pendiente", dotClassName: "bg-red-500", textClassName: "text-red-700" },
  PARTIAL: { label: "Carga parcial", dotClassName: "bg-amber-500", textClassName: "text-amber-700" },
  LOADED: { label: "Cargado", dotClassName: "bg-green-600", textClassName: "text-green-700" },
};

const VAC_TITLE =
  "Participantes aplicables sin datos en este fichero: posible vacaciones o baja. No confirma una ausencia real.";

/**
 * Un unico indicador de estado (punto de color + texto), nunca los tres a
 * la vez. Cuando el estado es `Cargado` y faltan participantes, anade
 * `n VAC` (ver docs/DECISIONS.md): una senal informativa, no una ausencia
 * confirmada ni persistida.
 */
export function StatusIndicator({ status, vacCount = 0 }: { status: LoadGroupStatus; vacCount?: number }) {
  const config = STATUS_CONFIG[status];
  const showVac = status === "LOADED" && vacCount > 0;
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-medium ${config.textClassName}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${config.dotClassName}`} aria-hidden="true" />
      {config.label}
      {showVac && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600" title={VAC_TITLE}>
          {vacCount} VAC
        </span>
      )}
    </span>
  );
}
