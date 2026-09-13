"use client";

import { useMemo, useState } from "react";
import { formatPoints } from "@/lib/format";
import { colorBandForPercentage, COLOR_BAND_CLASSES, NOT_APPLICABLE_COLOR_BAND } from "@/domain/color-bands";
import { resolveKpiResultDisplayPoints } from "@/domain/kpi-outcome-display";
import type { KpiResultStatus } from "@/server/services/weekly-results.service";
import { PROFESSION_BONUS_PERCENT } from "@/domain/profession-bonus";
import { ABSENCE_LABEL, type WeeklyAttendanceStatus } from "@/domain/attendance";
import { computeWeeklyPointsPerHour } from "@/domain/points-per-hour";

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
  /**
   * Suma de los puntos anadidos por los objetos de equipo que potencian este
   * KPI (`0.9.0` / MVP-2D). `null` en publicaciones anteriores a esa version;
   * en previsualizacion refleja el equipo actual, en una semana publicada la
   * instantanea congelada de `PublishedKpiResult` (`1.0.2`, ver
   * docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md).
   */
  equipmentBonusPoints: number | null;
  equipmentApplied: boolean;
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
  /** `null` para una persona ausente esa semana, o cuando nadie estuvo presente (`1.1.1`). */
  weeklyRank: number | null;
  positionPoints: number | null;
  rankedParticipantCount: number;
  /** Asistencia semanal (`1.1.1`, ver docs/WEEKLY_ATTENDANCE_AND_HOURS.md). */
  attendanceStatus: WeeklyAttendanceStatus;
  totalHours: number;
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

/** Desglose textual del bonus de objetos equipados para un KPI concreto (`0.9.0` / MVP-2D). `null` si no se aplico. */
export function formatEquipmentBreakdown(cell: ResultKpiCell): string | null {
  if (!cell.equipmentApplied || cell.equipmentBonusPoints === null) return null;
  return `Bonus objetos equipados: +${formatPoints(cell.equipmentBonusPoints)}`;
}

