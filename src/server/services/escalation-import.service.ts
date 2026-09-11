import { createHash } from "node:crypto";
import type { ParticipantLevel, PrismaClient } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { loadWeekContext, assertSplitAcceptsLoads, assertWeekIsEditable } from "@/server/services/shared/week-context";
import { listApplicableParticipantsForWeek } from "@/server/services/participant.service";
import { listKpiConfigsForSplit } from "@/server/services/kpi.service";
import { getProductivityUpdatesByParticipant } from "@/server/services/productivity-import.service";
import { toKpiConfigView, type KpiConfigView } from "@/domain/kpis/mapping";
import { resolveEscalationTamerOutcome, toEscalationTamerOutcomeView, type EscalationTamerOutcomeView } from "@/domain/kpis/escalation";
import type { LoadCoverageStatus } from "@/domain/kpis/loadGroups";
import { readEscalationWorkbook, type EscalationSourceRow } from "@/server/services/escalation/excel-reader";
import { formatXlsxRowError } from "@/server/services/shared/xlsx";
import { isAmbiguousMatch, isFoundMatch, isIgnoredMatch, matchRowsToParticipants } from "@/server/services/shared/matching";

/**
 * Carga semanal de Escalados y calculo de Domador de Escaladas (ver
 * docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md). Domador depende de dos
 * origenes de la misma semana y participante: este archivo (Excel de
 * Escalados) y Productividad ya persistida (`updates`). Este servicio
 * nunca crea ni modifica Productividad: solo la lee.
 */

export interface EscalationFileInput {
  buffer: Buffer;
  originalFilename: string;
}

async function getActiveEscalationTamerConfig(db: PrismaClient, splitId: string): Promise<KpiConfigView | null> {
  const kpiConfigs = await listKpiConfigsForSplit(db, splitId);
  const config = kpiConfigs.find((entry) => entry.kpiCode === "ESCALATION_TAMER") ?? null;
  return config?.isActive ? toKpiConfigView(config) : null;
}

export interface EscalationPreviewParticipantRow {
  participantId: string;
  alias: string;
  fullName: string;
  level: ParticipantLevel;
  sourceAgentName: string;
  groupReassignments: number;
  /** `updates` de Productividad de la misma semana; `undefined` si falta esa dependencia. */
  updates: number | undefined;
  escalationTamer: EscalationTamerOutcomeView | null;
}

export interface EscalationExistingImportSummary {
  originalFilename: string;
  importedRowCount: number;
  createdAt: Date;
}

export interface EscalationPreview {
  weekSequenceNumber: number;
  originalFilename: string;
  existingImport: EscalationExistingImportSummary | null;
  sourceRowCount: number;
  escalationTamerActive: boolean;
  found: EscalationPreviewParticipantRow[];
  ignoredRows: { rowNumber: number; sourceAgentName: string }[];
  missingParticipants: { participantId: string; alias: string; fullName: string }[];
  ambiguousRows: { rowNumber: number; sourceAgentName: string; candidateAliases: string[] }[];
  blockingErrors: string[];
  canConfirm: boolean;
}

/**
 * Analiza un Excel de Escalados para una semana sin escribir nada en la
 * base de datos. Consulta Productividad ya persistida solo para mostrar la
 * dependencia; nunca la crea ni la modifica.
 */
export async function previewEscalationImport(
  db: PrismaClient,
  splitId: string,
  weekId: string,
  file: EscalationFileInput,
): Promise<EscalationPreview> {
  const { split, weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);
  assertSplitAcceptsLoads(split, "Escalados");

  const [readResult, applicableParticipants, config, existing, updatesByParticipant] = await Promise.all([
    readEscalationWorkbook(file.buffer),
    listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber),
    getActiveEscalationTamerConfig(db, splitId),
    db.escalationImport.findUnique({ where: { splitWeekId: resolvedWeekId } }),
    getProductivityUpdatesByParticipant(db, resolvedWeekId),
  ]);

  const matchResult = matchRowsToParticipants<EscalationSourceRow>(applicableParticipants, readResult.rows);
  const foundMatches = matchResult.matches.filter(isFoundMatch);

  const found: EscalationPreviewParticipantRow[] = foundMatches.map((match) => {
    const updates = updatesByParticipant.get(match.participant.id);
    return {
      participantId: match.participant.id,
      alias: match.participant.alias,
      fullName: match.participant.person.fullName,
      level: match.participant.level,
      sourceAgentName: match.row.sourceAgentName,
      groupReassignments: match.row.groupReassignments,
      updates,
      escalationTamer: config
        ? toEscalationTamerOutcomeView(
            resolveEscalationTamerOutcome(config, match.participant.level, {
              hasEscalationImport: true,
              groupReassignments: match.row.groupReassignments,
              updates,
            }),
          )
        : null,
    };
  });

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
    escalationTamerActive: config !== null,
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
 * Confirma (o sustituye) la carga de Escalados de una semana. Vuelve a leer
 * y validar el archivo en servidor. Nunca toca Productividad ni ningun
 * otro origen.
 */
