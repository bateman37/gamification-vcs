import { createHash } from "node:crypto";
import type { ParticipantLevel, PrismaClient } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { loadWeekContext, assertSplitAcceptsLoads } from "@/server/services/shared/week-context";
import { listApplicableParticipantsForWeek } from "@/server/services/participant.service";
import { listKpiConfigsForSplit } from "@/server/services/kpi.service";
import { toKpiConfigView, type KpiConfigView } from "@/domain/kpis/mapping";
import { resolveMasterCraftsmanOutcome, toMasterCraftsmanOutcomeView, type MasterCraftsmanOutcomeView } from "@/domain/kpis/quality";
import type { LoadCoverageStatus } from "@/domain/kpis/loadGroups";
import { readQualityWorkbook, type QualitySourceRow } from "@/server/services/quality/excel-reader";
import { formatXlsxRowError } from "@/server/services/shared/xlsx";
import { isAmbiguousMatch, isFoundMatch, isIgnoredMatch, matchRowsToParticipants } from "@/server/services/shared/matching";

/** Carga semanal de Calidad y calculo de Maestro Artesano (ver docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md). */

export interface QualityFileInput {
  buffer: Buffer;
  originalFilename: string;
}

async function getActiveMasterCraftsmanConfig(db: PrismaClient, splitId: string): Promise<KpiConfigView | null> {
  const kpiConfigs = await listKpiConfigsForSplit(db, splitId);
  const config = kpiConfigs.find((entry) => entry.kpiCode === "MASTER_CRAFTSMAN") ?? null;
  return config?.isActive ? toKpiConfigView(config) : null;
}

export interface QualityPreviewParticipantRow {
  participantId: string;
  alias: string;
  fullName: string;
  level: ParticipantLevel;
  sourceAgentName: string;
  goodSatisfactionTickets: number;
  badSatisfactionTickets: number;
  masterCraftsman: MasterCraftsmanOutcomeView | null;
}

export interface QualityExistingImportSummary {
  originalFilename: string;
  importedRowCount: number;
  createdAt: Date;
}

export interface QualityPreview {
  weekSequenceNumber: number;
  originalFilename: string;
  existingImport: QualityExistingImportSummary | null;
  sourceRowCount: number;
  masterCraftsmanActive: boolean;
  found: QualityPreviewParticipantRow[];
  ignoredRows: { rowNumber: number; sourceAgentName: string }[];
  missingParticipants: { participantId: string; alias: string; fullName: string }[];
  ambiguousRows: { rowNumber: number; sourceAgentName: string; candidateAliases: string[] }[];
  blockingErrors: string[];
  canConfirm: boolean;
}

