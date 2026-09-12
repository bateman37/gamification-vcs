import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById } from "@/server/services/split.service";
import { requireAdminSession } from "@/lib/session";
import { computeFactionClassification } from "@/server/services/faction-classification.service";
import { formatPoints } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import { FactionClassificationFilters } from "./FactionClassificationFilters";

function FactionSwatch({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="h-3 w-3 rounded-full border border-border-strong" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}

export default async function FactionClassificationPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { semana?: string };
}) {
  await requireAdminSession();
  const split = await getSplitById(prisma, params.id);
  if (!split) notFound();

  const classification = await computeFactionClassification(prisma, split.id);
  const selectedWeek = searchParams.semana ?? "acumulado";
  const weekClassification = selectedWeek !== "acumulado" ? classification.weekClassifications.get(selectedWeek) ?? null : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/splits/${split.id}`} className="text-sm text-text-muted underline hover:text-ink">
          Volver al split
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Clasificación detallada de facciones - {split.name}</h1>
        <p className="mt-1 text-sm text-text-muted">
          Renombre = puntos por posicion. La puntuacion semanal de cada faccion es la suma de los tres mejores
          (nunca una media).
        </p>
      </div>

      {!classification.hasFactionData ? (
        <EmptyState>
          Todavía no hay clasificación de facciones publicada para este split. Configura al menos dos facciones y
          publica una semana para verla aqui.
        </EmptyState>
      ) : (
        <>
          <FactionClassificationFilters weeks={classification.weeks} selectedWeek={selectedWeek} />

          {selectedWeek === "acumulado" ? (
            <div className="overflow-x-auto rounded-card border border-border bg-surface">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-canvas text-text-muted">
                  <tr>
                    <th className="sticky left-0 z-10 bg-canvas px-3 py-2 font-medium">Pos.</th>
                    <th className="sticky left-10 z-10 bg-canvas px-3 py-2 font-medium">Facción</th>
                    {classification.weeks.map((week) => (
                      <th key={week.splitWeekId} className="px-3 py-2 text-center font-medium">
                        <Link href={`?semana=${week.splitWeekId}`} className="underline hover:text-ink">
                          S{week.weekSequenceNumber}
                        </Link>
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center font-medium">Total acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {classification.accumulated.map((entry) => (
                    <tr key={entry.factionId} className="border-b border-border">
                      <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-medium">{entry.rank}</td>
                      <td className="sticky left-10 z-10 bg-surface px-3 py-2 font-medium">
                        <FactionSwatch name={entry.name} color={entry.color} />
                      </td>
                      {classification.weeks.map((week) => (
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
          ) : !weekClassification ? (
            <EmptyState>No hay clasificacion de facciones publicada para esta semana.</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-card border border-border bg-surface">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-canvas text-text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Pos. semanal</th>
                    <th className="px-3 py-2 font-medium">Facción</th>
                    <th className="px-3 py-2 font-medium">1er participante</th>
                    <th className="px-3 py-2 font-medium">2o participante</th>
                    <th className="px-3 py-2 font-medium">3er participante</th>
                    <th className="px-3 py-2 text-center font-medium">Suma semanal</th>
                    <th className="px-3 py-2 text-center font-medium">Acumulado hasta S{weekClassification.weekSequenceNumber}</th>
                    <th className="px-3 py-2 text-center font-medium">Pos. acumulada</th>
                  </tr>
                </thead>
                <tbody>
                  {weekClassification.entries.map((entry) => (
                    <tr key={entry.factionId} className="border-b border-border">
                      <td className="px-3 py-2 font-medium">{entry.weeklyRank}</td>
                      <td className="px-3 py-2">
                        <FactionSwatch name={entry.name} color={entry.color} />
                      </td>
                      {[0, 1, 2].map((index) => {
                        const contributor = entry.topContributors[index];
                        return (
                          <td key={index} className="px-3 py-2 text-text-muted">
                            {contributor ? `${contributor.alias} (${formatPoints(contributor.positionPoints)})` : "—"}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center font-semibold">{formatPoints(entry.weeklyScore)}</td>
                      <td className="px-3 py-2 text-center">{formatPoints(entry.accumulatedScore)}</td>
                      <td className="px-3 py-2 text-center font-semibold">{entry.accumulatedRank}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
