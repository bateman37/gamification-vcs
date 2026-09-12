import type { ParticipantLevel, PrismaClient } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { loadWeekContext, assertWeekIsEditable } from "@/server/services/shared/week-context";
import { assertSplitAcceptsManualEntries, computeManualEntryStatus } from "@/server/services/shared/manual-entries";
import { listApplicableParticipantsForWeek } from "@/server/services/participant.service";
import { listKpiConfigsForSplit } from "@/server/services/kpi.service";
import { toKpiConfigView, type KpiConfigView } from "@/domain/kpis/mapping";
import {
  resolveExpertApprenticeOutcome,
  toExpertApprenticeOutcomeView,
  type ExpertApprenticeOutcomeView,
} from "@/domain/kpis/apprentice";
import type { LoadCoverageStatus } from "@/domain/kpis/loadGroups";
import { parseNonNegativeNumberDefaultZero, ManualEntryValidationError, type ManualEntryFieldError } from "@/server/validation/manual-entry";
import { notifyIfWeekReadyToReview } from "@/server/services/news-week-ready.service";

/**
 * Entrada manual semanal de Aprendiz experto (`EXPERT_APPRENTICE`, ver
 * docs/MANUAL_KPI_ENTRY.md). `completedTrainings` no puede superar
 * `targetValue` configurado en el split; el maximo se valida siempre en
 * servidor (no solo con el atributo `max` del campo), y un valor historico
 * que quede por encima tras cambiar `targetValue` se senala y exige
 * corregirse al volver a guardar.
 */

async function getActiveExpertApprenticeConfig(db: PrismaClient, splitId: string): Promise<KpiConfigView | null> {
  const kpiConfigs = await listKpiConfigsForSplit(db, splitId);
  const config = kpiConfigs.find((entry) => entry.kpiCode === "EXPERT_APPRENTICE") ?? null;
  return config?.isActive ? toKpiConfigView(config) : null;
}

function getTargetValue(config: KpiConfigView | null): number {
  const targetValue = config?.parameters.targetValue ?? 15;
  if (!Number.isFinite(targetValue) || targetValue <= 0) {
    throw new DomainError('El parametro "Valor objetivo" de Aprendiz experto no esta configurado correctamente.');
  }
  return targetValue;
}

export interface ApprenticeFormRow {
  participantId: string;
  alias: string;
  fullName: string;
  level: ParticipantLevel;
  completedTrainings: number | null;
  exceedsTarget: boolean;
}

export interface ApprenticeFormView {
  weekSequenceNumber: number;
  targetValue: number;
  rows: ApprenticeFormRow[];
  hasExistingData: boolean;
}

export async function getApprenticeFormView(db: PrismaClient, splitId: string, weekId: string): Promise<ApprenticeFormView> {
  const { weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);
  const [participants, entries, config] = await Promise.all([
    listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber),
    db.apprenticeWeeklyEntry.findMany({ where: { splitWeekId: resolvedWeekId } }),
    getActiveExpertApprenticeConfig(db, splitId),
  ]);
  const targetValue = getTargetValue(config);
  const entryByParticipant = new Map(entries.map((entry) => [entry.splitParticipantId, entry]));

  return {
    weekSequenceNumber,
    targetValue,
    rows: participants.map((participant) => {
      const completedTrainings = entryByParticipant.get(participant.id)?.completedTrainings ?? null;
      return {
        participantId: participant.id,
        alias: participant.alias,
        fullName: participant.person.fullName,
        level: participant.level,
        completedTrainings,
        exceedsTarget: completedTrainings !== null && completedTrainings > targetValue,
      };
    }),
    hasExistingData: entries.length > 0,
  };
}

export async function saveApprenticeEntries(db: PrismaClient, splitId: string, weekId: string, formData: FormData): Promise<void> {
  const { split, weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);
  assertSplitAcceptsManualEntries(split, "Aprendiz experto");
  await assertWeekIsEditable(db, resolvedWeekId);

  const [participants, config] = await Promise.all([
    listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber),
    getActiveExpertApprenticeConfig(db, splitId),
  ]);
  const targetValue = getTargetValue(config);

  const fieldErrors: ManualEntryFieldError[] = [];
  const rows: { splitParticipantId: string; completedTrainings: number }[] = [];
  for (const participant of participants) {
    const result = parseNonNegativeNumberDefaultZero(formData, "completedTrainings", "Formaciones completadas", participant.id, {
      integer: true,
      max: targetValue,
      maxMessage: `Formaciones completadas debe ser un valor válido: no puede superar el máximo configurado (${targetValue}).`,
    });
    if (!result.ok) {
      fieldErrors.push(result.error);
      continue;
    }
    rows.push({ splitParticipantId: participant.id, completedTrainings: result.value });
  }
  if (fieldErrors.length > 0) throw new ManualEntryValidationError(fieldErrors);

  await db.$transaction(async (tx) => {
    await tx.apprenticeWeeklyEntry.deleteMany({ where: { splitWeekId: resolvedWeekId } });
    if (rows.length > 0) {
      await tx.apprenticeWeeklyEntry.createMany({
        data: rows.map((row) => ({
          splitWeekId: resolvedWeekId,
          splitParticipantId: row.splitParticipantId,
          completedTrainings: row.completedTrainings,
        })),
      });
    }
    await notifyIfWeekReadyToReview(tx, splitId, resolvedWeekId);
  });
}

export async function getApprenticeLoadStatus(
  db: PrismaClient,
  splitId: string,
  weekId: string,
  weekSequenceNumber: number,
): Promise<LoadCoverageStatus> {
  const participants = await listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber);
  const entries = await db.apprenticeWeeklyEntry.findMany({ where: { splitWeekId: weekId } });
  const savedIds = new Set(entries.map((entry) => entry.splitParticipantId));
  const status = computeManualEntryStatus(
    participants.map((participant) => participant.id),
    savedIds,
  );
  return { status, vacCount: 0 };
}

export interface ApprenticeCheckRow {
  participantId: string;
  alias: string;
  fullName: string;
  level: ParticipantLevel;
  completedTrainings: number | undefined;
  expertApprentice: ExpertApprenticeOutcomeView | null;
}

export interface ApprenticeCheckView {
  weekSequenceNumber: number;
  expertApprenticeActive: boolean;
  rows: ApprenticeCheckRow[];
}

export async function getApprenticeCheckView(db: PrismaClient, splitId: string, weekId: string): Promise<ApprenticeCheckView> {
  const { weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);

  const [participants, entries, config] = await Promise.all([
    listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber),
    db.apprenticeWeeklyEntry.findMany({ where: { splitWeekId: resolvedWeekId } }),
    getActiveExpertApprenticeConfig(db, splitId),
  ]);
  const entryByParticipant = new Map(entries.map((entry) => [entry.splitParticipantId, entry]));

  const rows: ApprenticeCheckRow[] = participants.map((participant) => {
    const completedTrainings = entryByParticipant.get(participant.id)?.completedTrainings;
    return {
      participantId: participant.id,
      alias: participant.alias,
      fullName: participant.person.fullName,
      level: participant.level,
      completedTrainings,
      expertApprentice: config
        ? toExpertApprenticeOutcomeView(resolveExpertApprenticeOutcome(config, participant.level, completedTrainings))
        : null,
    };
  });

  return { weekSequenceNumber, expertApprenticeActive: config !== null, rows };
}
