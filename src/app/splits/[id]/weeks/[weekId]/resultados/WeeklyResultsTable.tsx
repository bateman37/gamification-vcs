"use client";

import { useMemo, useState } from "react";
import { formatPoints } from "@/lib/format";
import { colorBandForPercentage, COLOR_BAND_CLASSES, VAC_COLOR_BAND, NOT_APPLICABLE_COLOR_BAND } from "@/domain/color-bands";
import type { KpiResultStatus } from "@/server/services/weekly-results.service";

export interface ResultKpiCell {
  kpiCode: string;
  kpiName: string;
  status: KpiResultStatus;
  finalPoints: number | null;
  baseMax: number | null;
  capped: boolean;
  kpiRank: number | null;
  rankedParticipantCount: number | null;
}

export interface ResultRow {
  splitParticipantId: string;
  alias: string;
  fullName: string;
  level: string;
  kpiCells: ResultKpiCell[];
  totalKpiPoints: number;
  applicableMaxPoints: number | null;
  weeklyRank: number;
  positionPoints: number | null;
  rankedParticipantCount: number;
}

type SortKey = "position" | "alias" | "total" | `kpi:${string}`;

function KpiCellView({ cell }: { cell: ResultKpiCell }) {
  if (cell.status === "VAC") {
    return (
      <td className={`px-3 py-2 text-center ${COLOR_BAND_CLASSES[VAC_COLOR_BAND.band]}`} title="Vacaciones o sin dato en una carga confirmada">
        VAC
      </td>
    );
  }
  if (cell.status === "NOT_APPLICABLE") {
    return (
      <td className={`px-3 py-2 text-center ${COLOR_BAND_CLASSES[NOT_APPLICABLE_COLOR_BAND.band]}`} title="Este KPI no aplica a este nivel">
        No aplica
      </td>
    );
  }
  const percentage = cell.baseMax && cell.baseMax > 0 ? ((cell.finalPoints ?? 0) / cell.baseMax) * 100 : 0;
  const bandInfo = colorBandForPercentage(percentage);
  const title = `${formatPoints(percentage)} % del maximo${cell.capped ? " (limitado por el maximo)" : ""}`;
  return (
    <td className={`px-3 py-2 text-center font-medium ${COLOR_BAND_CLASSES[bandInfo.band]}`} title={title}>
      {formatPoints(cell.finalPoints ?? 0)}
      {cell.capped && <span aria-hidden="true"> *</span>}
      <span className="sr-only"> ({title})</span>
    </td>
  );
}

export function WeeklyResultsTable({ rows, activeKpis }: { rows: ResultRow[]; activeKpis: { code: string; name: string }[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("position");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "position") cmp = a.weeklyRank - b.weeklyRank;
      else if (sortKey === "alias") cmp = a.alias.localeCompare(b.alias, "es");
      else if (sortKey === "total") cmp = a.totalKpiPoints - b.totalKpiPoints;
      else {
        const kpiCode = sortKey.slice(4);
        const aCell = a.kpiCells.find((cell) => cell.kpiCode === kpiCode);
        const bCell = b.kpiCells.find((cell) => cell.kpiCode === kpiCode);
        const aValue = aCell?.finalPoints ?? Number.NEGATIVE_INFINITY;
        const bValue = bCell?.finalPoints ?? Number.NEGATIVE_INFINITY;
        cmp = aValue - bValue;
      }
      return cmp * sortDir;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(key === "position" ? 1 : -1);
    }
  }

  function headerButton(label: string, key: SortKey) {
    return (
      <button type="button" onClick={() => toggleSort(key)} className="font-medium hover:underline">
        {label}
        {sortKey === key ? (sortDir === 1 ? " ↑" : " ↓") : ""}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2">{headerButton("Alias", "alias")}</th>
              <th className="px-3 py-2 font-medium">Nombre real</th>
              <th className="px-3 py-2 font-medium">Nivel</th>
              {activeKpis.map((kpi) => (
                <th key={kpi.code} className="px-3 py-2 text-center">
                  {headerButton(kpi.name, `kpi:${kpi.code}`)}
                </th>
              ))}
              <th className="px-3 py-2 text-center">{headerButton("Total KPI", "total")}</th>
              <th className="px-3 py-2 text-center font-medium">% del maximo aplicable</th>
              <th className="px-3 py-2 text-center">{headerButton("Posicion", "position")}</th>
              <th className="px-3 py-2 text-center font-medium">Puntos por posicion</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const percentage = row.applicableMaxPoints && row.applicableMaxPoints > 0 ? (row.totalKpiPoints / row.applicableMaxPoints) * 100 : null;
              return (
                <tr key={row.splitParticipantId} className="border-b border-slate-100">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium">{row.alias}</td>
                  <td className="px-3 py-2 text-slate-600">{row.fullName}</td>
                  <td className="px-3 py-2 text-slate-600">{row.level}</td>
                  {activeKpis.map((kpi) => {
                    const cell = row.kpiCells.find((entry) => entry.kpiCode === kpi.code);
                    return cell ? <KpiCellView key={kpi.code} cell={cell} /> : <td key={kpi.code} className="px-3 py-2 text-center">-</td>;
                  })}
                  <td className="px-3 py-2 text-center font-semibold">{formatPoints(row.totalKpiPoints)}</td>
                  <td className="px-3 py-2 text-center text-slate-600">{percentage === null ? "—" : `${formatPoints(percentage)} %`}</td>
                  <td className="px-3 py-2 text-center font-semibold">
                    {row.weeklyRank} <span className="text-xs font-normal text-slate-500">de {row.rankedParticipantCount}</span>
                  </td>
                  <td className="px-3 py-2 text-center font-semibold">{row.positionPoints ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        <span className="font-medium">Leyenda:</span>
        <span className={`rounded px-2 py-0.5 ${COLOR_BAND_CLASSES["below-zero"]}`}>Por debajo de 0 %</span>
        <span className={`rounded px-2 py-0.5 ${COLOR_BAND_CLASSES["very-low"]}`}>0-25 %</span>
        <span className={`rounded px-2 py-0.5 ${COLOR_BAND_CLASSES.low}`}>25-50 %</span>
        <span className={`rounded px-2 py-0.5 ${COLOR_BAND_CLASSES.mid}`}>50-75 %</span>
        <span className={`rounded px-2 py-0.5 ${COLOR_BAND_CLASSES.good}`}>75-90 %</span>
        <span className={`rounded px-2 py-0.5 ${COLOR_BAND_CLASSES.excellent}`}>90 % o mas</span>
        <span className={`rounded px-2 py-0.5 ${COLOR_BAND_CLASSES.vac}`}>VAC</span>
        <span className={`rounded px-2 py-0.5 ${COLOR_BAND_CLASSES["not-applicable"]}`}>No aplica</span>
        <span>* = limitado por el maximo configurado</span>
      </div>
    </div>
  );
}