export async function confirmEscalationImport(
  db: PrismaClient,
  splitId: string,
  weekId: string,
  file: EscalationFileInput,
): Promise<void> {
  const { split, weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);
  assertSplitAcceptsLoads(split, "Escalados");
  await assertWeekIsEditable(db, resolvedWeekId);

  const [readResult, applicableParticipants] = await Promise.all([
    readEscalationWorkbook(file.buffer),
    listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber),
  ]);

  if (readResult.errors.length > 0) {
    throw new DomainError("El archivo tiene errores que impiden confirmar la carga. Vuelve a analizarlo.");
  }

  const matchResult = matchRowsToParticipants<EscalationSourceRow>(applicableParticipants, readResult.rows);
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
    const existing = await tx.escalationImport.findUnique({ where: { splitWeekId: resolvedWeekId } });
    if (existing) {
      await tx.escalationImport.delete({ where: { id: existing.id } });
    }

    const created = await tx.escalationImport.create({
      data: {
        splitWeekId: resolvedWeekId,
        originalFilename: file.originalFilename,
        fileSha256,
        sourceRowCount: readResult.sourceRowCount,
        importedRowCount: foundMatches.length,
      },
    });

    await tx.escalationWeeklyRow.createMany({
      data: foundMatches.map((match) => ({
        escalationImportId: created.id,
        splitParticipantId: match.participant.id,
        sourceAgentName: match.row.sourceAgentName,
        groupReassignments: match.row.groupReassignments,
      })),
    });
  });
}

/**
 * Estado del grupo Domador de Escaladas: `PENDING` sin ningun origen,
 * `PARTIAL` (ambar) con exactamente uno de los dos, `LOADED` (verde) con
 * ambos, con `n VAC` de participantes aplicables sin fila ni en Escalados
 * ni en Productividad (hotfix `MVP-1C.3 / INPUT-1C`: quien tiene fila en
 * uno de los dos origenes ya no cuenta como VAC, porque su ausencia en el
 * otro se resuelve como cero implicito o como "Falta Productividad", nunca
 * como VAC). Nunca vuelve a amarillo por falta de participantes con ambos
 * origenes presentes.
 */
export async function getEscalationLoadStatus(
  db: PrismaClient,
  splitId: string,
  weekId: string,
  weekSequenceNumber: number,
): Promise<LoadCoverageStatus> {
  const [escalationImport, productivityImport] = await Promise.all([
    db.escalationImport.findUnique({ where: { splitWeekId: weekId }, include: { rows: true } }),
    db.productivityImport.findUnique({ where: { splitWeekId: weekId }, include: { rows: true } }),
  ]);

  const hasEscalation = escalationImport !== null;
  const hasProductivity = productivityImport !== null;

  if (!hasEscalation && !hasProductivity) return { status: "PENDING", vacCount: 0 };
  if (hasEscalation !== hasProductivity) return { status: "PARTIAL", vacCount: 0 };

  const applicableParticipants = await listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber);
  const escalationParticipantIds = new Set((escalationImport?.rows ?? []).map((row) => row.splitParticipantId));
  const productivityParticipantIds = new Set((productivityImport?.rows ?? []).map((row) => row.splitParticipantId));
  const vacCount = applicableParticipants.filter(
    (participant) => !escalationParticipantIds.has(participant.id) && !productivityParticipantIds.has(participant.id),
  ).length;
  return { status: "LOADED", vacCount };
}

export interface EscalationCheckRow {
  participantId: string;
  alias: string;
  fullName: string;
  level: ParticipantLevel;
  groupReassignments: number | undefined;
  updates: number | undefined;
  escalationTamer: EscalationTamerOutcomeView | null;
}

export interface EscalationCheckView {
  weekSequenceNumber: number;
  hasEscalationImport: boolean;
  escalationOriginalFilename: string | null;
  hasProductivityImport: boolean;
  escalationTamerActive: boolean;
  rows: EscalationCheckRow[];
}

/** Datos para "Comprobar": todos los participantes aplicables, con Escalados y Productividad en columnas separadas. */
export async function getEscalationCheckView(db: PrismaClient, splitId: string, weekId: string): Promise<EscalationCheckView> {
  const { weekId: resolvedWeekId, weekSequenceNumber } = await loadWeekContext(db, splitId, weekId);

  const [applicableParticipants, escalationImport, productivityImport, config] = await Promise.all([
    listApplicableParticipantsForWeek(db, splitId, weekSequenceNumber),
    db.escalationImport.findUnique({ where: { splitWeekId: resolvedWeekId }, include: { rows: true } }),
    db.productivityImport.findUnique({ where: { splitWeekId: resolvedWeekId }, include: { rows: true } }),
    getActiveEscalationTamerConfig(db, splitId),
  ]);

  const escalationRowByParticipant = new Map(escalationImport?.rows.map((row) => [row.splitParticipantId, row]) ?? []);
  const updatesByParticipant = new Map(productivityImport?.rows.map((row) => [row.splitParticipantId, row.updates]) ?? []);

  const hasEscalationImport = escalationImport !== null;
  const rows: EscalationCheckRow[] = applicableParticipants.map((participant) => {
    const escalationRow = escalationRowByParticipant.get(participant.id);
    const updates = updatesByParticipant.get(participant.id);
    return {
      participantId: participant.id,
      alias: participant.alias,
      fullName: participant.person.fullName,
      level: participant.level,
      groupReassignments: escalationRow?.groupReassignments,
      updates,
      escalationTamer: config
        ? toEscalationTamerOutcomeView(
            resolveEscalationTamerOutcome(config, participant.level, {
              hasEscalationImport,
              groupReassignments: escalationRow?.groupReassignments,
              updates,
            }),
          )
        : null,
    };
  });

  return {
    weekSequenceNumber,
    hasEscalationImport: escalationImport !== null,
    escalationOriginalFilename: escalationImport?.originalFilename ?? null,
    hasProductivityImport: productivityImport !== null,
    escalationTamerActive: config !== null,
    rows,
  };
}
