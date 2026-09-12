import type { ParticipantLevel, PrismaClient } from "@prisma/client";
import { loadWeekContext, assertWeekIsEditable } from "@/server/services/shared/week-context";
import { assertSplitAcceptsManualEntries, computeManualEntryStatus } from "@/server/services/shared/manual-entries";
import { listApplicableParticipantsForWeek } from "@/server/services/participant.service";
import { listKpiConfigsForSplit } from "@/server/services/kpi.service";
import { toKpiConfigView, type KpiConfigView } from "@/domain/kpis/mapping";
import {
  resolveWorkChronomancyOutcome,
  toWorkChronomancyOutcomeView,
  type WorkChronomancyOutcomeView,
} from "@/domain/kpis/chronomancy";
import type { LoadCoverageStatus } from "@/domain/kpis/loadGroups";
import { parseNonNegativeNumberDefaultZero, ManualEntryValidationError, type ManualEntryFieldError } from "@/server/validation/manual-entry";
import { notifyIfWeekReadyToReview } from "@/server/services/news-week-ready.service";

/**
 * Entrada manual semanal de Cronomagia laboral (`WORK_CHRONOMANCY`, ver
 * docs/MANUAL_KPI_ENTRY.md). `totalHours = 0` significa vacaciones toda la
 * semana (VAC): la fila se guarda igualmente, cuenta como completa y no
 * otorga puntos.
 *
 * Bugfix (`0.6.0` / MVP-1C): un campo vacio, ausente o solo con espacios en
 * "Horas productivas" o "Horas totales de la semana" se interpreta y guarda
 * como `0` (ver docs/DECISIONS.md). Sigue rechazandose un valor positivo de
 * productivas cuando las totales son 0 o estan vacias (0 totales exige 0
 * productivas), asi como negativos, texto invalido y valores no finitos.
 */

async function getActiveWorkChronomancyConfig(db: PrismaClient, splitId: string): Promise<KpiConfigView | null> {
  const kpiConfigs = await listKpiConfigsForSplit(db, splitId);
  const config = kpiConfigs.find((entry) => entry.kpiCode === "WORK_CHRONOMANCY") ?? null;
  return config?.isActive ? toKpiConfigView(config) : null;
}

export interface ChronomancyFormRow {
  participantId: string;
  alias: string;
  fullName: string;
  level: ParticipantLevel;
  productiveHours: number | null;
  totalHours: number | null;
}

export interface ChronomancyFormView {
  weekSequenceNumber: number;
  rows: ChronomancyFormRow[];
  hasExistingData: boolean;
}

export async function getChronomancyFormView(db: PrismaClient, splitId: string, weekId: string): Promise<ChronomancyFormView> {
  const { weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);
  const participants = await listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber);
  const entries = await db.chronomancyWeeklyEntry.findMany({ where: { splitWeekId: resolvedWeekId } });
  const entryByParticipant = new Map(entries.map((entry) => [entry.splitParticipantId, entry]));

  return {
    weekSequenceNumber,
    rows: participants.map((participant) => {
      const entry = entryByParticipant.get(participant.id);
      return {
        participantId: participant.id,
        alias: participant.alias,
        fullName: participant.person.fullName,
        level: participant.level,
        productiveHours: entry?.productiveHours.toNumber() ?? null,
        totalHours: entry?.totalHours.toNumber() ?? null,
      };
    }),
    hasExistingData: entries.length > 0,
  };
}

/**
 * Guarda (o sustituye) el conjunto completo de Cronomagia de una semana.
 * `totalHours = 0` exige `productiveHours = 0`; `productiveHours` puede
 * superar `totalHours` (ocurre en los datos reales) sin generar error.
 */
export async function saveChronomancyEntries(db: PrismaClient, splitId: string, weekId: string, formData: FormData): Promise<void> {
  const { split, weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);
  assertSplitAcceptsManualEntries(split, "Cronomagia laboral");
  await assertWeekIsEditable(db, resolvedWeekId);

  const participants = await listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber);

  const fieldErrors: ManualEntryFieldError[] = [];
  const rows: { splitParticipantId: string; productiveHours: number; totalHours: number }[] = [];
  for (const participant of participants) {
    const totalResult = parseNonNegativeNumberDefaultZero(formData, "totalHours", "Horas totales de la semana", participant.id);
    const productiveResult = parseNonNegativeNumberDefaultZero(formData, "productiveHours", "Horas productivas", participant.id);
    if (!totalResult.ok) fieldErrors.push(totalResult.error);
    if (!productiveResult.ok) fieldErrors.push(productiveResult.error);
    if (!totalResult.ok || !productiveResult.ok) continue;

    if (totalResult.value === 0 && productiveResult.value !== 0) {
      fieldErrors.push({
        participantId: participant.id,
        field: "productiveHours",
        message: "Si las horas totales son 0, las horas productivas tambien deben ser 0 (vacaciones).",
      });
      continue;
    }
    rows.push({ splitParticipantId: participant.id, productiveHours: productiveResult.value, totalHours: totalResult.value });
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

export async function getChronomancyLoadStatus(
  db: PrismaClient,
  splitId: string,
  weekId: string,
  weekSequenceNumber: number,
): Promise<LoadCoverageStatus> {
  const participants = await listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber);
  const entries = await db.chronomancyWeeklyEntry.findMany({ where: { splitWeekId: weekId } });
  const savedIds = new Set(entries.map((entry) => entry.splitParticipantId));
  const status = computeManualEntryStatus(
    participants.map((participant) => participant.id),
    savedIds,
  );
  return { status, vacCount: 0 };
}

export interface ChronomancyCheckRow {
  participantId: string;
  alias: string;
  fullName: string;
  level: ParticipantLevel;
  productiveHours: number | undefined;
  totalHours: number | undefined;
  workChronomancy: WorkChronomancyOutcomeView | null;
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
    const productiveHours = entry?.productiveHours.toNumber();
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
    };
  });

  return { weekSequenceNumber, workChronomancyActive: config !== null, rows };
}
