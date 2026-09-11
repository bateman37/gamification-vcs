import { createHash } from "node:crypto";
import type { ParticipantLevel, Prisma, PrismaClient, Split } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { getSplitWeek } from "@/server/services/split.service";
import { listApplicableParticipantsForWeek, type ParticipantWithPerson } from "@/server/services/participant.service";
import { listKpiConfigsForSplit } from "@/server/services/kpi.service";
import { toKpiConfigView, type KpiConfigView } from "@/domain/kpis/mapping";
import {
  resolveDataExplorerOutcome,
  resolveSolutionHunterOutcome,
  toProductivityKpiOutcomeView,
  type ProductivityKpiOutcomeView,
} from "@/domain/kpis/productivity";
import type { LoadGroupStatus } from "@/domain/kpis/loadGroups";
import {
  readProductivityWorkbook,
  type ProductivityRowError,
  type ProductivitySourceRow,
} from "@/server/services/productivity/excel-reader";
import { isAmbiguousMatch, isFoundMatch, isIgnoredMatch, matchProductivityRows } from "@/server/services/productivity/matching";

type Db = PrismaClient | Prisma.TransactionClient;

export interface ProductivityFileInput {
  buffer: Buffer;
  originalFilename: string;
}

interface WeekContext {
  split: Split;
  weekId: string;
  weekSequenceNumber: number;
}

async function loadWeekContext(db: Db, splitId: string, weekId: string): Promise<WeekContext> {
  const split = await db.split.findUnique({ where: { id: splitId } });
  if (!split) {
    throw new DomainError("El split indicado no existe.");
  }
  const week = await getSplitWeek(db, splitId, weekId);
  if (!week) {
    throw new DomainError("La semana indicada no pertenece a este split.");
  }
  return { split, weekId: week.id, weekSequenceNumber: week.sequenceNumber };
}

function assertSplitAcceptsLoads(split: Split): void {
  if (split.status !== "ACTIVE") {
    throw new DomainError("Solo se puede analizar o confirmar una carga de productividad en un split activo.");
  }
}

async function getActiveProductivityConfigs(db: Db, splitId: string) {
  const kpiConfigs = await listKpiConfigsForSplit(db, splitId);
  const solutionHunter = kpiConfigs.find((config) => config.kpiCode === "SOLUTION_HUNTER") ?? null;
  const dataExplorer = kpiConfigs.find((config) => config.kpiCode === "DATA_EXPLORER") ?? null;
  return {
    solutionHunter: solutionHunter?.isActive ? toKpiConfigView(solutionHunter) : null,
    dataExplorer: dataExplorer?.isActive ? toKpiConfigView(dataExplorer) : null,
  };
}

function formatRowError(error: ProductivityRowError): string {
  return error.rowNumber > 0 ? `Fila ${error.rowNumber} - ${error.column}: ${error.message}` : error.message;
}

export interface ProductivityPreviewParticipantRow {
  participantId: string;
  alias: string;
  fullName: string;
  level: ParticipantLevel;
  sourceAgentName: string;
  ticketsResolved: number;
  ticketsUpdatedWithComment: number;
  solutionHunter: ProductivityKpiOutcomeView | null;
  dataExplorer: ProductivityKpiOutcomeView | null;
}

export interface ProductivityExistingImportSummary {
  originalFilename: string;
  importedRowCount: number;
  createdAt: Date;
}

export interface ProductivityPreview {
  weekSequenceNumber: number;
  originalFilename: string;
  existingImport: ProductivityExistingImportSummary | null;
  sourceRowCount: number;
  solutionHunterActive: boolean;
  dataExplorerActive: boolean;
  found: ProductivityPreviewParticipantRow[];
  ignoredRows: { rowNumber: number; sourceAgentName: string }[];
  missingParticipants: { participantId: string; alias: string; fullName: string }[];
  ambiguousRows: { rowNumber: number; sourceAgentName: string; candidateAliases: string[] }[];
  blockingErrors: string[];
  canConfirm: boolean;
}

function buildFoundRow(
  row: ProductivitySourceRow,
  participant: ParticipantWithPerson,
  solutionHunterConfig: KpiConfigView | null,
  dataExplorerConfig: KpiConfigView | null,
): ProductivityPreviewParticipantRow {
  return {
    participantId: participant.id,
    alias: participant.alias,
    fullName: participant.person.fullName,
    level: participant.level,
    sourceAgentName: row.sourceAgentName,
    ticketsResolved: row.ticketsResolved,
    ticketsUpdatedWithComment: row.ticketsUpdatedWithComment,
    solutionHunter: solutionHunterConfig
      ? toProductivityKpiOutcomeView(
          resolveSolutionHunterOutcome(solutionHunterConfig, participant.level, row.ticketsResolved),
        )
      : null,
    dataExplorer: dataExplorerConfig
      ? toProductivityKpiOutcomeView(
          resolveDataExplorerOutcome(dataExplorerConfig, participant.level, row.ticketsUpdatedWithComment),
        )
      : null,
  };
}

/**
 * Analiza un Excel de Productividad para una semana sin escribir nada en
 * la base de datos (ver docs/IMPORT_PRODUCTIVITY.md). Vuelve a validar el
 * split y la semana en servidor: nunca confia en datos ocultos enviados
 * por el navegador.
 */
