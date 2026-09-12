import { formatPoints } from "@/lib/format";
import type { SplitClassification } from "@/server/services/classification.service";

/**
 * Clasificacion general limitada, visible por un participante (seccion 9.3
 * de docs/RESULTS_PUBLICATION.md): alias, posicion semanal/general, total
 * de puntos KPI y puntos por posicion de cada semana, sumas acumuladas.
 * Nunca incluye nombre real, KPI individuales, niveles, VAC ni maximos.
 */
export function LimitedClassificationTable({ classification, selfSplitParticipantId }: { classification: SplitClassification; selfSplitParticipantId: string | null }) {
  const { weeks, entries } = classification;

  if (entries.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-canvas text-text-muted">
          <tr>
            <th className="sticky left-0 z-10 bg-canvas px-3 py-2 font-medium">Pos.</th>
            <th className="sticky left-10 z-10 bg-canvas px-3 py-2 font-medium">Alias</th>
            {weeks.map((week) => (
              <th key={week.splitWeekId} className="px-3 py-2 text-center font-medium">
                S{week.weekSequenceNumber}
              </th>
            ))}
            <th className="px-3 py-2 text-center font-medium">Total posición</th>
            <th className="px-3 py-2 text-center font-medium">Total KPI</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isSelf = entry.splitParticipantId === selfSplitParticipantId;
            return (
              <tr key={entry.splitParticipantId} className={`border-b border-border ${isSelf ? "bg-reward-soft" : ""}`}>
                <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-medium">{entry.rank}</td>
                <td className="sticky left-10 z-10 bg-inherit px-3 py-2 font-medium">
                  {entry.alias}
                  {isSelf && <span className="ml-1 text-xs text-reward-ink">(tu)</span>}
                </td>
                {weeks.map((week) => {
                  const points = entry.pointsByWeek.get(week.splitWeekId);
                  const weeklyRank = entry.weeklyRankByWeek.get(week.splitWeekId);
                  const totalKpi = entry.totalKpiPointsByWeek.get(week.splitWeekId);
                  return (
                    <td
                      key={week.splitWeekId}
                      className="px-3 py-2 text-center text-text-muted"
                      title={
                        points === undefined
                          ? "No participa esta semana"
                          : `Posición semanal: ${weeklyRank} - Total KPI de la semana: ${formatPoints(totalKpi ?? 0)}`
                      }
                    >
                      {points ?? "—"}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center font-semibold">{formatPoints(entry.totalPositionPoints)}</td>
                <td className="px-3 py-2 text-center font-semibold">{formatPoints(entry.totalKpiPoints)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
