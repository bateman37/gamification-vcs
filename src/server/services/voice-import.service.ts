import { createHash } from "node:crypto";
import type { ParticipantLevel, Prisma, PrismaClient } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { loadWeekContext, assertSplitAcceptsLoads } from "@/server/services/shared/week-context";
import { listApplicableParticipantsForWeek } from "@/server/services/participant.service";
import { listKpiConfigsForSplit } from "@/server/services/kpi.service";
import { toKpiConfigView, type KpiConfigView } from "@/domain/kpis/mapping";
import { resolveVoiceAmbassadorOutcome, toVoiceAmbassadorOutcomeView, type VoiceAmbassadorOutcomeView } from "@/domain/kpis/voice";
import type { LoadCoverageStatus } from "@/domain/kpis/loadGroups";
import { readVoiceWorkbook, type VoiceSourceRow } from "@/server/services/voice/excel-reader";
import { formatXlsxRowError } from "@/server/services/shared/xlsx";
import { isAmbiguousMatch, isFoundMatch, isIgnoredMatch, matchRowsToParticipants } from "@/server/services/shared/matching";

/** Carga semanal de Llamadas y calculo de Embajador de voz (ver docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md). */

export interface VoiceFileInput {
  buffer: Buffer;
  originalFilename: string;
}

interface VoiceTimeMetrics {
  segmentDurationHours: number;
  segmentTalkTimeHours: number;
  segmentWrapUpTimeHours: number;
  segmentTalkTimeMinutes: number;
  segmentWrapUpTimeMinutes: number;
}

function decimalRowToTimeMetrics(row: {
  segmentDurationHours: Prisma.Decimal;
  segmentTalkTimeHours: Prisma.Decimal;
  segmentWrapUpTimeHours: Prisma.Decimal;
  segmentTalkTimeMinutes: Prisma.Decimal;
  segmentWrapUpTimeMinutes: Prisma.Decimal;
}): VoiceTimeMetrics {
  return {
    segmentDurationHours: row.segmentDurationHours.toNumber(),
    segmentTalkTimeHours: row.segmentTalkTimeHours.toNumber(),
    segmentWrapUpTimeHours: row.segmentWrapUpTimeHours.toNumber(),
    segmentTalkTimeMinutes: row.segmentTalkTimeMinutes.toNumber(),
    segmentWrapUpTimeMinutes: row.segmentWrapUpTimeMinutes.toNumber(),
  };
}

async function getActiveVoiceAmbassadorConfig(db: PrismaClient, splitId: string): Promise<KpiConfigView | null> {
  const kpiConfigs = await listKpiConfigsForSplit(db, splitId);
  const config = kpiConfigs.find((entry) => entry.kpiCode === "VOICE_AMBASSADOR") ?? null;
  return config?.isActive ? toKpiConfigView(config) : null;
}

export interface VoicePreviewParticipantRow extends VoiceTimeMetrics {
  participantId: string;
  alias: string;
  fullName: string;
  level: ParticipantLevel;
  sourceAgentName: string;
  acceptedCallSegments: number;
  rejectedCallSegments: number;
  unattendedCallSegments: number;
  outboundCalls: number;
  voiceAmbassador: VoiceAmbassadorOutcomeView | null;
}

export interface VoiceExistingImportSummary {
  originalFilename: string;
  importedRowCount: number;
  createdAt: Date;
}

export interface VoicePreview {
  weekSequenceNumber: number;
  originalFilename: string;
  existingImport: VoiceExistingImportSummary | null;
  sourceRowCount: number;
  voiceAmbassadorActive: boolean;
  found: VoicePreviewParticipantRow[];
  ignoredRows: { rowNumber: number; sourceAgentName: string }[];
  missingParticipants: { participantId: string; alias: string; fullName: string }[];
  ambiguousRows: { rowNumber: number; sourceAgentName: string; candidateAliases: string[] }[];
  blockingErrors: string[];
  canConfirm: boolean;
}

