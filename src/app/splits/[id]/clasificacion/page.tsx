import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById } from "@/server/services/split.service";
import { countParticipantsForSplit } from "@/server/services/participant.service";
import { requireAdminSession } from "@/lib/session";
import { listKpiConfigsForSplit } from "@/server/services/kpi.service";
import { computeSplitClassification, computeSplitKpiClassification } from "@/server/services/classification.service";
import { KPI_CATALOG, KPI_CATALOG_LIST, type KpiCode } from "@/domain/kpis/catalog";
import { resolveKpiResultDisplayPoints } from "@/domain/kpi-outcome-display";
import { formatPoints } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import { ClassificationFilters } from "./ClassificationFilters";

interface DisplayRow {
  splitParticipantId: string;
  alias: string;
  fullName: string;
  level: string;
  publishedWeekCount: number;
  positionPoints: number;
  totalKpiPoints: number;
  /** Posicion general individual (solo relevante sin KPI seleccionado). */
  positionRank: number;
  /** Posicion dentro del KPI seleccionado (seccion 16.1): el mejor resultado es 1, VAC cuenta como 0, No aplica queda excluido. */
  kpiRank: number | null;
  kpiValue: number | null;
  kpiAverage: number | null;
}

type SortField = "posicion" | "totalKpi" | "kpi" | "media";

function buildSortHref(params: { splitId: string; selectedWeek: string; selectedKpi: string | null; field: SortField; currentField: string; currentDir: string }): string {
  const search = new URLSearchParams();
  search.set("semana", params.selectedWeek);
  if (params.selectedKpi) search.set("kpi", params.selectedKpi);
  search.set("orden", params.field);
  const nextDir = params.currentField === params.field && params.currentDir === "desc" ? "asc" : "desc";
  search.set("dir", nextDir);
  return `/splits/${params.splitId}/clasificacion?${search.toString()}`;
}

