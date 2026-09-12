import { KPI_CATALOG } from "@/domain/kpis/catalog";
import { locationBonusLabel } from "@/domain/location-bonus";
import type { WeekLocationSummary } from "./WeeklyResultsTable";

/**
 * Tarjeta superior con la localizacion de la semana (`0.8.5` / MVP-2C,
 * seccion 20 del encargo). Se usa tanto en la previsualizacion como en una
 * semana ya publicada: en ese caso `location` viene siempre del snapshot
 * congelado, nunca de una posible configuracion viva distinta.
 */
export function WeekLocationSummaryCard({ location }: { location: WeekLocationSummary | null }) {
  if (!location) return null;
  const kpiName = KPI_CATALOG[location.kpiCode as keyof typeof KPI_CATALOG]?.name ?? location.kpiCode;

  return (
    <div className="rounded-lg border border-info/30 bg-info-soft p-4 text-sm text-info-ink">
      <p className="font-semibold">{location.name}</p>
      <p>
        Potencia: {kpiName} · {locationBonusLabel(location.bonusPercent)}
      </p>
    </div>
  );
}
