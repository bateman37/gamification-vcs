import Link from "next/link";
import { formatPoints } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import type { SplitClassification } from "@/server/services/classification.service";

/** Bloque "Clasificacion general" bajo el calendario de semanas (seccion 9.2 de docs/RESULTS_PUBLICATION.md). */
export function ClassificationSummarySection({ splitId, classification }: { splitId: string; classification: SplitClassification }) {
  const { weeks, entries } = classification;

  return (
    <section id="clasificacion-general-individual" className="scroll-mt-20 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Clasificacion general individual</h2>
        <Link href={`/splits/${splitId}/clasificacion`} className="text-sm font-medium text-ink underline hover:text-ink">
          Ver clasificacion detallada
        </Link>
      </div>

      {entries.length === 0 ? (
        <EmptyState>Todavia no hay ninguna semana publicada en este split.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-canvas text-text-muted">
              <tr>
                <th className="sticky left-0 z-10 bg-canvas px-3 py-2 font-medium">Pos.</th>
                <th className="sticky left-10 z-10 bg-canvas px-3 py-2 font-medium">Alias</th>
                <th className="px-3 py-2 font-medium">Nombre real</th>
                {weeks.map((week) => (
                  <th key={week.splitWeekId} className="px-3 py-2 text-center font-medium">
                    S{week.weekSequenceNumber}
                  </th>
                ))}
                <th className="px-3 py-2 text-center font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.splitParticipantId} className="border-b border-border">
                  <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-medium">{entry.rank}</td>
                  <td className="sticky left-10 z-10 bg-surface px-3 py-2 font-medium">{entry.alias}</td>
                  <td className="px-3 py-2 text-text-muted">{entry.fullName}</td>
                  {weeks.map((week) => (
                    <td key={week.splitWeekId} className="px-3 py-2 text-center text-text-muted">
                      {entry.pointsByWeek.get(week.splitWeekId) ?? "—"}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-semibold">{formatPoints(entry.totalPositionPoints)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
