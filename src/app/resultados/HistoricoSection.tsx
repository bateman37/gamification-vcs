import { prisma } from "@/lib/prisma";
import { getPersonHistory, type HistoryGrouping } from "@/server/services/individual-results.service";
import { formatPoints } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import { colorBandForPercentage, COLOR_BAND_CLASSES } from "@/domain/color-bands";
import { HistoryFilters } from "./HistoryFilters";

const VALID_GROUPINGS: HistoryGrouping[] = ["semana", "mes", "año"];

export async function HistoricoSection({
  personId,
  isAdmin,
  searchParams,
}: {
  personId: string;
  isAdmin: boolean;
  searchParams: { anio?: string; splitFiltro?: string; agrupacion?: string };
}) {
  const grouping: HistoryGrouping = VALID_GROUPINGS.includes(searchParams.agrupacion as HistoryGrouping)
    ? (searchParams.agrupacion as HistoryGrouping)
    : "semana";
  const year = searchParams.anio && searchParams.anio !== "todos" ? Number(searchParams.anio) : "todos";
  const splitId = searchParams.splitFiltro && searchParams.splitFiltro !== "todos" ? searchParams.splitFiltro : "todos";

  const history = await getPersonHistory(prisma, personId, { year, splitId, grouping });

  return (
    <div className="space-y-4">
      <HistoryFilters
        years={history.availableYears}
        splits={history.availableSplits}
        selectedYear={year === "todos" ? "todos" : String(year)}
        selectedSplitId={splitId}
        selectedGrouping={grouping}
        personId={isAdmin ? personId : null}
      />

      {history.groups.length === 0 ? (
        <EmptyState>No hay semanas publicadas para este filtro.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="sticky left-0 z-10 whitespace-normal bg-slate-50 px-3 py-2 font-medium">Periodo</th>
                {history.availableKpis.map((kpi) => (
                  <th key={kpi.code} className="whitespace-normal px-3 py-2 text-center font-medium">
                    {kpi.name}
                  </th>
                ))}
                <th className="px-3 py-2 text-center font-medium">Semanas publicadas</th>
                <th className="px-3 py-2 text-center font-medium">Suma puntos KPI</th>
                <th className="px-3 py-2 text-center font-medium">Media puntos KPI</th>
                <th className="px-3 py-2 text-center font-medium">Suma puntos por posicion</th>
              </tr>
            </thead>
            <tbody>
              {history.groups.map((group) => {
                const kpiByCode = new Map(group.perKpi.map((kpi) => [kpi.kpiCode, kpi]));
                return (
                  <tr key={group.periodKey} className="border-b border-slate-100 align-top">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium">
                      {group.periodLabel}
                      {group.periodSecondaryLabel && (
                        <span className="block text-xs font-normal text-slate-500">{group.periodSecondaryLabel}</span>
                      )}
                    </td>
                    {history.availableKpis.map((kpi) => {
                      const cell = kpiByCode.get(kpi.code);
                      if (!cell) {
                        return (
                          <td key={kpi.code} className="px-3 py-2 text-center text-slate-400">
                            —
                          </td>
                        );
                      }
                      const bandClass = cell.percentageOfMax === null ? "" : COLOR_BAND_CLASSES[colorBandForPercentage(cell.percentageOfMax).band];
                      return (
                        <td key={kpi.code} className={`px-3 py-2 text-center ${bandClass}`}>
                          <div className="font-semibold">{formatPoints(cell.sum)}</div>
                          <div className="text-xs opacity-80">media {formatPoints(cell.average)}</div>
                          {cell.professionBonusSum > 0 && (
                            <div className="text-xs font-medium text-indigo-800">
                              +{formatPoints(cell.professionBonusSum)} por profesion
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center">{group.publishedWeekCount}</td>
                    <td className="px-3 py-2 text-center font-semibold">
                      {formatPoints(group.sumKpiPoints)}
                      {group.professionBonusSum > 0 && (
                        <span className="block text-xs font-medium text-indigo-800">
                          Bonus profesion: {formatPoints(group.professionBonusSum)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">{formatPoints(group.averageKpiPoints)}</td>
                    <td className="px-3 py-2 text-center font-semibold">{formatPoints(group.sumPositionPoints)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
