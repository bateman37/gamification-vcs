import { formatCalendarDateEs } from "@/lib/dates";

/** Formato castellano: normalmente dos decimales como maximo (parte E5 del encargo). */
export function formatNumberEs(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits, minimumFractionDigits: 0 }).format(value);
}

export function formatPercentEs(value: number | null): string {
  if (value === null) return "—";
  return `${formatNumberEs(value)} %`;
}

export function formatPointsEs(value: number | null): string {
  if (value === null) return "—";
  return formatNumberEs(value);
}

/** Diferencia en puntos porcentuales (parte G3): unidad principal de evolucion. */
export function formatPpEs(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumberEs(value)} pp`;
}

export function formatRelativeEs(value: number | null): string {
  if (value === null) return "No calculable";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumberEs(value)} %`;
}

export function formatDateEs(date: Date): string {
  return formatCalendarDateEs(date);
}

export function formatDateIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
