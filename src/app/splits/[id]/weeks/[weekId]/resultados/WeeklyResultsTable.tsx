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
  /** Puntos definitivos, ya con los bonus de profesion y localizacion incluidos. */
  finalPoints: number | null;
  baseMax: number | null;
  capped: boolean;
  /** Puntos tras el maximo base y antes de cualquier bonus. `null` en publicaciones anteriores a `0.8.0`. */
  basePointsBeforeProfession: number | null;
  /** Puntos anadidos por la profesion. `null` en publicaciones anteriores a `0.8.0`. */
  professionBonusPoints: number | null;
  professionApplied: boolean;
  professionName: string | null;
  /** Puntos anadidos por la localizacion semanal (`0.8.5` / MVP-2C). `null` en publicaciones anteriores a esta version. */
  locationBonusPoints: number | null;
  locationApplied: boolean;
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

/** Localizacion de la semana, comun a toda la tabla (no se repite por KPI ni por participante). */
export interface WeekLocationSummary {
  name: string;
  kpiCode: string;
  bonusPercent: number;
}

/** Desglose textual del bonus, identico en previsualizacion y en semana publicada (secciones 20 y 24 del encargo). */
export function formatProfessionBreakdown(cell: ResultKpiCell): string | null {
  if (!cell.professionApplied || cell.basePointsBeforeProfession === null || cell.professionBonusPoints === null) {
    return null;
  }
  const name = cell.professionName ?? "profesión";
  return `Bonus profesión ${name} (+${PROFESSION_BONUS_PERCENT} %): +${formatPoints(cell.professionBonusPoints)}`;
}

/** Desglose textual del bonus de localizacion para un KPI concreto. `null` si no se aplico. */
export function formatLocationBreakdown(cell: ResultKpiCell, weekLocation: WeekLocationSummary | null): string | null {
  if (!cell.locationApplied || cell.locationBonusPoints === null) return null;
  const name = weekLocation?.name ?? "localización";
  const percent = weekLocation?.bonusPercent;
  const percentLabel = percent !== undefined ? ` (+${percent} %)` : "";
  return `Bonus localización ${name}${percentLabel}: +${formatPoints(cell.locationBonusPoints)}`;
}

/** Desglose completo de un KPI: base tras el maximo, cada bonus aplicado y el resultado final. */
function formatBonusBreakdown(cell: ResultKpiCell, weekLocation: WeekLocationSummary | null): string | null {
  const professionLine = formatProfessionBreakdown(cell);
  const locationLine = formatLocationBreakdown(cell, weekLocation);
  if ((!professionLine && !locationLine) || cell.basePointsBeforeProfession === null) return null;

  return [
    `Resultado tras máximo: ${formatPoints(cell.basePointsBeforeProfession)}`,
    professionLine,
    locationLine,
    `Resultado final: ${formatPoints(cell.finalPoints ?? 0)}`,
  ]
    .filter((line): line is string => line !== null)
    .join(" | ");
}

function KpiCellView({ cell, weekLocation }: { cell: ResultKpiCell; weekLocation: WeekLocationSummary | null }) {
  if (cell.status === "NOT_APPLICABLE") {
    return (
      <td className={`px-3 py-2 text-center ${COLOR_BAND_CLASSES[NOT_APPLICABLE_COLOR_BAND.band]}`} title="Este KPI no aplica a este nivel">
        No aplica
      </td>
    );
  }
  // VAC se muestra como el valor numerico 0, igual que cualquier otro cero (hotfix AVISO/0, ver docs/DECISIONS.md).
  const displayPoints = resolveKpiResultDisplayPoints(cell.status, cell.finalPoints) ?? 0;
  // El porcentaje se calcula sobre el maximo base, que no se infla con ningun bonus: por eso puede superar el 100 %
  // (hasta el 170 % con profesion y localizacion a la vez sobre el mismo KPI, seccion 14 del encargo).
  const percentage = cell.baseMax && cell.baseMax > 0 ? (displayPoints / cell.baseMax) * 100 : 0;
  const bandInfo = colorBandForPercentage(percentage);
  const breakdown = formatBonusBreakdown(cell, weekLocation);
  const title = `${formatPoints(percentage)} % del maximo${cell.capped ? " (limitado por el maximo)" : ""}${
    breakdown ? ` - ${breakdown}` : ""
  }`;
  const borderClass = cell.professionApplied && cell.locationApplied
    ? "border-2 border-dashed border-violet-500"
    : cell.professionApplied
      ? "border-2 border-dashed border-indigo-500"
      : cell.locationApplied
        ? "border-2 border-dashed border-teal-500"
        : "";
  return (
    <td className={`px-3 py-2 text-center font-medium ${COLOR_BAND_CLASSES[bandInfo.band]} ${borderClass}`} title={title}>
      {formatPoints(displayPoints)}
      {cell.capped && <span aria-hidden="true"> *</span>}
      {cell.professionApplied && (
        <span className="mt-1 block rounded bg-indigo-100 px-1 py-0.5 text-[10px] font-semibold text-indigo-800">
          +{PROFESSION_BONUS_PERCENT} % profesion
        </span>
      )}
      {cell.locationApplied && (
        <span className="mt-1 block rounded bg-teal-100 px-1 py-0.5 text-[10px] font-semibold text-teal-800">
          +{weekLocation?.bonusPercent ?? ""} % localizacion
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
  weekLocation,
}: {
  rows: ResultRow[];
  activeKpis: { code: string; name: string }[];
  /** Numero total de participantes del split: denominador unico de "x de n" (seccion 17 de `0.7.0` / MVP-2A). */
  splitParticipantCount: number;
  /** `false` cuando el split no usa profesiones: la columna no se muestra (comportamiento identico a `0.7.0`). */
  showProfessionColumn: boolean;
  /** Localizacion de esta semana (`0.8.5` / MVP-2C), o `null` si no tiene. */
  weekLocation: WeekLocationSummary | null;
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
                    return cell ? (
                      <KpiCellView key={kpi.code} cell={cell} weekLocation={weekLocation} />
                    ) : (
                      <td key={kpi.code} className="px-3 py-2 text-center">-</td>
                    );
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
        {weekLocation && (
          <span className="rounded border-2 border-dashed border-teal-500 px-2 py-0.5 text-teal-800">
            Borde y badge &quot;+{weekLocation.bonusPercent} % localizacion&quot; = bonus de la localizacion &quot;{weekLocation.name}&quot;
            aplicado (el desglose esta en la ayuda de la celda)
          </span>
        )}
      </div>
    </div>
  );
}

