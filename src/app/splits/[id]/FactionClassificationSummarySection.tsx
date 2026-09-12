import Link from "next/link";
import { formatPoints } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import type { FactionClassification } from "@/server/services/faction-classification.service";

/** Bloque "Clasificacion general facciones" bajo la individual (seccion 9.2 de docs/FACTIONS.md). */
export function FactionClassificationSummarySection({
  splitId,
  classification,
}: {
  splitId: string;
  classification: FactionClassification;
}) {
  const { weeks, accumulated, hasFactionData } = classification;

  return (
    <section id="clasificacion-general-facciones" className="scroll-mt-20 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Clasificación general facciones</h2>
        {hasFactionData && (
          <Link href={`/splits/${splitId}/clasificacion-facciones`} className="text-sm font-medium text-ink underline hover:text-ink">
            Ver clasificación detallada
          </Link>
        )}
      </div>

      {!hasFactionData ? (
        <EmptyState>
          Todavía no hay clasificación de facciones publicada. Configura al menos dos facciones y publica una semana
          para verla aquí.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-canvas text-text-muted">
              <tr>
                <th className="sticky left-0 z-10 bg-canvas px-3 py-2 font-medium">Pos.</th>
                <th className="sticky left-10 z-10 bg-canvas px-3 py-2 font-medium">Facción</th>
                {weeks.map((week) => (
                  <th key={week.splitWeekId} className="px-3 py-2 text-center font-medium">
                    S{week.weekSequenceNumber}
                  </th>
                ))}
                <th className="px-3 py-2 text-center font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {accumulated.map((entry) => (
                <tr key={entry.factionId} className="border-b border-border">
                  <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-medium">{entry.rank}</td>
                  <td className="sticky left-10 z-10 bg-surface px-3 py-2 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="h-3 w-3 rounded-full border border-border-strong" style={{ backgroundColor: entry.color }} />
                      {entry.name}
                    </span>
                  </td>
                  {weeks.map((week) => (
                    <td key={week.splitWeekId} className="px-3 py-2 text-center text-text-muted">
                      {entry.scoreByWeek.get(week.splitWeekId) ?? "—"}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-semibold">{formatPoints(entry.totalScore)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
