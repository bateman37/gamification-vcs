import Link from "next/link";
import { KPI_CATALOG, type KpiCode } from "@/domain/kpis/catalog";
import type { WeekLocationTemporalStatus } from "@/domain/location-window";
import { Badge } from "@/components/ui";

/** Columna "Localizacion" del calendario de semanas (`0.8.5` / MVP-2C, ver docs/WEEKLY_LOCATIONS.md). */
export function WeekLocationCell({
  splitId,
  weekId,
  location,
  status,
  editable,
  isNextWeek,
}: {
  splitId: string;
  weekId: string;
  location: { name: string; kpiCode: KpiCode; bonusPercent: number } | null;
  status: WeekLocationTemporalStatus;
  editable: boolean;
  isNextWeek: boolean;
}) {
  const href = `/splits/${splitId}/weeks/${weekId}/localizacion`;

  return (
    <div className="flex flex-col gap-1">
      {location ? (
        <div>
          <span className="block font-medium text-ink">{location.name}</span>
          <span className="block text-xs text-text-muted">
            {KPI_CATALOG[location.kpiCode].name} · +{location.bonusPercent} %
          </span>
        </div>
      ) : (
        <span className="text-xs text-text-muted">Sin localización</span>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {status === "ACTIVA" && <Badge tone="green">Activa</Badge>}
        {(status === "FINALIZADA" || status === "PUBLICADA") && <Badge tone="gray">Bloqueada</Badge>}

        {editable ? (
          <Link href={href} className="text-xs font-medium text-ink underline hover:text-ink">
            {location ? "Editar" : "Configurar"}
          </Link>
        ) : (
          location && (
            <Link href={href} className="text-xs text-text-muted underline hover:text-ink">
              Ver
            </Link>
          )
        )}
        {isNextWeek && editable && !location && (
          <span className="rounded-full bg-game-soft px-2 py-0.5 text-[10px] font-medium text-game-ink">
            Proxima semana
          </span>
        )}
      </div>
    </div>
  );
}
