/**
 * Bandas de color por porcentaje del maximo aplicable, para el mapa de
 * calor de la previsualizacion y la publicacion de resultados (ver
 * docs/RESULTS_PUBLICATION.md). Funcion pura, sin percentiles de los
 * companeros: los umbrales dependen solo del maximo del KPI, por lo que el
 * resultado es reproducible para siempre a partir de la instantanea
 * publicada.
 */

export type ResultColorBand = "below-zero" | "very-low" | "low" | "mid" | "good" | "excellent" | "not-applicable";

export interface ColorBandInfo {
  band: ResultColorBand;
  label: string;
}

/** `percentage` = finalPoints / baseMax * 100. Los limites 0, 25, 50, 75 y 90 son inclusivos en el extremo inferior de cada banda. */
export function colorBandForPercentage(percentage: number): ColorBandInfo {
  if (percentage < 0) return { band: "below-zero", label: "Por debajo de 0 %" };
  if (percentage < 25) return { band: "very-low", label: "0 % - 25 %" };
  if (percentage < 50) return { band: "low", label: "25 % - 50 %" };
  if (percentage < 75) return { band: "mid", label: "50 % - 75 %" };
  if (percentage < 90) return { band: "good", label: "75 % - 90 %" };
  return { band: "excellent", label: "90 % o mas" };
}

export const NOT_APPLICABLE_COLOR_BAND: ColorBandInfo = { band: "not-applicable", label: "No aplica" };

/** Clases Tailwind de fondo/texto para cada banda. Centralizado aqui para no dispersar condicionales de color por las vistas. */
export const COLOR_BAND_CLASSES: Record<ResultColorBand, string> = {
  "below-zero": "bg-red-200 text-red-900",
  "very-low": "bg-red-50 text-red-700",
  low: "bg-orange-50 text-orange-700",
  mid: "bg-amber-50 text-amber-800",
  good: "bg-green-50 text-green-700",
  excellent: "bg-green-100 text-green-800",
  "not-applicable": "bg-slate-100 text-slate-500",
};
