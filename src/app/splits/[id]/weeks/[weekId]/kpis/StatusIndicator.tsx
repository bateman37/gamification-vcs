import type { LoadGroupStatus } from "@/domain/kpis/loadGroups";
import { formatAvisoCount } from "@/domain/kpi-load-status-display";

const STATUS_CONFIG: Record<LoadGroupStatus, { label: string; dotClassName: string; textClassName: string }> = {
  PENDING: { label: "Pendiente", dotClassName: "bg-danger", textClassName: "text-danger-ink" },
  PARTIAL: { label: "Carga parcial", dotClassName: "bg-reward", textClassName: "text-reward-ink" },
  LOADED: { label: "Cargado", dotClassName: "bg-success", textClassName: "text-success" },
};

const AVISO_TITLE =
  "Participantes aplicables sin datos en este fichero: posible vacaciones o baja. No confirma una ausencia real.";

/**
 * Un unico indicador de estado (punto de color + texto), nunca los tres a
 * la vez. Cuando el estado es `Cargado` y faltan participantes, anade
 * `n AVISO` (hotfix `AVISO`/`0`, ver docs/DECISIONS.md): una senal
 * informativa, no una ausencia confirmada ni persistida. Siempre usa la
 * palabra fija `AVISO`, en singular y en plural (nunca `AVISOS`).
 */
export function StatusIndicator({ status, vacCount = 0 }: { status: LoadGroupStatus; vacCount?: number }) {
  const config = STATUS_CONFIG[status];
  const showAviso = status === "LOADED" && vacCount > 0;
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-medium ${config.textClassName}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${config.dotClassName}`} aria-hidden="true" />
      {config.label}
      {showAviso && (
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-muted" title={AVISO_TITLE}>
          {formatAvisoCount(vacCount)}
        </span>
      )}
    </span>
  );
}
