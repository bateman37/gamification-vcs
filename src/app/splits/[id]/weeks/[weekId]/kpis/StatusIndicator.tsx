import type { LoadGroupStatus } from "@/domain/kpis/loadGroups";

const STATUS_CONFIG: Record<LoadGroupStatus, { label: string; dotClassName: string; textClassName: string }> = {
  PENDING: { label: "Pendiente", dotClassName: "bg-red-500", textClassName: "text-red-700" },
  PARTIAL: { label: "Carga parcial", dotClassName: "bg-amber-500", textClassName: "text-amber-700" },
  LOADED: { label: "Cargado", dotClassName: "bg-green-600", textClassName: "text-green-700" },
};

/** Un unico indicador de estado (punto de color + texto), nunca los tres a la vez. */
export function StatusIndicator({ status }: { status: LoadGroupStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-medium ${config.textClassName}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${config.dotClassName}`} aria-hidden="true" />
      {config.label}
    </span>
  );
}