export async function previewVoiceImport(db: PrismaClient, splitId: string, weekId: string, file: VoiceFileInput): Promise<VoicePreview> {
  const { split, weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);
  assertSplitAcceptsLoads(split, "Llamadas");

  const [readResult, applicableParticipants, config, existing] = await Promise.all([
    readVoiceWorkbook(file.buffer),
    listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber),
    getActiveVoiceAmbassadorConfig(db, splitId),
    db.voiceImport.findUnique({ where: { splitWeekId: resolvedWeekId } }),
  ]);

  const matchResult = matchRowsToParticipants<VoiceSourceRow>(applicableParticipants, readResult.rows);
  const foundMatches = matchResult.matches.filter(isFoundMatch);

  const found: VoicePreviewParticipantRow[] = foundMatches.map((match) => ({
    participantId: match.participant.id,
    alias: match.participant.alias,
    fullName: match.participant.person.fullName,
    level: match.participant.level,
    sourceAgentName: match.row.sourceAgentName,
    acceptedCallSegments: match.row.acceptedCallSegments,
    rejectedCallSegments: match.row.rejectedCallSegments,
    unattendedCallSegments: match.row.unattendedCallSegments,
    outboundCalls: match.row.outboundCalls,
    segmentDurationHours: match.row.segmentDurationHours.toNumber(),
    segmentTalkTimeHours: match.row.segmentTalkTimeHours.toNumber(),
    segmentWrapUpTimeHours: match.row.segmentWrapUpTimeHours.toNumber(),
    segmentTalkTimeMinutes: match.row.segmentTalkTimeMinutes.toNumber(),
    segmentWrapUpTimeMinutes: match.row.segmentWrapUpTimeMinutes.toNumber(),
    voiceAmbassador: config
      ? toVoiceAmbassadorOutcomeView(
          resolveVoiceAmbassadorOutcome(
            config,
            match.participant.level,
            match.row.acceptedCallSegments,
            match.row.rejectedCallSegments,
            match.row.unattendedCallSegments,
            match.row.outboundCalls,
          ),
        )
      : null,
  }));

  const blockingErrors: string[] = [
    ...readResult.errors.map(formatXlsxRowError),
    ...(matchResult.hasAmbiguity
      ? ["Hay nombres que coinciden con mas de un participante aplicable: resuelvelo antes de confirmar."]
      : []),
  ];
  if (readResult.errors.length === 0 && found.length === 0) {
    blockingErrors.push("Debe existir al menos una fila encontrada para poder confirmar la carga.");
  }

  return {
    weekSequenceNumber,
    originalFilename: file.originalFilename,
    existingImport: existing
      ? { originalFilename: existing.originalFilename, importedRowCount: existing.importedRowCount, createdAt: existing.createdAt }
      : null,
    sourceRowCount: readResult.sourceRowCount,
    voiceAmbassadorActive: config !== null,
    found,
    ignoredRows: matchResult.matches
      .filter(isIgnoredMatch)
      .map((match) => ({ rowNumber: match.row.rowNumber, sourceAgentName: match.row.sourceAgentName })),
    missingParticipants: matchResult.missingParticipants.map((participant) => ({
      participantId: participant.id,
      alias: participant.alias,
      fullName: participant.person.fullName,
    })),
    ambiguousRows: matchResult.matches.filter(isAmbiguousMatch).map((match) => ({
      rowNumber: match.row.rowNumber,
      sourceAgentName: match.row.sourceAgentName,
      candidateAliases: match.participants.map((participant) => participant.alias),
    })),
    blockingErrors,
    canConfirm: blockingErrors.length === 0,
  };
}

export async function confirmVoiceImport(db: PrismaClient, splitId: string, weekId: string, file: VoiceFileInput): Promise<void> {
  const { split, weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);
  assertSplitAcceptsLoads(split, "Llamadas");

  const [readResult, applicableParticipants] = await Promise.all([
    readVoiceWorkbook(file.buffer),
    listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber),
  ]);

  if (readResult.errors.length > 0) {
    throw new DomainError("El archivo tiene errores que impiden confirmar la carga. Vuelve a analizarlo.");
  }

  const matchResult = matchRowsToParticipants<VoiceSourceRow>(applicableParticipants, readResult.rows);
  if (matchResult.hasAmbiguity) {
    throw new DomainError(
      "Hay nombres que coinciden con mas de un participante aplicable. Corrige el archivo antes de confirmar.",
    );
  }

  const foundMatches = matchResult.matches.filter(isFoundMatch);
  if (foundMatches.length === 0) {
    throw new DomainError("No se encontro ningun participante aplicable en el archivo.");
  }

  const fileSha256 = createHash("sha256").update(file.buffer).digest("hex");

  await db.$transaction(async (tx) => {
    const existing = await tx.voiceImport.findUnique({ where: { splitWeekId: resolvedWeekId } });
    if (existing) {
      await tx.voiceImport.delete({ where: { id: existing.id } });
    }

    const created = await tx.voiceImport.create({
      data: {
        splitWeekId: resolvedWeekId,
        originalFilename: file.originalFilename,
        fileSha256,
        sourceRowCount: readResult.sourceRowCount,
        importedRowCount: foundMatches.length,
      },
    });

    await tx.voiceWeeklyRow.createMany({
      data: foundMatches.map((match) => ({
        voiceImportId: created.id,
        splitParticipantId: match.participant.id,
        sourceAgentName: match.row.sourceAgentName,
        acceptedCallSegments: match.row.acceptedCallSegments,
        rejectedCallSegments: match.row.rejectedCallSegments,
        unattendedCallSegments: match.row.unattendedCallSegments,
        outboundCalls: match.row.outboundCalls,
        segmentDurationHours: match.row.segmentDurationHours,
        segmentTalkTimeHours: match.row.segmentTalkTimeHours,
        segmentWrapUpTimeHours: match.row.segmentWrapUpTimeHours,
        segmentTalkTimeMinutes: match.row.segmentTalkTimeMinutes,
        segmentWrapUpTimeMinutes: match.row.segmentWrapUpTimeMinutes,
      })),
    });
  });
}

