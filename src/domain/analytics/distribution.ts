/**
 * Distribucion y consistencia (bloque 4 / H5 del encargo): intervalos sin
 * solapamientos sobre el `%` del maximo base. Cada persona cuenta una vez
 * (valor ya consolidado por `computeHierarchicalAverage`).
 */

export type DistributionBucket =
  | "negativo"
  | "bajo"
  | "medio_bajo"
  | "medio"
  | "alto"
  | "muy_alto"
  | "sobre_maximo";

export const DISTRIBUTION_BUCKET_LABELS: Record<DistributionBucket, string> = {
  negativo: "Negativo",
  bajo: "Bajo",
  medio_bajo: "Medio-bajo",
  medio: "Medio",
  alto: "Alto",
  muy_alto: "Muy alto",
  sobre_maximo: "Sobre el máximo base",
};

export function bucketForPercentage(percentage: number): DistributionBucket {
  if (percentage < 0) return "negativo";
  if (percentage < 25) return "bajo";
  if (percentage < 50) return "medio_bajo";
  if (percentage < 75) return "medio";
  if (percentage < 90) return "alto";
  if (percentage <= 100) return "muy_alto";
  return "sobre_maximo";
}

export const DISTRIBUTION_BUCKET_ORDER: DistributionBucket[] = [
  "negativo",
  "bajo",
  "medio_bajo",
  "medio",
  "alto",
  "muy_alto",
  "sobre_maximo",
];

export function buildDistribution(percentages: readonly number[]): Record<DistributionBucket, number> {
  const counts: Record<DistributionBucket, number> = {
    negativo: 0,
    bajo: 0,
    medio_bajo: 0,
    medio: 0,
    alto: 0,
    muy_alto: 0,
    sobre_maximo: 0,
  };
  for (const value of percentages) {
    counts[bucketForPercentage(value)] += 1;
  }
  return counts;
}