export async function previewQualityImport(
  db: PrismaClient,
  splitId: string,
  weekId: string,
  file: QualityFileInput,
): Promise<QualityPreview> {
  const { split, weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);
  assertSplitAcceptsLoads(split, "Calidad");

  const [readResult, applicableParticipants, config, existing] = await Promise.all([
    readQualityWorkbook(file.buffer),
    listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber),
    getActiveMasterCraftsmanConfig(db, splitId),
    db.qualityImport.findUnique({ where: { splitWeekId: resolvedWeekId } }),
  ]);

  const matchResult = matchRowsToParticipants<QualitySourceRow>(applicableParticipants, readResult.rows);
  const foundMatches = matchResult.matches.filter(isFoundMatch);

  const found: QualityPreviewParticipantRow[] = foundMatches.map((match) => ({
    participantId: match.participant.id,
    alias: match.participant.alias,
    fullName: match.participant.person.fullName,
    level: match.participant.level,
    sourceAgentName: match.row.sourceAgentName,
    goodSatisfactionTickets: match.row.goodSatisfactionTickets,
    badSatisfactionTickets: match.row.badSatisfactionTickets,
    masterCraftsman: config
      ? toMasterCraftsmanOutcomeView(
          resolveMasterCraftsmanOutcome(config, match.participant.level, match.row.goodSatisfactionTickets, match.row.badSatisfactionTickets),
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
    masterCraftsmanActive: config !== null,
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

export async function confirmQualityImport(db: PrismaClient, splitId: string, weekId: string, file: QualityFileInput): Promise<void> {
  const { split, weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);
  assertSplitAcceptsLoads(split, "Calidad");

  const [readResult, applicableParticipants] = await Promise.all([
    readQualityWorkbook(file.buffer),
    listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber),
  ]);

  if (readResult.errors.length > 0) {
    throw new DomainError("El archivo tiene errores que impiden confirmar la carga. Vuelve a analizarlo.");
  }

  const matchResult = matchRowsToParticipants<QualitySourceRow>(applicableParticipants, readResult.rows);
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
    const existing = await tx.qualityImport.findUnique({ where: { splitWeekId: resolvedWeekId } });
    if (existing) {
      await tx.qualityImport.delete({ where: { id: existing.id } });
    }

    const created = await tx.qualityImport.create({
      data: {
        splitWeekId: resolvedWeekId,
        originalFilename: file.originalFilename,
        fileSha256,
        sourceRowCount: readResult.sourceRowCount,
        importedRowCount: foundMatches.length,
      },
    });

    await tx.qualityWeeklyRow.createMany({
      data: foundMatches.map((match) => ({
        qualityImportId: created.id,
        splitParticipantId: match.participant.id,
        sourceAgentName: match.row.sourceAgentName,
        goodSatisfactionTickets: match.row.goodSatisfactionTickets,
        badSatisfactionTickets: match.row.badSatisfactionTickets,
      })),
    });
  });
}

/** `PENDING` sin carga, `LOADED` con carga confirmada (aunque falten participantes: ver docs/DECISIONS.md), con `n VAC`. */
export async function getQualityLoadStatus(
  db: PrismaClient,
  splitId: string,
  weekId: string,
  weekSequenceNumber: number,
): Promise<LoadCoverageStatus> {
  const existing = await db.qualityImport.findUnique({ where: { splitWeekId: weekId }, include: { rows: true } });
  if (!existing) return { status: "PENDING", vacCount: 0 };

  const applicableParticipants = await listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber);
  const coveredParticipantIds = new Set(existing.rows.map((row) => row.splitParticipantId));
  const vacCount = applicableParticipants.filter((participant) => !coveredParticipantIds.has(participant.id)).length;
  return { status: "LOADED", vacCount };
}

export interface QualityCheckRow {
  participantId: string;
  alias: string;
  fullName: string;
  level: ParticipantLevel;
  goodSatisfactionTickets: number | undefined;
  badSatisfactionTickets: number | undefined;
  masterCraftsman: MasterCraftsmanOutcomeView | null;
}

export interface QualityCheckView {
  weekSequenceNumber: number;
  hasImport: boolean;
  originalFilename: string | null;
  createdAt: Date | null;
  sourceRowCount: number | null;
  importedRowCount: number | null;
  masterCraftsmanActive: boolean;
  rows: QualityCheckRow[];
}

export async function getQualityCheckView(db: PrismaClient, splitId: string, weekId: string): Promise<QualityCheckView> {
  const { weekSequenceNumber, weekId: resolvedWeekId } = await loadWeekContext(db, splitId, weekId);

  const [applicableParticipants, existing, config] = await Promise.all([
    listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber),
    db.qualityImport.findUnique({ where: { splitWeekId: resolvedWeekId }, include: { rows: true } }),
    getActiveMasterCraftsmanConfig(db, splitId),
  ]);

  const rowByParticipantId = new Map(existing?.rows.map((row) => [row.splitParticipantId, row]) ?? []);

  const rows: QualityCheckRow[] = applicableParticipants.map((participant) => {
    const row = rowByParticipantId.get(participant.id);
    return {
      participantId: participant.id,
      alias: participant.alias,
      fullName: participant.person.fullName,
      level: participant.level,
      goodSatisfactionTickets: row?.goodSatisfactionTickets,
      badSatisfactionTickets: row?.badSatisfactionTickets,
      masterCraftsman: config
        ? toMasterCraftsmanOutcomeView(
            resolveMasterCraftsmanOutcome(config, participant.level, row?.goodSatisfactionTickets, row?.badSatisfactionTickets),
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
    masterCraftsmanActive: config !== null,
    rows,
  };
}
