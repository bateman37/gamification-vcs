import { prisma } from "@/lib/prisma";
import { getPersonHistory, type HistoryGrouping } from "@/server/services/individual-results.service";
import { formatPoints } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import { colorBandForPercentage, COLOR_BAND_CLASSES } from "@/domain/color-bands";
import { resolveGamificationDisplayTotal, computeGamificationImpact, type GamificationMode } from "@/domain/gamification-view";
import { resolveHistoryDisplayConfig } from "@/domain/history-display";
import { HistoryFilters } from "./HistoryFilters";

const MEDIA_HELP_ID = "historico-media-ayuda";

const VALID_GROUPINGS: HistoryGrouping[] = ["semana", "mes", "año"];

function groupBonusSum(group: { professionBonusSum: number; locationBonusSum: number; equipmentBonusSum: number }): number {
  return group.professionBonusSum + group.locationBonusSum + group.equipmentBonusSum;
}

export async function HistoricoSection({
  personId,
  isAdmin,
  searchParams,
  gamificationMode,
}: {
  personId: string;
  isAdmin: boolean;
  searchParams: { anio?: string; splitFiltro?: string; agrupacion?: string };
  gamificationMode: GamificationMode;
}) {
  const grouping: HistoryGrouping = VALID_GROUPINGS.includes(searchParams.agrupacion as HistoryGrouping)
    ? (searchParams.agrupacion as HistoryGrouping)
    : "semana";
  const year = searchParams.anio && searchParams.anio !== "todos" ? Number(searchParams.anio) : "todos";
  const splitId = searchParams.splitFiltro && searchParams.splitFiltro !== "todos" ? searchParams.splitFiltro : "todos";

  const history = await getPersonHistory(prisma, personId, { year, splitId, grouping });
  const display = resolveHistoryDisplayConfig(grouping);

  return (
    <div className="space-y-4">
      <HistoryFilters
        years={history.availableYears}
        splits={history.availableSplits}
        selectedYear={year === "todos" ? "todos" : String(year)}
        selectedSplitId={splitId}
        selectedGrouping={grouping}
        personId={isAdmin ? personId : null}
        gamificationMode={gamificationMode}
      />

      {history.groups.length === 0 ? (
        <EmptyState>No hay semanas publicadas para este filtro.</EmptyState>
      ) : (
        <>
          {display.helpNote && (
            <p id={MEDIA_HELP_ID} className="text-xs text-text-muted">
              {display.helpNote}
            </p>
          )}
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-canvas text-text-muted">
              <tr>
                <th className="sticky left-0 z-10 whitespace-normal bg-canvas px-3 py-2 font-medium">Periodo</th>
                {history.availableKpis.map((kpi) => (
                  <th key={kpi.code} className="whitespace-normal px-3 py-2 text-center font-medium">
                    {kpi.name}
                  </th>
                ))}
                {display.showPublishedWeeksColumn && <th className="px-3 py-2 text-center font-medium">Semanas publicadas</th>}
                <th className="px-3 py-2 text-center font-medium">Suma total KPI{gamificationMode === "sin" ? " (reales)" : ""}</th>
                {display.showAverageKpiColumn && (
                  <th className="px-3 py-2 text-center font-medium" aria-describedby={display.helpNote ? MEDIA_HELP_ID : undefined}>
                    {display.averageKpiColumnHeader}
                  </th>
                )}
                <th className="px-3 py-2 text-center font-medium">Suma puntos por posición</th>
                <th className="px-3 py-2 text-center font-medium">Créditos oficiales</th>
              </tr>
            </thead>
            <tbody>
              {history.groups.map((group) => {
                const kpiByCode = new Map(group.perKpi.map((kpi) => [kpi.kpiCode, kpi]));
                return (
                  <tr key={group.periodKey} className="border-b border-border align-top">
                    <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-medium">
                      {group.periodLabel}
                      {group.periodSecondaryLabel && (
                        <span className="block text-xs font-normal text-text-muted">{group.periodSecondaryLabel}</span>
                      )}
                    </td>
                    {history.availableKpis.map((kpi) => {
                      const cell = kpiByCode.get(kpi.code);
                      if (!cell) {
                        return (
                          <td key={kpi.code} className="px-3 py-2 text-center text-text-muted">
                            —
                          </td>
                        );
                      }
                      const cellBonusSum = cell.professionBonusSum + cell.locationBonusSum + cell.equipmentBonusSum;
                      const cellSum = resolveGamificationDisplayTotal(gamificationMode, cell.sum, cellBonusSum);
                      const cellAverage = cell.includedWeekCount > 0 ? cellSum / cell.includedWeekCount : 0;
                      const cellPercentage =
                        gamificationMode === "con" || cell.percentageOfMax === null
                          ? cell.percentageOfMax
                          : cell.sum > 0
                            ? (cellSum / cell.sum) * cell.percentageOfMax
                            : 0;
                      const bandClass = cellPercentage === null ? "" : COLOR_BAND_CLASSES[colorBandForPercentage(cellPercentage).band];
                      return (
                        <td key={kpi.code} className={`px-3 py-2 text-center ${bandClass}`}>
                          <div className="font-semibold">{formatPoints(cellSum)}</div>
                          {display.showPerKpiAverage && (
                            <div className="text-xs opacity-80">Media semanal: {formatPoints(cellAverage)}</div>
                          )}
                          {gamificationMode === "con" && cell.professionBonusSum > 0 && (
                            <div className="text-xs font-medium text-game-ink">
                              +{formatPoints(cell.professionBonusSum)} por profesión
                            </div>
                          )}
                          {gamificationMode === "con" && cell.locationBonusSum > 0 && (
                            <div className="text-xs font-medium text-info-ink">
                              +{formatPoints(cell.locationBonusSum)} localización
                            </div>
                          )}
                          {gamificationMode === "con" && cell.equipmentBonusSum > 0 && (
                            <div className="text-xs font-medium text-reward-ink">+{formatPoints(cell.equipmentBonusSum)} objetos</div>
                          )}
                        </td>
                      );
                    })}
                    {display.showPublishedWeeksColumn && <td className="px-3 py-2 text-center">{group.publishedWeekCount}</td>}
                    <td className="px-3 py-2 text-center font-semibold">
                      {formatPoints(resolveGamificationDisplayTotal(gamificationMode, group.sumKpiPoints, groupBonusSum(group)))}
                      {gamificationMode === "con" && group.professionBonusSum > 0 && (
                        <span className="block text-xs font-medium text-game-ink">
                          Bonus profesión: {formatPoints(group.professionBonusSum)}
                        </span>
                      )}
                      {gamificationMode === "con" && group.locationBonusSum > 0 && (
                        <span className="block text-xs font-medium text-info-ink">
                          +{formatPoints(group.locationBonusSum)} localización
                        </span>
                      )}
                      {gamificationMode === "con" && group.equipmentBonusSum > 0 && (
                        <span className="block text-xs font-medium text-reward-ink">+{formatPoints(group.equipmentBonusSum)} objetos</span>
                      )}
                      {gamificationMode === "sin" && groupBonusSum(group) > 0 && (
                        <span className="block text-xs font-normal text-text-muted">
                          Impacto: +
                          {formatPoints(
                            computeGamificationImpact(
                              group.sumKpiPoints,
                              resolveGamificationDisplayTotal(gamificationMode, group.sumKpiPoints, groupBonusSum(group)),
                            ),
                          )}
                        </span>
                      )}
                    </td>
                    {display.showAverageKpiColumn && (
                      <td className="px-3 py-2 text-center">
                        {formatPoints(
                          group.publishedWeekCount > 0
                            ? resolveGamificationDisplayTotal(gamificationMode, group.sumKpiPoints, groupBonusSum(group)) / group.publishedWeekCount
                            : 0,
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2 text-center font-semibold">{formatPoints(group.sumPositionPoints)}</td>
                    <td className="px-3 py-2 text-center font-semibold">{group.creditsEarnedSum}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
