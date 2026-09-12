import type { ParticipantEconomySummary } from "@/server/services/ledger.service";
import { EmptyState } from "@/components/ui";

/** Resumen de compras y creditos por participante (seccion 8 del encargo), solo lectura para auditoria. */
export function EconomySummaryPanel({ summary }: { summary: ParticipantEconomySummary[] }) {
  if (summary.length === 0) {
    return <EmptyState>Todavia no hay participantes en este split.</EmptyState>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 font-medium">Participante</th>
            <th className="px-3 py-2 text-right font-medium">Saldo</th>
            <th className="px-3 py-2 text-right font-medium">Total ganado</th>
            <th className="px-3 py-2 text-right font-medium">Total gastado</th>
            <th className="px-3 py-2 text-right font-medium">Compras</th>
          </tr>
        </thead>
        <tbody>
          {summary.map((row) => (
            <tr key={row.splitParticipantId} className="border-b border-slate-100">
              <td className="px-3 py-2">{row.alias}</td>
              <td className="px-3 py-2 text-right font-medium">{row.balance}</td>
              <td className="px-3 py-2 text-right text-green-700">+{row.totalEarned}</td>
              <td className="px-3 py-2 text-right text-red-700">-{row.totalSpent}</td>
              <td className="px-3 py-2 text-right">{row.purchaseCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
