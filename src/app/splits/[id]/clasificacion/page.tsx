import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById } from "@/server/services/split.service";
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
  positionRank: number;
  kpiValue: number | null;
  kpiAverage: number | null;
  kpiRank: number | null;
  kpiRankedCount: number | null;
}

export default async function SplitClassificationPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { semana?: string; kpi?: string; orden?: string };
}) {
  await requireAdminSession();
  const split = await getSplitById(prisma, params.id);
  if (!split) notFound();

  const [classification, kpiConfigs] = await Promise.all([
    computeSplitClassification(prisma, split.id),
    listKpiConfigsForSplit(prisma, split.id),
  ]);
  const activeKpiOptions = KPI_CATALOG_LIST.filter((entry) => kpiConfigs.some((config) => config.kpiCode === entry.code && config.isActive)).map(
    (entry) => ({ code: entry.code, name: entry.name }),
  );

  const selectedWeek = searchParams.semana ?? "acumulado";
  const selectedKpiCode = searchParams.kpi && activeKpiOptions.some((kpi) => kpi.code === searchParams.kpi) ? (searchParams.kpi as KpiCode) : null;
  const selectedOrder = searchParams.orden ?? "posicion";

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
        kpiValue: kpiEntry?.sum ?? null,
        kpiAverage: kpiEntry?.average ?? null,
        kpiRank: kpiEntry?.rank ?? null,
        kpiRankedCount: kpiEntries?.length ?? null,
      };
    });
  } else {
    const weekRows = await prisma.publishedParticipantWeeklyResult.findMany({
      where: { splitId: split.id, publication: { splitWeekId: selectedWeek } },
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
        // VAC se muestra como el valor numerico 0, igual que cualquier otro cero (hotfix AVISO/0, ver docs/DECISIONS.md).
        kpiValue: kpiResult ? resolveKpiResultDisplayPoints(kpiResult.outcomeStatus, kpiResult.finalPoints?.toNumber() ?? null) : null,
        kpiAverage: null,
        kpiRank: kpiResult?.kpiRank ?? null,
        kpiRankedCount: kpiResult?.rankedParticipantCount ?? null,
      };
    });
  }

  if (selectedOrder === "totalKpi") {
    rows = [...rows].sort((a, b) => b.totalKpiPoints - a.totalKpiPoints);
  } else if (selectedOrder === "kpi" && selectedKpiCode) {
    rows = [...rows].sort((a, b) => (b.kpiValue ?? Number.NEGATIVE_INFINITY) - (a.kpiValue ?? Number.NEGATIVE_INFINITY));
  } else {
    rows = [...rows].sort((a, b) => a.positionRank - b.positionRank);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/splits/${split.id}`} className="text-sm text-slate-600 underline hover:text-slate-900">
          Volver al split
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Clasificacion detallada - {split.name}</h1>
      </div>

      <ClassificationFilters
        weeks={classification.weeks}
        kpis={activeKpiOptions}
        selectedWeek={selectedWeek}
        selectedKpi={selectedKpiCode ?? "todos"}
        selectedOrder={selectedOrder}
      />

      {rows.length === 0 ? (
        <EmptyState>No hay datos publicados para este filtro.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Posicion</th>
                <th className="px-3 py-2 font-medium">Nombre real</th>
                <th className="px-3 py-2 font-medium">Alias</th>
                <th className="px-3 py-2 font-medium">Nivel</th>
                <th className="px-3 py-2 text-center font-medium">Semanas publicadas</th>
                <th className="px-3 py-2 text-center font-medium">Puntos por posicion</th>
                <th className="px-3 py-2 text-center font-medium">Total KPI</th>
                {selectedKpiCode && (
                  <>
                    <th className="px-3 py-2 text-center font-medium">
                      {selectedWeek === "acumulado" ? "Suma" : "Resultado"} {KPI_CATALOG[selectedKpiCode].name}
                    </th>
                    {selectedWeek === "acumulado" && <th className="px-3 py-2 text-center font-medium">Media</th>}
                    <th className="px-3 py-2 text-center font-medium">Posicion en el KPI</th>
                    <th className="px-3 py-2 font-medium">Enlace</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.splitParticipantId} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium">{row.positionRank}</td>
                  <td className="px-3 py-2 text-slate-600">{row.fullName}</td>
                  <td className="px-3 py-2 font-medium">{row.alias}</td>
                  <td className="px-3 py-2 text-slate-600">{row.level}</td>
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
                        {row.kpiRank === null ? "—" : `${row.kpiRank} de ${row.kpiRankedCount}`}
                      </td>
                      <td className="px-3 py-2">
                        {selectedWeek !== "acumulado" && (
                          <Link
                            href={`/splits/${split.id}/weeks/${selectedWeek}/resultados`}
                            className="text-xs text-slate-600 underline hover:text-slate-900"
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
