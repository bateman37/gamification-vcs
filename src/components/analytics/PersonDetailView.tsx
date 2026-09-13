import Link from "next/link";
import { Badge, SectionHeader, StatCard, TABLE_HEAD_ROW_CLASSES, TABLE_ROW_HOVER_CLASSES, TableContainer } from "@/components/ui";
import type { GamificationDisplayMode, PersonDetailSummary, PersonDetailWeekRow } from "@/domain/analytics";
import { formatDateEs, formatPercentEs, formatPointsEs, formatPpEs } from "./format";
import { TrendLineChart } from "./charts/TrendLineChart";
import { ANALYTICS_COLORS } from "./colors";

/**
 * Detalle de una persona (bloque 5, parte H6 del encargo): evolucion,
 * comparacion con el resto de su nivel, y desglose exacto de bonus por
 * semana con enlace administrativo a la publicacion original.
 */
export function PersonDetailView({
  summary,
  weeks,
  mode,
}: {
  summary: PersonDetailSummary;
  weeks: PersonDetailWeekRow[];
  mode: GamificationDisplayMode;
}) {
  const trendData = weeks
    .filter((w) => !w.excluded)
    .map((w) => ({ label: formatDateEs(w.weekStartDate), persona: w.indexNormalized, resto: w.restOfLevelAverage }));

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Nivel" value={summary.levels.length > 1 ? <Badge tone="amber">Varios niveles</Badge> : summary.levels[0] ?? "—"} />
        <StatCard label="Semanas válidas / excluidas" value={`${summary.validWeekCount} / ${summary.excludedWeekCount}`} />
        <StatCard label="Media semanal de puntos" value={formatPointsEs(summary.averageWeeklyPoints)} tone="primary" />
        <StatCard label="Índice KPI medio" value={formatPercentEs(summary.teamIndex)} tone="game" />
      </dl>

      <div className="rounded-card border border-border bg-surface p-4">
        <SectionHeader title="Evolución frente al resto de su nivel" description={`Modo: ${mode === "con" ? "con gamificación" : "sin gamificación"}. Media del resto: excluye a la propia persona.`} />
        <TrendLineChart
          data={trendData}
          series={[
            { key: "persona", name: "Esta persona (%)", color: ANALYTICS_COLORS.primary },
            { key: "resto", name: "Media del resto de su nivel (%)", color: ANALYTICS_COLORS.muted },
          ]}
        />
      </div>

      <div className="rounded-card border border-border bg-surface p-4">
        <SectionHeader title="Detalle semanal" description="Fecha, split, nivel, valores y exclusiones. Enlace a la publicación original para verificar el dato." />
        <TableContainer>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={TABLE_HEAD_ROW_CLASSES}>
                <th className="px-3 py-2">Semana</th>
                <th className="px-3 py-2">Split</th>
                <th className="px-3 py-2">Nivel</th>
                <th className="px-3 py-2">Puntos</th>
                <th className="px-3 py-2">Índice</th>
                <th className="px-3 py-2">Media del resto (N)</th>
                <th className="px-3 py-2">Diferencia</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Verificar</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={`${week.splitId}-${week.splitWeekId}`} className={TABLE_ROW_HOVER_CLASSES}>
                  <td className="px-3 py-2">{formatDateEs(week.weekStartDate)}</td>
                  <td className="px-3 py-2">{week.splitName}</td>
                  <td className="px-3 py-2">{week.levelSnapshot}</td>
                  <td className="px-3 py-2 tabular">{formatPointsEs(week.totalPointsValid)}</td>
                  <td className="px-3 py-2 tabular">{formatPercentEs(week.indexNormalized)}</td>
                  <td className="px-3 py-2 tabular">
                    {formatPercentEs(week.restOfLevelAverage)} ({week.restOfLevelCount})
                  </td>
                  <td className="px-3 py-2 tabular">{formatPpEs(week.diffPpVsRest)}</td>
                  <td className="px-3 py-2">{week.excluded ? <Badge tone="amber">Excluida ({week.decision})</Badge> : <Badge tone="green">Incluida</Badge>}</td>
                  <td className="px-3 py-2">
                    <Link href={`/splits/${week.splitId}/weeks/${week.splitWeekId}/resultados`} className="text-primary hover:underline">
                      Ver publicación
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      </div>

      <div className="rounded-card border border-border bg-surface p-4">
        <SectionHeader title="Base frente a puntos bonificados" description="Desglose por KPI y semana, con independencia del modo seleccionado." />
        <TableContainer>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={TABLE_HEAD_ROW_CLASSES}>
                <th className="px-3 py-2">Semana</th>
                <th className="px-3 py-2">KPI</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Base</th>
                <th className="px-3 py-2">Final</th>
                <th className="px-3 py-2">Profesión</th>
                <th className="px-3 py-2">Localización</th>
                <th className="px-3 py-2">Objetos</th>
              </tr>
            </thead>
            <tbody>
              {weeks.flatMap((week) =>
                week.cells
                  .filter((cell) => cell.status !== "NOT_APPLICABLE")
                  .map((cell) => (
                    <tr key={`${week.splitWeekId}-${cell.kpiCode}`} className={TABLE_ROW_HOVER_CLASSES}>
                      <td className="px-3 py-2">{formatDateEs(week.weekStartDate)}</td>
                      <td className="px-3 py-2">{cell.kpiName}</td>
                      <td className="px-3 py-2">
                        <Badge tone={cell.status === "COMPUTED" ? "green" : "amber"}>{cell.status === "COMPUTED" ? "Computado" : "Ausencia (VAC)"}</Badge>
                      </td>
                      <td className="px-3 py-2 tabular">{cell.basePoints !== null ? formatPointsEs(cell.basePoints) : "Dato base no disponible"}</td>
                      <td className="px-3 py-2 tabular">{formatPointsEs(cell.finalPoints)}</td>
                      <td className="px-3 py-2 tabular">{formatPointsEs(cell.professionBonusPoints)}</td>
                      <td className="px-3 py-2 tabular">{formatPointsEs(cell.locationBonusPoints)}</td>
                      <td className="px-3 py-2 tabular">{formatPointsEs(cell.equipmentBonusPoints)}</td>
                    </tr>
                  )),
              )}
            </tbody>
          </table>
        </TableContainer>
      </div>
    </div>
  );
}