/** `PENDING` sin carga, `LOADED` con carga confirmada (aunque falten participantes), con `n VAC`. */
export async function getVoiceLoadStatus(
  db: PrismaClient,
  splitId: string,
  weekId: string,
  weekSequenceNumber: number,
): Promise<LoadCoverageStatus> {
  const existing = await db.voiceImport.findUnique({ where: { splitWeekId: weekId }, include: { rows: true } });
  if (!existing) return { status: "PENDING", vacCount: 0 };

  const applicableParticipants = await listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber);
  const coveredParticipantIds = new Set(existing.rows.map((row) => row.splitParticipantId));
  const vacCount = applicableParticipants.filter((participant) => !coveredParticipantIds.has(participant.id)).length;
  return { status: "LOADED", vacCount };
}

export interface VoiceCheckRow extends Partial<VoiceTimeMetrics> {
  participantId: string;
  alias: string;
  fullName: string;
  level: ParticipantLevel;
  acceptedCallSegments: number | undefined;
  rejectedCallSegments: number | undefined;
  unattendedCallSegments: number | undefined;
  outboundCalls: number | undefined;
  voiceAmbassador: VoiceAmbassadorOutcomeView | null;
}

export interface VoiceCheckView {
  weekSequenceNumber: number;
  hasImport: boolean;
  originalFilename: string | null;
  createdAt: Date | null;
  sourceRowCount: number | null;
  importedRowCount: number | null;
  voiceAmbassadorActive: boolean;
  rows: VoiceCheckRow[];
}

export async function getVoiceCheckView(db: PrismaClient, splitId: string, weekId: string): Promise<VoiceCheckView> {
  const { weekSequenceNumber, weekId: resolvedWeekId } = await loadWeekContext(db, splitId, weekId);

  const [applicableParticipants, existing, config] = await Promise.all([
    listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber),
    db.voiceImport.findUnique({ where: { splitWeekId: resolvedWeekId }, include: { rows: true } }),
    getActiveVoiceAmbassadorConfig(db, splitId),
  ]);

  const rowByParticipantId = new Map(existing?.rows.map((row) => [row.splitParticipantId, row]) ?? []);

  const rows: VoiceCheckRow[] = applicableParticipants.map((participant) => {
    const row = rowByParticipantId.get(participant.id);
    return {
      participantId: participant.id,
      alias: participant.alias,
      fullName: participant.person.fullName,
      level: participant.level,
      acceptedCallSegments: row?.acceptedCallSegments,
      rejectedCallSegments: row?.rejectedCallSegments,
      unattendedCallSegments: row?.unattendedCallSegments,
      outboundCalls: row?.outboundCalls,
      ...(row ? decimalRowToTimeMetrics(row) : {}),
      voiceAmbassador: config
        ? toVoiceAmbassadorOutcomeView(
            resolveVoiceAmbassadorOutcome(
              config,
              participant.level,
              row?.acceptedCallSegments,
              row?.rejectedCallSegments,
              row?.unattendedCallSegments,
              row?.outboundCalls,
            ),
          )
        : null,
    };
  });

  return {
    weekSequenceNumber,
    hasImport: existing !== null,
    originalFilename: existing?.originalFilename ?? null,
    createdAt: existing?.createdAt ?? null,
    sourceRowCount: existing?.sourceRowCount ?? null,
    importedRowCount: existing?.importedRowCount ?? null,
    voiceAmbassadorActive: config !== null,
    rows,
  };
}
