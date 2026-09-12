import { EmptyState } from "@/components/ui";
import { formatCalendarDateEs } from "@/lib/dates";
import type { LedgerEntryView } from "@/server/services/ledger.service";
import type { WeekLocationHistoryRow } from "@/server/services/character-config.service";

const TYPE_LABEL: Record<LedgerEntryView["type"], string> = {
  WEEKLY_EARNING: "Créditos de semana",
  PURCHASE: "Compra",
};

/** Historial de movimientos y localizaciones por semana (`0.9.0` / MVP-2D, seccion 18 del encargo). */
export function HistoryPanel({ ledger, weekLocations }: { ledger: LedgerEntryView[]; weekLocations: WeekLocationHistoryRow[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-ink">Movimientos de creditos</h4>
        {ledger.length === 0 ? (
          <EmptyState>Todavía no tienes ningún movimiento.</EmptyState>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-surface text-sm">
            {ledger.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  <span className={entry.amount >= 0 ? "font-medium text-success" : "font-medium text-danger-ink"}>
                    {entry.amount >= 0 ? "+" : ""}
                    {entry.amount}
                  </span>{" "}
                  · {TYPE_LABEL[entry.type]}: {entry.description}
                </span>
                <span className="text-xs text-text-muted">{formatCalendarDateEs(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-ink">Localizaciones por semana</h4>
        {weekLocations.length === 0 ? (
          <EmptyState>Este split todavía no tiene semanas.</EmptyState>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-surface text-sm">
            {weekLocations.map((row) => (
              <li key={row.weekSequenceNumber} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>{formatCalendarDateEs(row.weekStartDate)}</span>
                <span className="text-text-muted">
                  {row.location ? `${row.location.name} · ${row.location.kpiName} · +${row.location.bonusPercent} %` : "Sin localizacion"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
