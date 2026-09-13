import type { ParticipantLevel, PrismaClient } from "@prisma/client";
import { loadWeekContext, assertWeekIsEditable } from "@/server/services/shared/week-context";
import { assertSplitAcceptsManualEntries, computeManualEntryStatus } from "@/server/services/shared/manual-entries";
import { listApplicableParticipantsForWeek } from "@/server/services/participant.service";
import { listKpiConfigsForSplit } from "@/server/services/kpi.service";
import { toKpiConfigView, type KpiConfigView } from "@/domain/kpis/mapping";
import { multiplierForLevel } from "@/domain/kpis/shared";
import {
  resolveWorkChronomancyOutcome,
  toWorkChronomancyOutcomeView,
  type WorkChronomancyOutcomeView,
} from "@/domain/kpis/chronomancy";
import { resolveWeeklyAttendance, type WeeklyAttendanceResolution } from "@/domain/attendance";
import type { LoadCoverageStatus } from "@/domain/kpis/loadGroups";
import { parseNonNegativeNumberDefaultZero, ManualEntryValidationError, type ManualEntryFieldError } from "@/server/validation/manual-entry";
import { notifyIfWeekReadyToReview } from "@/server/services/news-week-ready.service";

/**
 * Horas semanales y entrada manual de Cronomagia laboral (`WORK_CHRONOMANCY`,
 * ver docs/MANUAL_KPI_ENTRY.md y, desde `1.1.1`,
 * docs/WEEKLY_ATTENDANCE_AND_HOURS.md).
 *
 * Desde `1.1.1`, "Horas totales de la semana" es un dato operativo
 * obligatorio para cualquier participante aplicable, **independiente** de si
 * `WORK_CHRONOMANCY` esta activo en el split: determina la asistencia
 * semanal (`totalHours = 0` => ausencia, con prioridad sobre cualquier otro
 * KPI). "Horas productivas" solo se captura cuando el KPI esta activo **y**
 * aplica al nivel del participante (multiplicador no vacio); en cualquier
 * otro caso se guarda como `null` ("no aplica"), nunca como `0` implicito.
 *
 * Bugfix (`0.6.0` / MVP-1C): un campo de horas totales vacio o solo con
 * espacios se interpreta y guarda como `0` (ver docs/DECISIONS.md).
 */

async function getActiveWorkChronomancyConfig(db: PrismaClient, splitId: string): Promise<KpiConfigView | null> {
  const kpiConfigs = await listKpiConfigsForSplit(db, splitId);
  const config = kpiConfigs.find((entry) => entry.kpiCode === "WORK_CHRONOMANCY") ?? null;
  return config?.isActive ? toKpiConfigView(config) : null;
}

/** `true` solo cuando Cronomagia esta activa y su multiplicador de nivel no esta vacio: unico caso en el que se captura "Horas productivas". */
function isProductiveHoursApplicable(config: KpiConfigView | null, level: ParticipantLevel): boolean {
  return config !== null && multiplierForLevel(config, level) !== null;
}

export interface ChronomancyFormRow {
  participantId: string;
  alias: string;
  fullName: string;
  level: ParticipantLevel;
  productiveHours: number | null;
  totalHours: number | null;
  /** `true` cuando el formulario debe pedir "Horas productivas" para esta fila; en caso contrario, el campo se muestra como "No aplica". */
  productiveHoursApplicable: boolean;
}

export interface ChronomancyFormView {
  weekSequenceNumber: number;
  rows: ChronomancyFormRow[];
  hasExistingData: boolean;
  /** `true` si `WORK_CHRONOMANCY` esta activo en el split (el bloque de horas se muestra igual cuando es `false`). */
  chronomancyActive: boolean;
}

export async function getChronomancyFormView(db: PrismaClient, splitId: string, weekId: string): Promise<ChronomancyFormView> {
  const { weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);
  const participants = await listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber);
  const entries = await db.chronomancyWeeklyEntry.findMany({ where: { splitWeekId: resolvedWeekId } });
  const entryByParticipant = new Map(entries.map((entry) => [entry.splitParticipantId, entry]));
  const config = await getActiveWorkChronomancyConfig(db, splitId);

  return {
    weekSequenceNumber,
    chronomancyActive: config !== null,
    rows: participants.map((participant) => {
      const entry = entryByParticipant.get(participant.id);
      return {
        participantId: participant.id,
        alias: participant.alias,
        fullName: participant.person.fullName,
        level: participant.level,
        productiveHours: entry?.productiveHours?.toNumber() ?? null,
        totalHours: entry?.totalHours.toNumber() ?? null,
        productiveHoursApplicable: isProductiveHoursApplicable(config, participant.level),
      };
    }),
    hasExistingData: entries.length > 0,
  };
}

/**
 * Guarda (o sustituye) el conjunto completo de horas semanales de una
 * semana. `totalHours = 0` exige `productiveHours` `0` o "no aplica";
 * `productiveHours` puede superar `totalHours` cuando aplica (ocurre en los
 * datos reales) sin generar error.
 */