export async function previewProductivityImport(
  db: PrismaClient,
  splitId: string,
  weekId: string,
  file: ProductivityFileInput,
): Promise<ProductivityPreview> {
  const { split, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);
  assertSplitAcceptsLoads(split);

  const [readResult, applicableParticipants, configs, existing] = await Promise.all([
    readProductivityWorkbook(file.buffer),
    listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber),
    getActiveProductivityConfigs(db, splitId),
    db.productivityImport.findUnique({ where: { splitWeekId: weekId } }),
  ]);

  const matchResult = matchProductivityRows(applicableParticipants, readResult.rows);
  const foundMatches = matchResult.matches.filter(isFoundMatch);

  const found = foundMatches.map((match) =>
    buildFoundRow(match.row, match.participant, configs.solutionHunter, configs.dataExplorer),
  );

  const blockingErrors: string[] = [
    ...readResult.errors.map(formatRowError),
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
    solutionHunterActive: configs.solutionHunter !== null,
    dataExplorerActive: configs.dataExplorer !== null,
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

/**
 * Confirma (o sustituye) la carga de Productividad de una semana. Vuelve a
 * leer y validar el archivo en servidor y realiza toda la escritura dentro
 * de una unica transaccion: si algo falla, la carga anterior (si existia)
 * queda intacta.
 */
export async function confirmProductivityImport(
  db: PrismaClient,
  splitId: string,
  weekId: string,
  file: ProductivityFileInput,
): Promise<void> {
  const { split, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);
  assertSplitAcceptsLoads(split);

  const [readResult, applicableParticipants] = await Promise.all([
    readProductivityWorkbook(file.buffer),
    listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber),
  ]);

  if (readResult.errors.length > 0) {
    throw new DomainError("El archivo tiene errores que impiden confirmar la carga. Vuelve a analizarlo.");
  }

  const matchResult = matchProductivityRows(applicableParticipants, readResult.rows);
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
    const existing = await tx.productivityImport.findUnique({ where: { splitWeekId: weekId } });
    if (existing) {
      await tx.productivityImport.delete({ where: { id: existing.id } });
    }

    const created = await tx.productivityImport.create({
      data: {
        splitWeekId: weekId,
        originalFilename: file.originalFilename,
        fileSha256,
        sourceRowCount: readResult.sourceRowCount,
        importedRowCount: foundMatches.length,
      },
    });

    await tx.productivityWeeklyRow.createMany({
      data: foundMatches.map((match) => ({
        productivityImportId: created.id,
        splitParticipantId: match.participant.id,
        sourceAgentName: match.row.sourceAgentName,
        updates: match.row.updates,
        comments: match.row.comments,
        publicComments: match.row.publicComments,
        internalComments: match.row.internalComments,
        ticketsUpdatedWithComment: match.row.ticketsUpdatedWithComment,
        ticketsResolved: match.row.ticketsResolved,
        ticketsCreated: match.row.ticketsCreated,
      })),
    });
  });
}

/**
 * Estado unico y visible del grupo de Productividad para una semana:
 * `PENDING` si no existe carga, `PARTIAL` si existe pero falta algun
 * participante aplicable, `LOADED` si todos tienen fila persistida.
 */
export async function getProductivityLoadStatus(
  db: PrismaClient,
  splitId: string,
  weekId: string,
  weekSequenceNumber: number,
): Promise<LoadGroupStatus> {
  const existing = await db.productivityImport.findUnique({
    where: { splitWeekId: weekId },
    include: { rows: true },
  });
  if (!existing) return "PENDING";

  const applicableParticipants = await listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber);
  const coveredParticipantIds = new Set(existing.rows.map((row) => row.splitParticipantId));
  const allCovered = applicableParticipants.every((participant) => coveredParticipantIds.has(participant.id));
  return allCovered ? "LOADED" : "PARTIAL";
}

export interface ProductivityCheckRow {
  participantId: string;
  alias: string;
  fullName: string;
  level: ParticipantLevel;
  ticketsResolved: number | undefined;
  ticketsUpdatedWithComment: number | undefined;
  solutionHunter: ProductivityKpiOutcomeView | null;
  dataExplorer: ProductivityKpiOutcomeView | null;
}

export interface ProductivityCheckView {
  weekSequenceNumber: number;
  hasImport: boolean;
  originalFilename: string | null;
  createdAt: Date | null;
  sourceRowCount: number | null;
  importedRowCount: number | null;
  solutionHunterActive: boolean;
  dataExplorerActive: boolean;
  rows: ProductivityCheckRow[];
}

/** Datos para la accion "Comprobar": todos los participantes aplicables, incluso sin fila. */
export async function getProductivityCheckView(
  db: PrismaClient,
  splitId: string,
  weekId: string,
): Promise<ProductivityCheckView> {
  const { weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);

  const [applicableParticipants, existing, configs] = await Promise.all([
    listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber),
    db.productivityImport.findUnique({ where: { splitWeekId: weekId }, include: { rows: true } }),
    getActiveProductivityConfigs(db, splitId),
  ]);

  const rowByParticipantId = new Map(existing?.rows.map((row) => [row.splitParticipantId, row]) ?? []);

  const rows: ProductivityCheckRow[] = applicableParticipants.map((participant) => {
    const row = rowByParticipantId.get(participant.id);
    return {
      participantId: participant.id,
      alias: participant.alias,
      fullName: participant.person.fullName,
      level: participant.level,
      ticketsResolved: row?.ticketsResolved,
      ticketsUpdatedWithComment: row?.ticketsUpdatedWithComment,
      solutionHunter: configs.solutionHunter
        ? toProductivityKpiOutcomeView(
            resolveSolutionHunterOutcome(configs.solutionHunter, participant.level, row?.ticketsResolved),
          )
        : null,
      dataExplorer: configs.dataExplorer
        ? toProductivityKpiOutcomeView(
            resolveDataExplorerOutcome(configs.dataExplorer, participant.level, row?.ticketsUpdatedWithComment),
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
    solutionHunterActive: configs.solutionHunter !== null,
    dataExplorerActive: configs.dataExplorer !== null,
    rows,
  };
}
