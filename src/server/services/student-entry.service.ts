import type { ParticipantLevel, PrismaClient } from "@prisma/client";
import { loadWeekContext, assertWeekIsEditable } from "@/server/services/shared/week-context";
import { assertSplitAcceptsManualEntries, computeManualEntryStatus } from "@/server/services/shared/manual-entries";
import { listApplicableParticipantsForWeek } from "@/server/services/participant.service";
import { listKpiConfigsForSplit } from "@/server/services/kpi.service";
import { toKpiConfigView, type KpiConfigView } from "@/domain/kpis/mapping";
import {
  resolveEnthusiasticStudentOutcome,
  toEnthusiasticStudentOutcomeView,
  type EnthusiasticStudentOutcomeView,
} from "@/domain/kpis/student";
import type { LoadCoverageStatus } from "@/domain/kpis/loadGroups";
import { parseNonNegativeNumberDefaultZero, ManualEntryValidationError, type ManualEntryFieldError } from "@/server/validation/manual-entry";

/**
 * Entrada manual semanal de Estudiante entusiasta
 * (`ENTHUSIASTIC_STUDENT`, ver docs/MANUAL_KPI_ENTRY.md). El cero es un
 * dato valido y completo: este KPI nunca muestra `VAC`.
 */

async function getActiveEnthusiasticStudentConfig(db: PrismaClient, splitId: string): Promise<KpiConfigView | null> {
  const kpiConfigs = await listKpiConfigsForSplit(db, splitId);
  const config = kpiConfigs.find((entry) => entry.kpiCode === "ENTHUSIASTIC_STUDENT") ?? null;
  return config?.isActive ? toKpiConfigView(config) : null;
}

export interface StudentFormRow {
  participantId: string;
  alias: string;
  fullName: string;
  level: ParticipantLevel;
  dedicatedHours: number | null;
}

export interface StudentFormView {
  weekSequenceNumber: number;
  rows: StudentFormRow[];
  hasExistingData: boolean;
}

export async function getStudentFormView(db: PrismaClient, splitId: string, weekId: string): Promise<StudentFormView> {
  const { weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);
  const participants = await listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber);
  const entries = await db.studentWeeklyEntry.findMany({ where: { splitWeekId: resolvedWeekId } });
  const entryByParticipant = new Map(entries.map((entry) => [entry.splitParticipantId, entry]));

  return {
    weekSequenceNumber,
    rows: participants.map((participant) => ({
      participantId: participant.id,
      alias: participant.alias,
      fullName: participant.person.fullName,
      level: participant.level,
      dedicatedHours: entryByParticipant.get(participant.id)?.dedicatedHours.toNumber() ?? null,
    })),
    hasExistingData: entries.length > 0,
  };
}

export async function saveStudentEntries(db: PrismaClient, splitId: string, weekId: string, formData: FormData): Promise<void> {
  const { split, weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);
  assertSplitAcceptsManualEntries(split, "Estudiante entusiasta");
  await assertWeekIsEditable(db, resolvedWeekId);

  const participants = await listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber);

  const fieldErrors: ManualEntryFieldError[] = [];
  const rows: { splitParticipantId: string; dedicatedHours: number }[] = [];
  for (const participant of participants) {
    const result = parseNonNegativeNumberDefaultZero(formData, "dedicatedHours", "Horas dedicadas", participant.id);
    if (!result.ok) {
      fieldErrors.push(result.error);
      continue;
    }
    rows.push({ splitParticipantId: participant.id, dedicatedHours: result.value });
  }
  if (fieldErrors.length > 0) throw new ManualEntryValidationError(fieldErrors);

  await db.$transaction(async (tx) => {
    await tx.studentWeeklyEntry.deleteMany({ where: { splitWeekId: resolvedWeekId } });
    if (rows.length === 0) return;
    await tx.studentWeeklyEntry.createMany({
      data: rows.map((row) => ({ splitWeekId: resolvedWeekId, splitParticipantId: row.splitParticipantId, dedicatedHours: row.dedicatedHours })),
    });
  });
}

export async function getStudentLoadStatus(
  db: PrismaClient,
  splitId: string,
  weekId: string,
  weekSequenceNumber: number,
): Promise<LoadCoverageStatus> {
  const participants = await listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber);
  const entries = await db.studentWeeklyEntry.findMany({ where: { splitWeekId: weekId } });
  const savedIds = new Set(entries.map((entry) => entry.splitParticipantId));
  const status = computeManualEntryStatus(
    participants.map((participant) => participant.id),
    savedIds,
  );
  return { status, vacCount: 0 };
}

export interface StudentCheckRow {
  participantId: string;
  alias: string;
  fullName: string;
  level: ParticipantLevel;
  dedicatedHours: number | undefined;
  enthusiasticStudent: EnthusiasticStudentOutcomeView | null;
}

export interface StudentCheckView {
  weekSequenceNumber: number;
  enthusiasticStudentActive: boolean;
  rows: StudentCheckRow[];
}

export async function getStudentCheckView(db: PrismaClient, splitId: string, weekId: string): Promise<StudentCheckView> {
  const { weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);

  const [participants, entries, config] = await Promise.all([
    listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber),
    db.studentWeeklyEntry.findMany({ where: { splitWeekId: resolvedWeekId } }),
    getActiveEnthusiasticStudentConfig(db, splitId),
  ]);
  const entryByParticipant = new Map(entries.map((entry) => [entry.splitParticipantId, entry]));

  const rows: StudentCheckRow[] = participants.map((participant) => {
    const dedicatedHours = entryByParticipant.get(participant.id)?.dedicatedHours.toNumber();
    return {
      participantId: participant.id,
      alias: participant.alias,
      fullName: participant.person.fullName,
      level: participant.level,
      dedicatedHours,
      enthusiasticStudent: config
        ? toEnthusiasticStudentOutcomeView(resolveEnthusiasticStudentOutcome(config, participant.level, dedicatedHours))
        : null,
    };
  });

  return { weekSequenceNumber, enthusiasticStudentActive: config !== null, rows };
}