/** Desglose completo de un KPI: base tras el maximo, cada bonus aplicado y el resultado final. */
function formatBonusBreakdown(cell: ResultKpiCell, weekLocation: WeekLocationSummary | null): string | null {
  const professionLine = formatProfessionBreakdown(cell);
  const locationLine = formatLocationBreakdown(cell, weekLocation);
  const equipmentLine = formatEquipmentBreakdown(cell);
  if ((!professionLine && !locationLine && !equipmentLine) || cell.basePointsBeforeProfession === null) return null;

  return [
    `Resultado tras máximo: ${formatPoints(cell.basePointsBeforeProfession)}`,
    professionLine,
    locationLine,
    equipmentLine,
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
  if (cell.status === "ABSENT") {
    return (
      <td className={`px-3 py-2 text-center ${COLOR_BAND_CLASSES[NOT_APPLICABLE_COLOR_BAND.band]}`} title={ABSENCE_LABEL}>
        Ausencia
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
  const title = `${formatPoints(percentage)} % del máximo${cell.capped ? " (limitado por el máximo)" : ""}${
    breakdown ? ` - ${breakdown}` : ""
  }`;
  // Tres bonus independientes (profesion, localizacion, objetos): con dos o mas
  // aplicados a la vez se usa el mismo tratamiento combinado ya existente
  // (ambar/reward), nunca solo el color de uno de ellos (seccion 14 del
  // encargo de `0.9.0` / MVP-2D, ver docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md).
  const appliedBonusCount = [cell.professionApplied, cell.locationApplied, cell.equipmentApplied].filter(Boolean).length;
  const borderClass =
    appliedBonusCount >= 2
      ? "border-2 border-dashed border-reward"
      : cell.professionApplied
        ? "border-2 border-dashed border-game"
        : cell.locationApplied
          ? "border-2 border-dashed border-info"
          : cell.equipmentApplied
            ? "border-2 border-dashed border-reward"
            : "";
  const showEquipmentBadge = cell.equipmentApplied && cell.equipmentBonusPoints !== null && cell.equipmentBonusPoints > 0;
  return (
    <td className={`px-3 py-2 text-center font-medium ${COLOR_BAND_CLASSES[bandInfo.band]} ${borderClass}`} title={title}>
      {formatPoints(displayPoints)}
      {cell.capped && <span aria-hidden="true"> *</span>}
      {cell.professionApplied && (
        <span className="mt-1 block rounded bg-game-soft px-1 py-0.5 text-[10px] font-semibold text-game-ink">
          +{PROFESSION_BONUS_PERCENT} % profesión
        </span>
      )}
      {cell.locationApplied && (
        <span className="mt-1 block rounded bg-info-soft px-1 py-0.5 text-[10px] font-semibold text-info-ink">
          +{weekLocation?.bonusPercent ?? ""} % localización
        </span>
      )}
      {showEquipmentBadge && (
        <span className="mt-1 block rounded bg-reward-soft px-1 py-0.5 text-[10px] font-semibold text-reward-ink">
          Objetos: +{formatPoints(cell.equipmentBonusPoints ?? 0)} puntos
        </span>
      )}
      <span className="sr-only"> ({title})</span>
    </td>
  );
}

export function WeeklyResultsTable({
  rows,
  activeKpis,
  presentParticipantCount,
  showProfessionColumn,
  weekLocation,
  isPreview = false,
}: {
  rows: ResultRow[];
  activeKpis: { code: string; name: string }[];
  /** Numero de presentes esta semana: denominador de "x de n" en las vistas semanales (`1.1.1`, sustituye el total del split, ver docs/WEEKLY_ATTENDANCE_AND_HOURS.md). */
  presentParticipantCount: number;
  /** `false` cuando el split no usa profesiones: la columna no se muestra (comportamiento identico a `0.7.0`). */
  showProfessionColumn: boolean;
  /** Localizacion de esta semana (`0.8.5` / MVP-2C), o `null` si no tiene. */
  weekLocation: WeekLocationSummary | null;
  /**
   * `true` en la previsualizacion de una semana todavia no publicada (el
   * bonus de objetos refleja el equipo actual); `false` (por defecto) en una
   * semana ya publicada, donde el bonus es la instantanea congelada de
   * `PublishedKpiResult` (`1.0.2`). Solo cambia el texto de la leyenda.
   */
  isPreview?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("position");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  // Solo se explica en la leyenda cuando algun objeto equipado aplico realmente
  // su bonus a alguna celda visible (igual de discreto que el resto de bonus).
  const hasEquipmentBonus = rows.some((row) => row.kpiCells.some((cell) => cell.equipmentApplied));

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let cmp = 0;
      // Los ausentes (`weeklyRank: null`) siempre quedan al final al ordenar por posicion, sin
      // convertir `null` en `0` (no tienen ordinal que comparar).
      if (sortKey === "position") cmp = (a.weeklyRank ?? Number.POSITIVE_INFINITY) - (b.weeklyRank ?? Number.POSITIVE_INFINITY);
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
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-canvas text-text-muted">
            <tr>
              <th className="sticky left-0 z-10 bg-canvas px-3 py-2">{headerButton("Alias", "alias")}</th>
              <th className="px-3 py-2 font-medium">Nombre real</th>
              <th className="px-3 py-2 font-medium">Nivel</th>
              <th className="px-3 py-2 font-medium">Asistencia</th>
              {showProfessionColumn && <th className="px-3 py-2 font-medium">Profesión</th>}
              {activeKpis.map((kpi) => (
                <th key={kpi.code} className="px-3 py-2 text-center">
                  {headerButton(kpi.name, `kpi:${kpi.code}`)}
                </th>
              ))}
              <th className="px-3 py-2 text-center">{headerButton("Total KPI", "total")}</th>
              <th className="px-3 py-2 text-center font-medium">% del máximo aplicable</th>
              <th className="px-3 py-2 text-center font-medium">Puntos por hora</th>
              <th className="px-3 py-2 text-center">{headerButton("Posición", "position")}</th>
              <th className="px-3 py-2 text-center font-medium">Puntos por posición</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const isAbsent = row.attendanceStatus === "ABSENT";
              const percentage = !isAbsent && row.applicableMaxPoints && row.applicableMaxPoints > 0 ? (row.totalKpiPoints / row.applicableMaxPoints) * 100 : null;
              const pointsPerHour = !isAbsent ? computeWeeklyPointsPerHour(row.totalKpiPoints, row.totalHours) : null;
              return (
                <tr key={row.splitParticipantId} className="border-b border-border">
                  <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-medium">{row.alias}</td>
                  <td className="px-3 py-2 text-text-muted">{row.fullName}</td>
                  <td className="px-3 py-2 text-text-muted">{row.level}</td>
                  <td className="px-3 py-2">
                    {isAbsent ? (
                      <span
                        className="inline-block rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger-ink"
                        title={ABSENCE_LABEL}
                      >
                        {ABSENCE_LABEL}
                      </span>
                    ) : (
                      <span className="text-text-muted">Presente · {formatPoints(row.totalHours)} h</span>
                    )}
                  </td>
                  {showProfessionColumn && (
                    <td className="px-3 py-2 text-text-muted">
                      {row.professionName ? (
                        <>
                          <span className="font-medium text-ink">{row.professionName}</span>
                          {row.professionKpiNames && <span className="block text-xs text-text-muted">{row.professionKpiNames}</span>}
                          {row.professionBonusTotal > 0 && (
                            <span className="block text-xs text-game-ink">
                              Bonus semanal: +{formatPoints(row.professionBonusTotal)}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="inline-block rounded-full bg-reward-soft px-2 py-0.5 text-xs font-medium text-reward-ink">
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
                  <td className="px-3 py-2 text-center text-text-muted">{percentage === null ? "—" : `${formatPoints(percentage)} %`}</td>
                  <td className="px-3 py-2 text-center text-text-muted">{pointsPerHour === null ? "—" : formatPoints(pointsPerHour)}</td>
                  <td className="px-3 py-2 text-center font-semibold">
                    {row.weeklyRank === null ? (
                      "Ausencia"
                    ) : (
                      <>
                        {row.weeklyRank} <span className="text-xs font-normal text-text-muted">de {presentParticipantCount}</span>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center font-semibold">{row.positionPoints ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-text-muted">
        <span className="font-medium">Leyenda:</span>
        <span className={`rounded px-2 py-0.5 ${COLOR_BAND_CLASSES["below-zero"]}`}>Por debajo de 0 %</span>
        <span className={`rounded px-2 py-0.5 ${COLOR_BAND_CLASSES["very-low"]}`}>0-25 %</span>
        <span className={`rounded px-2 py-0.5 ${COLOR_BAND_CLASSES.low}`}>25-50 %</span>
        <span className={`rounded px-2 py-0.5 ${COLOR_BAND_CLASSES.mid}`}>50-75 %</span>
        <span className={`rounded px-2 py-0.5 ${COLOR_BAND_CLASSES.good}`}>75-90 %</span>
        <span className={`rounded px-2 py-0.5 ${COLOR_BAND_CLASSES.excellent}`}>90 % o mas</span>
        <span className={`rounded px-2 py-0.5 ${COLOR_BAND_CLASSES["not-applicable"]}`}>No aplica</span>
        <span>* = limitado por el máximo configurado</span>
        {showProfessionColumn && (
          <span className="rounded border-2 border-dashed border-game px-2 py-0.5 text-game-ink">
            Borde y badge &quot;+{PROFESSION_BONUS_PERCENT} % profesión&quot; = bonus de profesión aplicado (el desglose está en la
            ayuda de la celda)
          </span>
        )}
        {weekLocation && (
          <span className="rounded border-2 border-dashed border-info px-2 py-0.5 text-info-ink">
            Borde y badge &quot;+{weekLocation.bonusPercent} % localización&quot; = bonus de la localización &quot;{weekLocation.name}&quot;
            aplicado (el desglose esta en la ayuda de la celda)
          </span>
        )}
        {hasEquipmentBonus && (
          <span className="rounded border-2 border-dashed border-reward px-2 py-0.5 text-reward-ink">
            &quot;Objetos: +N puntos&quot; = puntos añadidos por los objetos equipados
            {isPreview ? " actualmente" : " al publicar la semana"} (el desglose está en la ayuda de la celda).
          </span>
        )}
      </div>
    </div>
  );
}