export default async function SplitClassificationPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { semana?: string; kpi?: string; orden?: string; dir?: string };
}) {
  await requireAdminSession();
  const split = await getSplitById(prisma, params.id);
  if (!split) notFound();
  const splitId = split.id;

  const [classification, kpiConfigs, splitParticipantCount] = await Promise.all([
    computeSplitClassification(prisma, split.id),
    listKpiConfigsForSplit(prisma, split.id),
    countParticipantsForSplit(prisma, split.id),
  ]);
  const activeKpiOptions = KPI_CATALOG_LIST.filter((entry) => kpiConfigs.some((config) => config.kpiCode === entry.code && config.isActive)).map(
    (entry) => ({ code: entry.code, name: entry.name }),
  );

  const selectedWeek = searchParams.semana ?? "acumulado";
  const selectedKpiCode = searchParams.kpi && activeKpiOptions.some((kpi) => kpi.code === searchParams.kpi) ? (searchParams.kpi as KpiCode) : null;
  // Seccion 16.1: con un KPI seleccionado, el orden predeterminado es su suma/resultado descendente (no la posicion general).
  const validSortFields: SortField[] = ["posicion", "totalKpi", "kpi", "media"];
  const requestedSort = searchParams.orden as SortField | undefined;
  const selectedSort: SortField = requestedSort && validSortFields.includes(requestedSort) ? requestedSort : selectedKpiCode ? "kpi" : "posicion";
  const selectedDir: "asc" | "desc" = searchParams.dir === "asc" ? "asc" : "desc";

  let rows: DisplayRow[];

  if (selectedWeek === "acumulado") {
    const kpiEntries = selectedKpiCode ? await computeSplitKpiClassification(prisma, split.id, selectedKpiCode, null) : null;
    const kpiByParticipant = new Map((kpiEntries ?? []).map((entry) => [entry.splitParticipantId, entry]));

    rows = classification.entries.map((entry) => {
      const kpiEntry = kpiByParticipant.get(entry.splitParticipantId);
      return {
        splitParticipantId: entry.splitParticipantId,
        alias: entry.alias,
        fullName: entry.fullName,
        level: "-",
        publishedWeekCount: entry.publishedWeekCount,
        positionPoints: entry.totalPositionPoints,
        totalKpiPoints: entry.totalKpiPoints,
        positionRank: entry.rank,
        kpiRank: kpiEntry?.rank ?? null,
        kpiValue: kpiEntry?.sum ?? null,
        kpiAverage: kpiEntry?.average ?? null,
      };
    });
  } else {
    const weekRows = await prisma.publishedParticipantWeeklyResult.findMany({
      where: { splitId, publication: { splitWeekId: selectedWeek } },
      include: { kpiResults: true },
    });
    rows = weekRows.map((row) => {
      const kpiResult = selectedKpiCode ? row.kpiResults.find((result) => result.kpiCode === selectedKpiCode) : undefined;
      return {
        splitParticipantId: row.splitParticipantId,
        alias: row.aliasSnapshot,
        fullName: row.fullNameSnapshot,
        level: row.levelSnapshot,
        publishedWeekCount: 1,
        positionPoints: row.positionPoints,
        totalKpiPoints: row.totalKpiPoints.toNumber(),
        positionRank: row.weeklyRank,
        kpiRank: kpiResult?.kpiRank ?? null,
        // VAC se muestra como el valor numerico 0, igual que cualquier otro cero (hotfix AVISO/0, ver docs/DECISIONS.md).
        kpiValue: kpiResult ? resolveKpiResultDisplayPoints(kpiResult.outcomeStatus, kpiResult.finalPoints?.toNumber() ?? null) : null,
        kpiAverage: null,
      };
    });
  }

  // El orden visual de filas (seccion 16.2) nunca altera "Posicion"/"Posicion KPI", que siguen mostrando el rango funcional calculado arriba.
  const dirFactor = selectedDir === "asc" ? 1 : -1;
  const tiebreak = (a: DisplayRow, b: DisplayRow) => a.alias.localeCompare(b.alias, "es") || a.splitParticipantId.localeCompare(b.splitParticipantId);
  rows = [...rows].sort((a, b) => {
    let cmp = 0;
    if (selectedSort === "totalKpi") cmp = (a.totalKpiPoints - b.totalKpiPoints) * dirFactor;
    else if (selectedSort === "kpi" && selectedKpiCode) cmp = ((a.kpiValue ?? Number.NEGATIVE_INFINITY) - (b.kpiValue ?? Number.NEGATIVE_INFINITY)) * dirFactor;
    else if (selectedSort === "media" && selectedKpiCode) cmp = ((a.kpiAverage ?? Number.NEGATIVE_INFINITY) - (b.kpiAverage ?? Number.NEGATIVE_INFINITY)) * dirFactor;
    else cmp = (a.positionPoints - b.positionPoints) * dirFactor;
    return cmp !== 0 ? cmp : tiebreak(a, b);
  });

  function sortHeader(field: SortField, label: string) {
    const isActive = selectedSort === field;
    const href = buildSortHref({ splitId, selectedWeek, selectedKpi: selectedKpiCode, field, currentField: selectedSort, currentDir: selectedDir });
    return (
      <th
        className="px-3 py-2 text-center font-medium"
        aria-sort={isActive ? (selectedDir === "asc" ? "ascending" : "descending") : "none"}
      >
        <Link href={href} className="hover:underline">
          {label}
          {isActive ? (selectedDir === "asc" ? " ↑" : " ↓") : ""}
        </Link>
      </th>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/splits/${splitId}`} className="text-sm text-text-muted underline hover:text-ink">
          Volver al split
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Clasificación detallada individual - {split.name}</h1>
      </div>

      <ClassificationFilters
        weeks={classification.weeks}
        kpis={activeKpiOptions}
        selectedWeek={selectedWeek}
        selectedKpi={selectedKpiCode ?? "todos"}
      />

      {rows.length === 0 ? (
        <EmptyState>No hay datos publicados para este filtro.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-canvas text-text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">{selectedKpiCode ? "Posición KPI" : "Posición"}</th>
                <th className="px-3 py-2 font-medium">Nombre real</th>
                <th className="px-3 py-2 font-medium">Alias</th>
                <th className="px-3 py-2 font-medium">Nivel</th>
                <th className="px-3 py-2 text-center font-medium">Semanas publicadas</th>
                {sortHeader("posicion", "Puntos por posicion")}
                {sortHeader("totalKpi", "Total KPI")}
                {selectedKpiCode && (
                  <>
                    {sortHeader("kpi", `${selectedWeek === "acumulado" ? "Suma" : "Resultado"} ${KPI_CATALOG[selectedKpiCode].name}`)}
                    {selectedWeek === "acumulado" && sortHeader("media", "Media")}
                    <th className="px-3 py-2 text-center font-medium">Posición en el KPI</th>
                    <th className="px-3 py-2 font-medium">Enlace</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.splitParticipantId} className="border-b border-border">
                  <td className="px-3 py-2 font-medium">
                    {selectedKpiCode ? (row.kpiRank ?? "—") : row.positionRank} de {splitParticipantCount}
                  </td>
                  <td className="px-3 py-2 text-text-muted">{row.fullName}</td>
                  <td className="px-3 py-2 font-medium">{row.alias}</td>
                  <td className="px-3 py-2 text-text-muted">{row.level}</td>
                  <td className="px-3 py-2 text-center">{row.publishedWeekCount}</td>
                  <td className="px-3 py-2 text-center font-semibold">{formatPoints(row.positionPoints)}</td>
                  <td className="px-3 py-2 text-center">{formatPoints(row.totalKpiPoints)}</td>
                  {selectedKpiCode && (
                    <>
                      <td className="px-3 py-2 text-center">{row.kpiValue === null ? "—" : formatPoints(row.kpiValue)}</td>
                      {selectedWeek === "acumulado" && (
                        <td className="px-3 py-2 text-center">{row.kpiAverage === null ? "—" : formatPoints(row.kpiAverage)}</td>
                      )}
                      <td className="px-3 py-2 text-center">
                        {row.kpiRank === null ? "—" : `${row.kpiRank} de ${splitParticipantCount}`}
                      </td>
                      <td className="px-3 py-2">
                        {selectedWeek !== "acumulado" && (
                          <Link
                            href={`/splits/${splitId}/weeks/${selectedWeek}/resultados`}
                            className="text-xs text-text-muted underline hover:text-ink"
                          >
                            Ver semana
                          </Link>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
