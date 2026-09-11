import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  getPersonSplitDetail,
  listSplitsWithPublishedResultsForPerson,
} from "@/server/services/individual-results.service";
import { computeSplitClassification } from "@/server/services/classification.service";
import { computeFactionClassification } from "@/server/services/faction-classification.service";
import { formatPoints } from "@/lib/format";
import { formatCalendarDate, formatCalendarDateEs } from "@/lib/dates";
import { PROFESSION_BONUS_PERCENT } from "@/domain/profession-bonus";
import { EmptyState } from "@/components/ui";
import { colorBandForPercentage, COLOR_BAND_CLASSES, NOT_APPLICABLE_COLOR_BAND } from "@/domain/color-bands";
import { resolveKpiResultDisplayPoints } from "@/domain/kpi-outcome-display";
import { SplitSelector } from "./SplitSelector";
import { LimitedClassificationTable } from "./LimitedClassificationTable";
import { LimitedFactionClassificationTable } from "./LimitedFactionClassificationTable";

export async function PorSplitSection({
  personId,
  requestedSplitId,
  isAdmin,
  factionWeek,
}: {
  personId: string;
  requestedSplitId: string | null;
  isAdmin: boolean;
  factionWeek: string | null;
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
  const factionClassification = await computeFactionClassification(prisma, selectedSplitId);
  // Solo se muestra la columna si alguna semana publicada usaba profesiones: una publicacion
  // anterior a `0.8.0` (o un split sin profesiones) se sigue viendo exactamente como antes.
  const showProfessionColumn = detail.weeks.some((week) => week.splitUsedProfessions);

  return (
    <div className="space-y-6">
      <SplitSelector splits={splits} selectedSplitId={selectedSplitId} personId={isAdmin ? personId : null} />

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold">{detail.splitName}</h2>
        <dl className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">Posicion actual</dt>
            <dd className="font-semibold">
              {detail.currentRank ?? "—"} de {detail.splitParticipantCount}
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
          {detail.currentFaction && (
            <div>
              <dt className="text-xs text-slate-500">Tu faccion</dt>
              <dd className="font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-3 w-3 rounded-full border border-slate-300" style={{ backgroundColor: detail.currentFaction.color }} />
                  {detail.currentFaction.name}
                </span>
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Evolucion semana a semana</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Semana</th>
                {showProfessionColumn && <th className="px-3 py-2 font-medium">Profesion</th>}
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
                    <td className="px-3 py-2 font-medium">
                      S{week.weekSequenceNumber}
                      <span className="block text-xs font-normal text-slate-500">{formatCalendarDateEs(week.weekStartDate)}</span>
                    </td>
                    {showProfessionColumn && (
                      <td className="px-3 py-2 text-slate-600">
                        {week.profession ? (
                          <>
                            <span className="font-medium text-slate-800">{week.profession.name}</span>
                            {week.profession.kpiNames && <span className="block text-xs text-slate-500">{week.profession.kpiNames}</span>}
                            {week.professionBonusTotal > 0 && (
                              <span className="block text-xs text-indigo-700">+{formatPoints(week.professionBonusTotal)} por profesion</span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    )}
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
                      // El porcentaje usa el maximo base publicado, sin inflar por profesion: puede superar el 100 %.
                      const cellPercentage = cell.baseMax && cell.baseMax > 0 ? (cellPoints / cell.baseMax) * 100 : 0;
                      const band = colorBandForPercentage(cellPercentage);
                      const bonusApplied =
                        cell.professionApplied && cell.basePointsBeforeProfession !== null && cell.professionBonusPoints !== null;
                      const breakdown = bonusApplied
                        ? `Resultado tras maximo: ${formatPoints(cell.basePointsBeforeProfession!)} | Bonus ${
                            cell.professionName ?? "profesion"
                          } (+${PROFESSION_BONUS_PERCENT} %): +${formatPoints(cell.professionBonusPoints!)} | Resultado final: ${formatPoints(cellPoints)}`
                        : undefined;
                      return (
                        <td
                          key={cell.kpiCode}
                          title={breakdown}
                          className={`px-3 py-2 text-center ${COLOR_BAND_CLASSES[band.band]} ${
                            bonusApplied ? "border-2 border-dashed border-indigo-500" : ""
                          }`}
                        >
                          {formatPoints(cellPoints)}
                          {bonusApplied && (
                            <>
                              <span className="mt-1 block rounded bg-indigo-100 px-1 py-0.5 text-[10px] font-semibold text-indigo-800">
                                +{PROFESSION_BONUS_PERCENT} % profesion
                              </span>
                              <span className="sr-only"> ({breakdown})</span>
                            </>
                          )}
                          <div className="text-xs text-slate-500">
                            {cell.kpiRank ?? "—"} de {detail.splitParticipantCount}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center font-semibold">{formatPoints(week.totalKpiPoints)}</td>
                    <td className="px-3 py-2 text-center text-slate-600">{percentage === null ? "—" : `${formatPoints(percentage)} %`}</td>
                    <td className="px-3 py-2 text-center font-semibold">
                      {week.weeklyRank} de {detail.splitParticipantCount}
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

      {factionClassification.hasFactionData && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Clasificacion general de facciones</h3>
          <LimitedFactionClassificationTable
            classification={factionClassification}
            selfFactionId={detail.currentFaction?.id ?? null}
            splitId={selectedSplitId}
            selectedWeek={factionWeek}
          />
        </div>
      )}
    </div>
  );
}
