import { EmptyState } from "@/components/ui";
import { formatCalendarDateEs } from "@/lib/dates";
import type { LedgerEntryView } from "@/server/services/ledger.service";
import type { WeekLocationHistoryRow } from "@/server/services/character-config.service";

const TYPE_LABEL: Record<LedgerEntryView["type"], string> = {
  WEEKLY_EARNING: "Creditos de semana",
  PURCHASE: "Compra",
};

/** Historial de movimientos y localizaciones por semana (`0.9.0` / MVP-2D, seccion 18 del encargo). */
export function HistoryPanel({ ledger, weekLocations }: { ledger: LedgerEntryView[]; weekLocations: WeekLocationHistoryRow[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-slate-700">Movimientos de creditos</h4>
        {ledger.length === 0 ? (
          <EmptyState>Todavia no tienes ningun movimiento.</EmptyState>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200 bg-white text-sm">
            {ledger.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  <span className={entry.amount >= 0 ? "font-medium text-green-700" : "font-medium text-red-700"}>
                    {entry.amount >= 0 ? "+" : ""}
                    {entry.amount}
                  </span>{" "}
                  · {TYPE_LABEL[entry.type]}: {entry.description}
                </span>
                <span className="text-xs text-slate-500">{formatCalendarDateEs(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-700">Localizaciones por semana</h4>
        {weekLocations.length === 0 ? (
          <EmptyState>Este split todavia no tiene semanas.</EmptyState>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200 bg-white text-sm">
            {weekLocations.map((row) => (
              <li key={row.weekSequenceNumber} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>{formatCalendarDateEs(row.weekStartDate)}</span>
                <span className="text-slate-600">
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
