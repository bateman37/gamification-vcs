import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  getPersonSplitDetail,
  listSplitsWithPublishedResultsForPerson,
} from "@/server/services/individual-results.service";
import { computeSplitClassification } from "@/server/services/classification.service";
import { formatPoints } from "@/lib/format";
import { formatCalendarDate } from "@/lib/dates";
import { EmptyState } from "@/components/ui";
import { colorBandForPercentage, COLOR_BAND_CLASSES, NOT_APPLICABLE_COLOR_BAND } from "@/domain/color-bands";
import { resolveKpiResultDisplayPoints } from "@/domain/kpi-outcome-display";
import { SplitSelector } from "./SplitSelector";
import { LimitedClassificationTable } from "./LimitedClassificationTable";

export async function PorSplitSection({
  personId,
  requestedSplitId,
  isAdmin,
}: {
  personId: string;
  requestedSplitId: string | null;
  isAdmin: boolean;
}) {
  const splits = await listSplitsWithPublishedResultsForPerson(prisma, personId);
  if (splits.length === 0) {
    return <EmptyState>Esta persona todavia no tiene ninguna semana publicada.</EmptyState>;
  }

  const selectedSplitId = requestedSplitId && splits.some((split) => split.splitId === requestedSplitId) ? requestedSplitId : splits[0]!.splitId;
  const detail = await getPersonSplitDetail(prisma, personId, selectedSplitId);
  if (!detail) {
    return <EmptyState>No se encontraron resultados publicados para este split.</EmptyState>;
  }

  const classification = await computeSplitClassification(prisma, selectedSplitId);

  return (
    <div className="space-y-6">
      <SplitSelector splits={splits} selectedSplitId={selectedSplitId} personId={isAdmin ? personId : null} />

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold">{detail.splitName}</h2>
        <dl className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">Posicion actual</dt>
            <dd className="font-semibold">
              {detail.currentRank ?? "—"} de {detail.rankedParticipantCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Puntos de posicion acumulados</dt>
            <dd className="font-semibold">{formatPoints(detail.totalPositionPoints)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Total puntos KPI publicados</dt>
            <dd className="font-semibold">{formatPoints(detail.totalKpiPoints)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Semanas publicadas</dt>
            <dd className="font-semibold">{detail.weeks.length}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Evolucion semana a semana</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Semana</th>
                {detail.weeks[0]?.kpiCells.map((cell) => (
                  <th key={cell.kpiCode} className="px-3 py-2 text-center font-medium">
                    {cell.kpiName}
                  </th>
                ))}
                <th className="px-3 py-2 text-center font-medium">Total KPI</th>
                <th className="px-3 py-2 text-center font-medium">% del maximo</th>
                <th className="px-3 py-2 text-center font-medium">Posicion semanal</th>
                <th className="px-3 py-2 text-center font-medium">Puntos por posicion</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {detail.weeks.map((week) => {
                const percentage = week.applicableMaxPoints && week.applicableMaxPoints > 0 ? (week.totalKpiPoints / week.applicableMaxPoints) * 100 : null;
                return (
                  <tr key={week.splitWeekId} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium">S{week.weekSequenceNumber}</td>
                    {week.kpiCells.map((cell) => {
                      if (cell.status === "NOT_APPLICABLE") {
                        return (
                          <td key={cell.kpiCode} className={`px-3 py-2 text-center ${COLOR_BAND_CLASSES[NOT_APPLICABLE_COLOR_BAND.band]}`}>
                            No aplica
                          </td>
                        );
                      }
                      // VAC se muestra como el valor numerico 0, igual que cualquier otro cero (hotfix AVISO/0, ver docs/DECISIONS.md).
                      const cellPoints = resolveKpiResultDisplayPoints(cell.status, cell.finalPoints) ?? 0;
                      const cellPercentage = cell.baseMax && cell.baseMax > 0 ? (cellPoints / cell.baseMax) * 100 : 0;
                      const band = colorBandForPercentage(cellPercentage);
                      return (
                        <td key={cell.kpiCode} className={`px-3 py-2 text-center ${COLOR_BAND_CLASSES[band.band]}`}>
                          {formatPoints(cellPoints)}
                          <div className="text-xs text-slate-500">
                            {cell.kpiRank ?? "—"} de {cell.rankedParticipantCount ?? "—"}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center font-semibold">{formatPoints(week.totalKpiPoints)}</td>
                    <td className="px-3 py-2 text-center text-slate-600">{percentage === null ? "—" : `${formatPoints(percentage)} %`}</td>
                    <td className="px-3 py-2 text-center font-semibold">
                      {week.weeklyRank} de {week.rankedParticipantCount}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold">{week.positionPoints}</td>
                    <td className="px-3 py-2">
                      {isAdmin && (
                        <Link
                          href={`/splits/${detail.splitId}/weeks/${week.splitWeekId}/resultados`}
                          className="text-xs text-slate-600 underline hover:text-slate-900"
                        >
                          Ver semana
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">Publicada por ultima vez el {formatCalendarDate(detail.weeks.at(-1)!.publishedAt)}.</p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Clasificacion general del split</h3>
        <LimitedClassificationTable
          classification={classification}
          selfSplitParticipantId={classification.entries.find((entry) => entry.personId === personId)?.splitParticipantId ?? null}
        />
      </div>
    </div>
  );
}
