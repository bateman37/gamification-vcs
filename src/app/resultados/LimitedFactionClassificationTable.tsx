import Link from "next/link";
import { formatPoints } from "@/lib/format";
import type { FactionClassification } from "@/server/services/faction-classification.service";

/**
 * Clasificacion general de facciones de solo lectura, visible por un
 * participante (seccion 11 de docs/FACTIONS.md). Los datos ya son seguros
 * para mostrar tal cual: solo alias (nunca nombre real), faccion y puntos
 * por posicion, sin niveles ni desglose de KPI de otras personas.
 */
export function LimitedFactionClassificationTable({
  classification,
  selfFactionId,
  splitId,
  selectedWeek,
}: {
  classification: FactionClassification;
  selfFactionId: string | null;
  splitId: string;
  selectedWeek: string | null;
}) {
  const { weeks, accumulated, weekClassifications } = classification;
  if (accumulated.length === 0) return null;

  const weekEntry = selectedWeek ? weekClassifications.get(selectedWeek) ?? null : null;

  function weekHref(weekId: string | null): string {
    const params = new URLSearchParams();
    params.set("split", splitId);
    if (weekId) params.set("semanaFaccion", weekId);
    return `?${params.toString()}#clasificacion-facciones-resultados`;
  }

  return (
    <div id="clasificacion-facciones-resultados" className="scroll-mt-6 space-y-3">
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-canvas text-text-muted">
            <tr>
              <th className="sticky left-0 z-10 bg-canvas px-3 py-2 font-medium">Pos.</th>
              <th className="sticky left-10 z-10 bg-canvas px-3 py-2 font-medium">Faccion</th>
              {weeks.map((week) => (
                <th key={week.splitWeekId} className="px-3 py-2 text-center font-medium">
                  <Link href={weekHref(week.splitWeekId)} className="underline hover:text-ink">
                    S{week.weekSequenceNumber}
                  </Link>
                </th>
              ))}
              <th className="px-3 py-2 text-center font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {accumulated.map((entry) => {
              const isSelf = entry.factionId === selfFactionId;
              return (
                <tr key={entry.factionId} className={`border-b border-border ${isSelf ? "bg-reward-soft" : ""}`}>
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-medium">{entry.rank}</td>
                  <td className="sticky left-10 z-10 bg-inherit px-3 py-2 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="h-3 w-3 rounded-full border border-border-strong" style={{ backgroundColor: entry.color }} />
                      {entry.name}
                      {isSelf && <span className="ml-1 text-xs text-reward-ink">(tu faccion)</span>}
                    </span>
                  </td>
                  {weeks.map((week) => (
                    <td key={week.splitWeekId} className="px-3 py-2 text-center text-text-muted">
                      {entry.scoreByWeek.get(week.splitWeekId) ?? "—"}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-semibold">{formatPoints(entry.totalScore)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {weekEntry && (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-canvas text-text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Pos.</th>
                <th className="px-3 py-2 font-medium">Faccion</th>
                <th className="px-3 py-2 font-medium">Los tres que puntuaron (Renombre = puntos por posicion)</th>
                <th className="px-3 py-2 text-center font-medium">Suma semanal</th>
              </tr>
            </thead>
            <tbody>
              {weekEntry.entries.map((entry) => (
                <tr key={entry.factionId} className={`border-b border-border ${entry.factionId === selfFactionId ? "bg-reward-soft" : ""}`}>
                  <td className="px-3 py-2 font-medium">{entry.weeklyRank}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="h-3 w-3 rounded-full border border-border-strong" style={{ backgroundColor: entry.color }} />
                      {entry.name}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-text-muted">
                    {entry.topContributors.map((contributor) => `${contributor.alias} (${formatPoints(contributor.positionPoints)})`).join(", ")}
                  </td>
                  <td className="px-3 py-2 text-center font-semibold">{formatPoints(entry.weeklyScore)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
