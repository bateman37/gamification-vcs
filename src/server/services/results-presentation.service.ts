import type { PrismaClient } from "@prisma/client";
import { computeSplitClassification } from "@/server/services/classification.service";
import { computeFactionClassification } from "@/server/services/faction-classification.service";

/**
 * Servicio de lectura de "Presentar resultados" (`1.0.1`, parte I del
 * encargo): construye el DTO listo para proyectar la ultima semana
 * publicada de un split, reutilizando los servicios de clasificacion ya
 * existentes (nunca reimplementa el ranking, el top-3 de facciones ni el
 * criterio de desempate). No escribe nada, no recalcula KPI ni bonus, y
 * excluye explicitamente `fullName`/`email` y cualquier byte de avatar
 * (`imageData`): solo carga la version del avatar (`sha256`) para poder
 * construir la URL de la imagen ya existente.
 */

export interface PresentationParticipant {
  splitParticipantId: string;
  alias: string;
  avatarVersion: string | null;
  rank: number;
  points: number;
}

export interface PresentationFaction {
  factionId: string;
  name: string;
  color: string;
  rank: number;
  score: number;
  topContributors: { alias: string; positionPoints: number }[];
}

export interface GeneralIndividualRow {
  splitParticipantId: string;
  alias: string;
  rank: number;
  totalPositionPoints: number;
  totalKpiPoints: number;
}

export interface GeneralFactionRow {
  factionId: string;
  name: string;
  color: string;
  rank: number;
  totalScore: number;
}

export interface SplitResultsPresentationData {
  splitId: string;
  splitName: string;
  weekSequenceNumber: number;
  weekStartDate: Date;
  weekEndDate: Date;
  publishedAt: Date;
  /** Top 6 (con empates) de la clasificacion individual de esa semana. Excluye siempre a las ausencias (`1.1.1`). */
  weeklyIndividualTop: PresentationParticipant[];
  /** Presentes de la ultima semana publicada (`1.1.1`): `0` activa el estado vacio "No hay participantes presentes en esta semana". */
  weeklyPresentCount: number;
  /** Top 6 (con empates) de la clasificacion general individual acumulada hasta esa semana. */
  generalIndividualTop: PresentationParticipant[];
  /** Tabla completa (no solo el top 6) para la pantalla final de resumen. */
  generalIndividualFull: GeneralIndividualRow[];
  hasFactionData: boolean;
  weeklyFactionTop: PresentationFaction[];
  generalFactionTop: PresentationFaction[];
  generalFactionFull: GeneralFactionRow[];
}

export type SplitResultsPresentation = { available: false } | { available: true; data: SplitResultsPresentationData };

export async function buildSplitResultsPresentation(db: PrismaClient, splitId: string): Promise<SplitResultsPresentation> {
  const split = await db.split.findUnique({ where: { id: splitId }, select: { id: true, name: true } });
  if (!split) return { available: false };

  // La ultima semana publicada del split: por numero de secuencia, nunca por la ultima semana
  // del calendario (una semana completa pero sin publicar no cuenta como "presentable").
  const lastPublication = await db.weekPublication.findFirst({
    where: { splitWeek: { splitId } },
    orderBy: { splitWeek: { sequenceNumber: "desc" } },
    include: { splitWeek: true },
  });
  if (!lastPublication) return { available: false };

  const [weeklyResults, classification, factionClassification] = await Promise.all([
    db.publishedParticipantWeeklyResult.findMany({ where: { publicationId: lastPublication.id } }),
    computeSplitClassification(db, splitId),
    computeFactionClassification(db, splitId),
  ]);

  const splitParticipantIds = new Set<string>();
  for (const row of weeklyResults) splitParticipantIds.add(row.splitParticipantId);
  for (const entry of classification.entries) splitParticipantIds.add(entry.splitParticipantId);

  // Una unica consulta por avatares: solo el hash (nunca `imageData`), para poder construir la
  // URL de la imagen ya existente sin cargar bytes en esta lectura.
  const avatars = await db.splitParticipantAvatar.findMany({
    where: { splitParticipantId: { in: Array.from(splitParticipantIds) } },
    select: { splitParticipantId: true, sha256: true },
  });
  const avatarVersionById = new Map(avatars.map((avatar) => [avatar.splitParticipantId, avatar.sha256]));

  // Una ausencia no tiene posicion semanal (`1.1.1`, ver docs/WEEKLY_ATTENDANCE_AND_HOURS.md): nunca
  // entra en el top semanal, aunque conserve sus puntos por posicion en la clasificacion general.
  const weeklyIndividualTop: PresentationParticipant[] = weeklyResults
    .filter((row): row is typeof row & { weeklyRank: number } => row.weeklyRank !== null && row.weeklyRank <= 6)
    .map((row) => ({
      splitParticipantId: row.splitParticipantId,
      alias: row.aliasSnapshot,
      avatarVersion: avatarVersionById.get(row.splitParticipantId) ?? null,
      rank: row.weeklyRank,
      points: row.totalKpiPoints.toNumber(),
    }));
  const weeklyPresentCount = weeklyResults.filter((row) => row.attendanceStatus !== "ABSENT").length;

  const generalIndividualTop: PresentationParticipant[] = classification.entries
    .filter((entry) => entry.rank <= 6)
    .map((entry) => ({
      splitParticipantId: entry.splitParticipantId,
      alias: entry.alias,
      avatarVersion: avatarVersionById.get(entry.splitParticipantId) ?? null,
      rank: entry.rank,
      points: entry.totalPositionPoints,
    }));

  const generalIndividualFull: GeneralIndividualRow[] = classification.entries.map((entry) => ({
    splitParticipantId: entry.splitParticipantId,
    alias: entry.alias,
    rank: entry.rank,
    totalPositionPoints: entry.totalPositionPoints,
    totalKpiPoints: entry.totalKpiPoints,
  }));

  const lastWeekFactionClassification = factionClassification.weekClassifications.get(lastPublication.splitWeekId);
  const weeklyFactionTop: PresentationFaction[] = (lastWeekFactionClassification?.entries ?? [])
    .filter((entry) => entry.weeklyRank <= 6)
    .map((entry) => ({
      factionId: entry.factionId,
      name: entry.name,
      color: entry.color,
      rank: entry.weeklyRank,
      score: entry.weeklyScore,
      topContributors: entry.topContributors.map((contributor) => ({ alias: contributor.alias, positionPoints: contributor.positionPoints })),
    }));

  const generalFactionTop: PresentationFaction[] = factionClassification.accumulated
    .filter((entry) => entry.rank <= 6)
    .map((entry) => ({
      factionId: entry.factionId,
      name: entry.name,
      color: entry.color,
      rank: entry.rank,
      score: entry.totalScore,
      topContributors: [],
    }));

  const generalFactionFull: GeneralFactionRow[] = factionClassification.accumulated.map((entry) => ({
    factionId: entry.factionId,
    name: entry.name,
    color: entry.color,
    rank: entry.rank,
    totalScore: entry.totalScore,
  }));

  return {
    available: true,
    data: {
      splitId: split.id,
      splitName: split.name,
      weekSequenceNumber: lastPublication.splitWeek.sequenceNumber,
      weekStartDate: lastPublication.splitWeek.startDate,
      weekEndDate: lastPublication.splitWeek.endDate,
      publishedAt: lastPublication.publishedAt,
      weeklyIndividualTop,
      weeklyPresentCount,
      generalIndividualTop,
      generalIndividualFull,
      hasFactionData: factionClassification.hasFactionData,
      weeklyFactionTop,
      generalFactionTop,
      generalFactionFull,
    },
  };
}
