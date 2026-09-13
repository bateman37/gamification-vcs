/**
 * Paleta "Prisma competitivo" para graficos SVG (recharts no acepta clases
 * de Tailwind): valores calcados de `src/app/globals.css`. Unica copia JS de
 * estos hex, reutilizada por todos los graficos del modulo analitico.
 */
export const ANALYTICS_COLORS = {
  primary: "#2563EB",
  game: "#6D4AFF",
  info: "#0F9D8A",
  reward: "#F4B740",
  success: "#16A34A",
  danger: "#E85D5D",
  ink: "#172033",
  muted: "#667085",
  border: "#E4E7EC",
} as const;

export const LEVEL_COLORS: Record<"N0" | "N1" | "N2", string> = {
  N0: ANALYTICS_COLORS.info,
  N1: ANALYTICS_COLORS.primary,
  N2: ANALYTICS_COLORS.game,
};

export const SERIES_PALETTE = [
  ANALYTICS_COLORS.primary,
  ANALYTICS_COLORS.game,
  ANALYTICS_COLORS.info,
  ANALYTICS_COLORS.reward,
  ANALYTICS_COLORS.success,
  ANALYTICS_COLORS.danger,
];
