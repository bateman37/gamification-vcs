import { prisma } from "@/lib/prisma";
import { getPersonHistory, type HistoryGrouping } from "@/server/services/individual-results.service";
import { formatPoints } from "@/lib/format";
import { EmptyState } from "@/components/ui";
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
                <th className="px-3 py-2 font-medium">Periodo</th>
                <th className="px-3 py-2 text-center font-medium">Semanas publicadas</th>
                <th className="px-3 py-2 text-center font-medium">Suma puntos KPI</th>
                <th className="px-3 py-2 text-center font-medium">Media puntos KPI</th>
                <th className="px-3 py-2 text-center font-medium">Suma puntos por posicion</th>
                <th className="px-3 py-2 font-medium">Desglose por KPI (suma / media / VAC)</th>
              </tr>
            </thead>
            <tbody>
              {history.groups.map((group) => (
                <tr key={group.periodKey} className="border-b border-slate-100 align-top">
                  <td className="px-3 py-2 font-medium">{group.periodLabel}</td>
                  <td className="px-3 py-2 text-center">{group.publishedWeekCount}</td>
                  <td className="px-3 py-2 text-center font-semibold">{formatPoints(group.sumKpiPoints)}</td>
                  <td className="px-3 py-2 text-center">{formatPoints(group.averageKpiPoints)}</td>
                  <td className="px-3 py-2 text-center font-semibold">{formatPoints(group.sumPositionPoints)}</td>
                  <td className="px-3 py-2">
                    <ul className="space-y-0.5 text-xs text-slate-600">
                      {group.perKpi.map((kpi) => (
                        <li key={kpi.kpiCode}>
                          {kpi.kpiName}: suma {formatPoints(kpi.sum)}, media {formatPoints(kpi.average)}
                          {kpi.vacCount > 0 && <span className="text-sky-700"> - {kpi.vacCount} VAC</span>}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
