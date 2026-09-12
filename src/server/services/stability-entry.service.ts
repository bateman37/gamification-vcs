import type { ParticipantLevel, PrismaClient } from "@prisma/client";
import { loadWeekContext, assertWeekIsEditable } from "@/server/services/shared/week-context";
import { assertSplitAcceptsManualEntries, computeManualEntryStatus } from "@/server/services/shared/manual-entries";
import { listApplicableParticipantsForWeek } from "@/server/services/participant.service";
import { listKpiConfigsForSplit } from "@/server/services/kpi.service";
import { toKpiConfigView, type KpiConfigView } from "@/domain/kpis/mapping";
import {
  resolveStabilityGuardianOutcome,
  toStabilityGuardianOutcomeView,
  type StabilityGuardianOutcomeView,
} from "@/domain/kpis/stability";
import type { LoadCoverageStatus } from "@/domain/kpis/loadGroups";
import { parseNonNegativeNumberDefaultZero, ManualEntryValidationError, type ManualEntryFieldError } from "@/server/validation/manual-entry";
import { notifyIfWeekReadyToReview } from "@/server/services/news-week-ready.service";

/**
 * Entrada manual semanal de Guardian de la Estabilidad (`STABILITY_GUARDIAN`,
 * ver docs/MANUAL_KPI_ENTRY.md). Solo aplica a participantes N2. Un
 * resultado `0` es un dato real, nunca vacaciones: este KPI nunca muestra
 * `VAC`.
 *
 * Bugfix (`0.6.0` / MVP-1C): un campo vacio, ausente o solo con espacios se
 * interpreta y guarda como `0`, igual que Redactor estrella, Estudiante
 * entusiasta y Aprendiz experto (ver docs/DECISIONS.md). Sigue rechazando
 * texto no numerico, negativos y valores no finitos.
 */

async function getActiveStabilityGuardianConfig(db: PrismaClient, splitId: string): Promise<KpiConfigView | null> {
  const kpiConfigs = await listKpiConfigsForSplit(db, splitId);
  const config = kpiConfigs.find((entry) => entry.kpiCode === "STABILITY_GUARDIAN") ?? null;
  return config?.isActive ? toKpiConfigView(config) : null;
}

async function listN2ApplicableParticipants(db: PrismaClient, splitId: string, weekSequenceNumber: number) {
  const participants = await listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber);
  return participants.filter((participant) => participant.level === "N2");
}

export interface StabilityFormRow {
  participantId: string;
  alias: string;
  fullName: string;
  level: ParticipantLevel;
  resultValue: number | null;
}

export interface StabilityFormView {
  weekSequenceNumber: number;
  rows: StabilityFormRow[];
  hasExistingData: boolean;
}

export async function getStabilityFormView(db: PrismaClient, splitId: string, weekId: string): Promise<StabilityFormView> {
  const { weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);
  const participants = await listN2ApplicableParticipants(db, splitId, weekSequenceNumber);
  const entries = await db.stabilityWeeklyEntry.findMany({ where: { splitWeekId: resolvedWeekId } });
  const entryByParticipant = new Map(entries.map((entry) => [entry.splitParticipantId, entry]));

  return {
    weekSequenceNumber,
    rows: participants.map((participant) => ({
      participantId: participant.id,
      alias: participant.alias,
      fullName: participant.person.fullName,
      level: participant.level,
      resultValue: entryByParticipant.get(participant.id)?.resultValue.toNumber() ?? null,
    })),
    hasExistingData: entries.length > 0,
  };
}

/** Guarda (o sustituye) el conjunto completo de Guardian de la Estabilidad de una semana. Atomico: todo o nada. */
export async function saveStabilityEntries(db: PrismaClient, splitId: string, weekId: string, formData: FormData): Promise<void> {
  const { split, weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);
  assertSplitAcceptsManualEntries(split, "Guardian de la Estabilidad");
  await assertWeekIsEditable(db, resolvedWeekId);

  const participants = await listN2ApplicableParticipants(db, splitId, weekSequenceNumber);

  const fieldErrors: ManualEntryFieldError[] = [];
  const rows: { splitParticipantId: string; resultValue: number }[] = [];
  for (const participant of participants) {
    const result = parseNonNegativeNumberDefaultZero(formData, "resultValue", "Resultados de estabilidad", participant.id);
    if (!result.ok) {
      fieldErrors.push(result.error);
      continue;
    }
    rows.push({ splitParticipantId: participant.id, resultValue: result.value });
  }
  if (fieldErrors.length > 0) throw new ManualEntryValidationError(fieldErrors);

  await db.$transaction(async (tx) => {
    await tx.stabilityWeeklyEntry.deleteMany({ where: { splitWeekId: resolvedWeekId } });
    if (rows.length > 0) {
      await tx.stabilityWeeklyEntry.createMany({
        data: rows.map((row) => ({ splitWeekId: resolvedWeekId, splitParticipantId: row.splitParticipantId, resultValue: row.resultValue })),
      });
    }
    await notifyIfWeekReadyToReview(tx, splitId, resolvedWeekId);
  });
}

export async function getStabilityLoadStatus(
  db: PrismaClient,
  splitId: string,
  weekId: string,
  weekSequenceNumber: number,
): Promise<LoadCoverageStatus> {
  const participants = await listN2ApplicableParticipants(db, splitId, weekSequenceNumber);
  const entries = await db.stabilityWeeklyEntry.findMany({ where: { splitWeekId: weekId } });
  const savedIds = new Set(entries.map((entry) => entry.splitParticipantId));
  const status = computeManualEntryStatus(
    participants.map((participant) => participant.id),
    savedIds,
  );
  return { status, vacCount: 0 };
}

export interface StabilityCheckRow {
  participantId: string;
  alias: string;
  fullName: string;
  level: ParticipantLevel;
  resultValue: number | undefined;
  stabilityGuardian: StabilityGuardianOutcomeView | null;
}

export interface StabilityCheckView {
  weekSequenceNumber: number;
  stabilityGuardianActive: boolean;
  noApplicableN2: boolean;
  rows: StabilityCheckRow[];
}

export async function getStabilityCheckView(db: PrismaClient, splitId: string, weekId: string): Promise<StabilityCheckView> {
  const { weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);

  const [participants, entries, config] = await Promise.all([
    listN2ApplicableParticipants(db, splitId, weekSequenceNumber),
    db.stabilityWeeklyEntry.findMany({ where: { splitWeekId: resolvedWeekId } }),
    getActiveStabilityGuardianConfig(db, splitId),
  ]);
  const entryByParticipant = new Map(entries.map((entry) => [entry.splitParticipantId, entry]));

  const rows: StabilityCheckRow[] = participants.map((participant) => {
    const resultValue = entryByParticipant.get(participant.id)?.resultValue.toNumber();
    return {
      participantId: participant.id,
      alias: participant.alias,
      fullName: participant.person.fullName,
      level: participant.level,
      resultValue,
      stabilityGuardian: config ? toStabilityGuardianOutcomeView(resolveStabilityGuardianOutcome(config, participant.level, resultValue)) : null,
    };
  });

  return {
    weekSequenceNumber,
    stabilityGuardianActive: config !== null,
    noApplicableN2: participants.length === 0,
    rows,
  };
}
