"use client";

import { useMemo, useState } from "react";
import { formatPoints } from "@/lib/format";
import { colorBandForPercentage, COLOR_BAND_CLASSES, NOT_APPLICABLE_COLOR_BAND } from "@/domain/color-bands";
import { resolveKpiResultDisplayPoints } from "@/domain/kpi-outcome-display";
import type { KpiResultStatus } from "@/server/services/weekly-results.service";
import { PROFESSION_BONUS_PERCENT } from "@/domain/profession-bonus";

export interface ResultKpiCell {
  kpiCode: string;
  kpiName: string;
  status: KpiResultStatus;
  /** Puntos definitivos, ya con el bonus de profesion incluido (`0.8.0` / MVP-2B). */
  finalPoints: number | null;
  baseMax: number | null;
  capped: boolean;
  /** Puntos tras el maximo base y antes del bonus. `null` en publicaciones anteriores a `0.8.0`. */
  basePointsBeforeProfession: number | null;
  /** Puntos anadidos por la profesion. `null` en publicaciones anteriores a `0.8.0`. */
  professionBonusPoints: number | null;
  professionApplied: boolean;
  professionName: string | null;
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
  /** Profesion (actual en previsualizacion, congelada en una semana publicada). `null` si no hay. */
  professionName: string | null;
  professionKpiNames: string | null;
  /** Suma del bonus de profesion de la semana. */
  professionBonusTotal: number;
}

type SortKey = "position" | "alias" | "total" | `kpi:${string}`;

/** Desglose textual del bonus, identico en previsualizacion y en semana publicada (seccion 24 del encargo). */
export function formatProfessionBreakdown(cell: ResultKpiCell): string | null {
  if (!cell.professionApplied || cell.basePointsBeforeProfession === null || cell.professionBonusPoints === null) {
    return null;
  }
  const name = cell.professionName ?? "profesión";
  return [
    `Resultado tras máximo: ${formatPoints(cell.basePointsBeforeProfession)}`,
    `Bonus ${name} (+${PROFESSION_BONUS_PERCENT} %): +${formatPoints(cell.professionBonusPoints)}`,
    `Resultado final: ${formatPoints(cell.finalPoints ?? 0)}`,
  ].join(" | ");
}

function KpiCellView({ cell }: { cell: ResultKpiCell }) {
  if (cell.status === "NOT_APPLICABLE") {
    return (
      <td className={`px-3 py-2 text-center ${COLOR_BAND_CLASSES[NOT_APPLICABLE_COLOR_BAND.band]}`} title="Este KPI no aplica a este nivel">
        No aplica
      </td>
    );
  }
  // VAC se muestra como el valor numerico 0, igual que cualquier otro cero (hotfix AVISO/0, ver docs/DECISIONS.md).
  const displayPoints = resolveKpiResultDisplayPoints(cell.status, cell.finalPoints) ?? 0;
  // El porcentaje se calcula sobre el maximo base, que no se infla con el bonus: por eso puede superar el 100 %.
  const percentage = cell.baseMax && cell.baseMax > 0 ? (displayPoints / cell.baseMax) * 100 : 0;
  const bandInfo = colorBandForPercentage(percentage);
  const breakdown = formatProfessionBreakdown(cell);
  const title = `${formatPoints(percentage)} % del maximo${cell.capped ? " (limitado por el maximo)" : ""}${
    breakdown ? ` - ${breakdown}` : ""
  }`;
  return (
    <td
      className={`px-3 py-2 text-center font-medium ${COLOR_BAND_CLASSES[bandInfo.band]} ${
        breakdown ? "border-2 border-dashed border-indigo-500" : ""
      }`}
      title={title}
    >
      {formatPoints(displayPoints)}
      {cell.capped && <span aria-hidden="true"> *</span>}
      {breakdown && (
        <span className="mt-1 block rounded bg-indigo-100 px-1 py-0.5 text-[10px] font-semibold text-indigo-800">
          +{PROFESSION_BONUS_PERCENT} % profesion
        </span>
      )}
      <span className="sr-only"> ({title})</span>
    </td>
  );
}

export function WeeklyResultsTable({
  rows,
  activeKpis,
  splitParticipantCount,
  showProfessionColumn,
}: {
  rows: ResultRow[];
  activeKpis: { code: string; name: string }[];
  /** Numero total de participantes del split: denominador unico de "x de n" (seccion 17 de `0.7.0` / MVP-2A). */
  splitParticipantCount: number;
  /** `false` cuando el split no usa profesiones: la columna no se muestra (comportamiento identico a `0.7.0`). */
  showProfessionColumn: boolean;
}) {
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
              {showProfessionColumn && <th className="px-3 py-2 font-medium">Profesion</th>}
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
                  {showProfessionColumn && (
                    <td className="px-3 py-2 text-slate-600">
                      {row.professionName ? (
                        <>
                          <span className="font-medium text-slate-800">{row.professionName}</span>
                          {row.professionKpiNames && <span className="block text-xs text-slate-500">{row.professionKpiNames}</span>}
                          {row.professionBonusTotal > 0 && (
                            <span className="block text-xs text-indigo-700">
                              Bonus semanal: +{formatPoints(row.professionBonusTotal)}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Sin elegir
                        </span>
                      )}
                    </td>
                  )}
                  {activeKpis.map((kpi) => {
                    const cell = row.kpiCells.find((entry) => entry.kpiCode === kpi.code);
                    return cell ? <KpiCellView key={kpi.code} cell={cell} /> : <td key={kpi.code} className="px-3 py-2 text-center">-</td>;
                  })}
                  <td className="px-3 py-2 text-center font-semibold">{formatPoints(row.totalKpiPoints)}</td>
                  <td className="px-3 py-2 text-center text-slate-600">{percentage === null ? "—" : `${formatPoints(percentage)} %`}</td>
                  <td className="px-3 py-2 text-center font-semibold">
                    {row.weeklyRank} <span className="text-xs font-normal text-slate-500">de {splitParticipantCount}</span>
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
        <span className={`rounded px-2 py-0.5 ${COLOR_BAND_CLASSES["not-applicable"]}`}>No aplica</span>
        <span>* = limitado por el maximo configurado</span>
        {showProfessionColumn && (
          <span className="rounded border-2 border-dashed border-indigo-500 px-2 py-0.5 text-indigo-800">
            Borde y badge &quot;+{PROFESSION_BONUS_PERCENT} % profesion&quot; = bonus de profesion aplicado (el desglose esta en la
            ayuda de la celda)
          </span>
        )}
      </div>
    </div>
  );
}