export async function saveChronomancyEntries(db: PrismaClient, splitId: string, weekId: string, formData: FormData): Promise<void> {
  const { split, weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);
  assertSplitAcceptsManualEntries(split, "Cronomagia laboral");
  await assertWeekIsEditable(db, resolvedWeekId);

  const participants = await listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber);
  const config = await getActiveWorkChronomancyConfig(db, splitId);

  const fieldErrors: ManualEntryFieldError[] = [];
  const rows: { splitParticipantId: string; productiveHours: number | null; totalHours: number }[] = [];
  for (const participant of participants) {
    const totalResult = parseNonNegativeNumberDefaultZero(formData, "totalHours", "Horas totales de la semana", participant.id);
    if (!totalResult.ok) {
      fieldErrors.push(totalResult.error);
      continue;
    }

    const productiveApplicable = isProductiveHoursApplicable(config, participant.level);
    let productiveValue: number | null = null;
    if (productiveApplicable) {
      const productiveResult = parseNonNegativeNumberDefaultZero(formData, "productiveHours", "Horas productivas", participant.id);
      if (!productiveResult.ok) {
        fieldErrors.push(productiveResult.error);
        continue;
      }
      productiveValue = productiveResult.value;
      if (totalResult.value === 0 && productiveValue !== 0) {
        fieldErrors.push({
          participantId: participant.id,
          field: "productiveHours",
          message: "Si las horas totales son 0, las horas productivas tambien deben ser 0 (ausencia).",
        });
        continue;
      }
    }
    rows.push({ splitParticipantId: participant.id, productiveHours: productiveValue, totalHours: totalResult.value });
  }
  if (fieldErrors.length > 0) throw new ManualEntryValidationError(fieldErrors);

  await db.$transaction(async (tx) => {
    await tx.chronomancyWeeklyEntry.deleteMany({ where: { splitWeekId: resolvedWeekId } });
    if (rows.length > 0) {
      await tx.chronomancyWeeklyEntry.createMany({
        data: rows.map((row) => ({
          splitWeekId: resolvedWeekId,
          splitParticipantId: row.splitParticipantId,
          productiveHours: row.productiveHours,
          totalHours: row.totalHours,
        })),
      });
    }
    await notifyIfWeekReadyToReview(tx, splitId, resolvedWeekId);
  });
}

export interface ChronomancyLoadStatus extends LoadCoverageStatus {
  /** `true` si `WORK_CHRONOMANCY` esta activo en el split. */
  chronomancyActive: boolean;
  savedCount: number;
  totalApplicableCount: number;
}

/**
 * Cobertura del bloque de horas semanales, siempre calculada
 * independientemente de si `WORK_CHRONOMANCY` esta activo (`1.1.1`): es un
 * requisito operativo propio, no un KPI mas.
 */
export async function getChronomancyLoadStatus(
  db: PrismaClient,
  splitId: string,
  weekId: string,
  weekSequenceNumber: number,
): Promise<ChronomancyLoadStatus> {
  const participants = await listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber);
  const entries = await db.chronomancyWeeklyEntry.findMany({ where: { splitWeekId: weekId } });
  const savedIds = new Set(entries.map((entry) => entry.splitParticipantId));
  const status = computeManualEntryStatus(
    participants.map((participant) => participant.id),
    savedIds,
  );
  const config = await getActiveWorkChronomancyConfig(db, splitId);
  return {
    status,
    vacCount: 0,
    chronomancyActive: config !== null,
    savedCount: participants.filter((participant) => savedIds.has(participant.id)).length,
    totalApplicableCount: participants.length,
  };
}

export interface ChronomancyCheckRow {
  participantId: string;
  alias: string;
  fullName: string;
  level: ParticipantLevel;
  productiveHours: number | undefined;
  totalHours: number | undefined;
  workChronomancy: WorkChronomancyOutcomeView | null;
  attendance: WeeklyAttendanceResolution;
}

export interface ChronomancyCheckView {
  weekSequenceNumber: number;
  workChronomancyActive: boolean;
  rows: ChronomancyCheckRow[];
}

export async function getChronomancyCheckView(db: PrismaClient, splitId: string, weekId: string): Promise<ChronomancyCheckView> {
  const { weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);

  const [participants, entries, config] = await Promise.all([
    listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber),
    db.chronomancyWeeklyEntry.findMany({ where: { splitWeekId: resolvedWeekId } }),
    getActiveWorkChronomancyConfig(db, splitId),
  ]);
  const entryByParticipant = new Map(entries.map((entry) => [entry.splitParticipantId, entry]));

  const rows: ChronomancyCheckRow[] = participants.map((participant) => {
    const entry = entryByParticipant.get(participant.id);
    const productiveHours = entry?.productiveHours?.toNumber();
    const totalHours = entry?.totalHours.toNumber();
    return {
      participantId: participant.id,
      alias: participant.alias,
      fullName: participant.person.fullName,
      level: participant.level,
      productiveHours,
      totalHours,
      workChronomancy: config
        ? toWorkChronomancyOutcomeView(resolveWorkChronomancyOutcome(config, participant.level, productiveHours, totalHours))
        : null,
      attendance: resolveWeeklyAttendance(totalHours === undefined ? undefined : { totalHours, productiveHours: productiveHours ?? null }),
    };
  });

  return { weekSequenceNumber, workChronomancyActive: config !== null, rows };
}
