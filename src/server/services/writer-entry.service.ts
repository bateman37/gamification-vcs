import type { ParticipantLevel, PrismaClient } from "@prisma/client";
import { loadWeekContext } from "@/server/services/shared/week-context";
import { assertSplitAcceptsManualEntries, computeManualEntryStatus } from "@/server/services/shared/manual-entries";
import { listApplicableParticipantsForWeek } from "@/server/services/participant.service";
import { listKpiConfigsForSplit } from "@/server/services/kpi.service";
import { toKpiConfigView, type KpiConfigView } from "@/domain/kpis/mapping";
import { resolveStarWriterOutcome, toStarWriterOutcomeView, type StarWriterOutcomeView } from "@/domain/kpis/writer";
import type { LoadCoverageStatus } from "@/domain/kpis/loadGroups";
import { parseNonNegativeNumberDefaultZero, ManualEntryValidationError, type ManualEntryFieldError } from "@/server/validation/manual-entry";

/**
 * Entrada manual semanal de Redactor estrella (`STAR_WRITER`, ver
 * docs/MANUAL_KPI_ENTRY.md). Los tres ceros son una entrada valida y
 * completa: este KPI nunca muestra `VAC`.
 */

async function getActiveStarWriterConfig(db: PrismaClient, splitId: string): Promise<KpiConfigView | null> {
  const kpiConfigs = await listKpiConfigsForSplit(db, splitId);
  const config = kpiConfigs.find((entry) => entry.kpiCode === "STAR_WRITER") ?? null;
  return config?.isActive ? toKpiConfigView(config) : null;
}

export interface WriterFormRow {
  participantId: string;
  alias: string;
  fullName: string;
  level: ParticipantLevel;
  deliveredArticles: number | null;
  undeliveredArticles: number | null;
  proposedArticles: number | null;
}

export interface WriterFormView {
  weekSequenceNumber: number;
  rows: WriterFormRow[];
  hasExistingData: boolean;
}

export async function getWriterFormView(db: PrismaClient, splitId: string, weekId: string): Promise<WriterFormView> {
  const { weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);
  const participants = await listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber);
  const entries = await db.writerWeeklyEntry.findMany({ where: { splitWeekId: resolvedWeekId } });
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
        deliveredArticles: entry?.deliveredArticles ?? null,
        undeliveredArticles: entry?.undeliveredArticles ?? null,
        proposedArticles: entry?.proposedArticles ?? null,
      };
    }),
    hasExistingData: entries.length > 0,
  };
}

export async function saveWriterEntries(db: PrismaClient, splitId: string, weekId: string, formData: FormData): Promise<void> {
  const { split, weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);
  assertSplitAcceptsManualEntries(split, "Redactor estrella");

  const participants = await listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber);

  const fieldErrors: ManualEntryFieldError[] = [];
  const rows: { splitParticipantId: string; deliveredArticles: number; undeliveredArticles: number; proposedArticles: number }[] = [];
  for (const participant of participants) {
    const delivered = parseNonNegativeNumberDefaultZero(formData, "deliveredArticles", "Articulos entregados", participant.id, {
      integer: true,
    });
    const undelivered = parseNonNegativeNumberDefaultZero(formData, "undeliveredArticles", "Articulos no entregados", participant.id, {
      integer: true,
    });
    const proposed = parseNonNegativeNumberDefaultZero(formData, "proposedArticles", "Articulos propuestos", participant.id, {
      integer: true,
    });
    if (!delivered.ok) fieldErrors.push(delivered.error);
    if (!undelivered.ok) fieldErrors.push(undelivered.error);
    if (!proposed.ok) fieldErrors.push(proposed.error);
    if (!delivered.ok || !undelivered.ok || !proposed.ok) continue;

    rows.push({
      splitParticipantId: participant.id,
      deliveredArticles: delivered.value,
      undeliveredArticles: undelivered.value,
      proposedArticles: proposed.value,
    });
  }
  if (fieldErrors.length > 0) throw new ManualEntryValidationError(fieldErrors);

  await db.$transaction(async (tx) => {
    await tx.writerWeeklyEntry.deleteMany({ where: { splitWeekId: resolvedWeekId } });
    if (rows.length === 0) return;
    await tx.writerWeeklyEntry.createMany({
      data: rows.map((row) => ({
        splitWeekId: resolvedWeekId,
        splitParticipantId: row.splitParticipantId,
        deliveredArticles: row.deliveredArticles,
        undeliveredArticles: row.undeliveredArticles,
        proposedArticles: row.proposedArticles,
      })),
    });
  });
}

export async function getWriterLoadStatus(
  db: PrismaClient,
  splitId: string,
  weekId: string,
  weekSequenceNumber: number,
): Promise<LoadCoverageStatus> {
  const participants = await listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber);
  const entries = await db.writerWeeklyEntry.findMany({ where: { splitWeekId: weekId } });
  const savedIds = new Set(entries.map((entry) => entry.splitParticipantId));
  const status = computeManualEntryStatus(
    participants.map((participant) => participant.id),
    savedIds,
  );
  return { status, vacCount: 0 };
}

export interface WriterCheckRow {
  participantId: string;
  alias: string;
  fullName: string;
  level: ParticipantLevel;
  deliveredArticles: number | undefined;
  undeliveredArticles: number | undefined;
  proposedArticles: number | undefined;
  starWriter: StarWriterOutcomeView | null;
}

export interface WriterCheckView {
  weekSequenceNumber: number;
  starWriterActive: boolean;
  rows: WriterCheckRow[];
}

export async function getWriterCheckView(db: PrismaClient, splitId: string, weekId: string): Promise<WriterCheckView> {
  const { weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);

  const [participants, entries, config] = await Promise.all([
    listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber),
    db.writerWeeklyEntry.findMany({ where: { splitWeekId: resolvedWeekId } }),
    getActiveStarWriterConfig(db, splitId),
  ]);
  const entryByParticipant = new Map(entries.map((entry) => [entry.splitParticipantId, entry]));

  const rows: WriterCheckRow[] = participants.map((participant) => {
    const entry = entryByParticipant.get(participant.id);
    return {
      participantId: participant.id,
      alias: participant.alias,
      fullName: participant.person.fullName,
      level: participant.level,
      deliveredArticles: entry?.deliveredArticles,
      undeliveredArticles: entry?.undeliveredArticles,
      proposedArticles: entry?.proposedArticles,
      starWriter: config
        ? toStarWriterOutcomeView(
            resolveStarWriterOutcome(config, participant.level, entry?.deliveredArticles, entry?.undeliveredArticles, entry?.proposedArticles),
          )
        : null,
    };
  });

  return { weekSequenceNumber, starWriterActive: config !== null, rows };
}
