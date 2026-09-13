import { Prisma, type PrismaClient } from "@prisma/client";
import { rankByComparator, compareDecimalDescending, compareNormalizedAlias } from "@/domain/ranking";
import { KPI_CATALOG_LIST, type KpiCode } from "@/domain/kpis/catalog";
import type { WeeklyAttendanceStatus } from "@/domain/attendance";

/**
 * Clasificacion general de un split (seccion 9 de
 * docs/RESULTS_PUBLICATION.md): usa exclusivamente los puntos por posicion
 * semanal de las semanas publicadas. Nunca usa la suma cruda de KPI para
 * decidir el orden (solo como desempate y dato secundario).
 */

export interface ClassificationWeekColumn {
  splitWeekId: string;
  weekSequenceNumber: number;
  publishedAt: Date;
}

export interface ClassificationEntry {
  splitParticipantId: string;
  personId: string;
  alias: string;
  fullName: string;
  pointsByWeek: Map<string, number>;
  /** Posicion semanal (dentro de esa semana, no la acumulada) por `splitWeekId`. `null` para una ausencia esa semana o cuando nadie estuvo presente. */
  weeklyRankByWeek: Map<string, number | null>;
  totalKpiPointsByWeek: Map<string, number>;
  /** Asistencia congelada por semana (`1.1.1`). `null` en publicaciones anteriores a esta version: legado, sin dato. */
  attendanceStatusByWeek: Map<string, WeeklyAttendanceStatus | null>;
  totalPositionPoints: number;
  totalKpiPoints: number;
  publishedWeekCount: number;
  rank: number;
}

export interface SplitClassification {
  weeks: ClassificationWeekColumn[];
  entries: ClassificationEntry[];
}

interface WorkingEntry {
  splitParticipantId: string;
  personId: string;
  alias: string;
  fullName: string;
  pointsByWeek: Map<string, number>;
  weeklyRankByWeek: Map<string, number | null>;
  totalKpiPointsByWeek: Map<string, number>;
  attendanceStatusByWeek: Map<string, WeeklyAttendanceStatus | null>;
  totalPositionPointsDecimal: Prisma.Decimal;
  totalKpiPointsDecimal: Prisma.Decimal;
  publishedWeekCount: number;
}

export async function computeSplitClassification(db: PrismaClient, splitId: string): Promise<SplitClassification> {
  const rows = await db.publishedParticipantWeeklyResult.findMany({
    where: { splitId },
    include: { publication: { include: { splitWeek: true } } },
  });

  const weekMap = new Map<string, ClassificationWeekColumn>();
  const byParticipant = new Map<string, WorkingEntry>();
  const latestSeqByParticipant = new Map<string, number>();

  for (const row of rows) {
    const week = row.publication.splitWeek;
    if (!weekMap.has(week.id)) {
      weekMap.set(week.id, { splitWeekId: week.id, weekSequenceNumber: week.sequenceNumber, publishedAt: row.publication.publishedAt });
    }

    let entry = byParticipant.get(row.splitParticipantId);
    if (!entry) {
      entry = {
        splitParticipantId: row.splitParticipantId,
        personId: row.personId,
        alias: row.aliasSnapshot,
        fullName: row.fullNameSnapshot,
        pointsByWeek: new Map(),
        weeklyRankByWeek: new Map(),
        totalKpiPointsByWeek: new Map(),
        attendanceStatusByWeek: new Map(),
        totalPositionPointsDecimal: new Prisma.Decimal(0),
        totalKpiPointsDecimal: new Prisma.Decimal(0),
        publishedWeekCount: 0,
      };
      byParticipant.set(row.splitParticipantId, entry);
    }

    // El alias/nombre mostrado es el de la semana publicada mas reciente de esa persona (no altera lo ya publicado, solo la presentacion).
    const latestSeq = latestSeqByParticipant.get(row.splitParticipantId) ?? -1;
    if (week.sequenceNumber >= latestSeq) {
      entry.alias = row.aliasSnapshot;
      entry.fullName = row.fullNameSnapshot;
      latestSeqByParticipant.set(row.splitParticipantId, week.sequenceNumber);
    }
    entry.pointsByWeek.set(week.id, row.positionPoints);
    entry.weeklyRankByWeek.set(week.id, row.weeklyRank);
    entry.totalKpiPointsByWeek.set(week.id, row.totalKpiPoints.toNumber());
    entry.attendanceStatusByWeek.set(week.id, row.attendanceStatus);
    entry.totalPositionPointsDecimal = entry.totalPositionPointsDecimal.plus(row.positionPoints);
    entry.totalKpiPointsDecimal = entry.totalKpiPointsDecimal.plus(row.totalKpiPoints);
    entry.publishedWeekCount += 1;
  }

  const weeks = Array.from(weekMap.values()).sort((a, b) => a.weekSequenceNumber - b.weekSequenceNumber);

  const ranked = rankByComparator(
    Array.from(byParticipant.values()),
    (a, b) => {
      const byPosition = compareDecimalDescending(a.totalPositionPointsDecimal, b.totalPositionPointsDecimal);
      if (byPosition !== 0) return byPosition;
      return compareDecimalDescending(a.totalKpiPointsDecimal, b.totalKpiPointsDecimal);
    },
    (a, b) =>
      compareNormalizedAlias(a.alias.trim().toLowerCase(), b.alias.trim().toLowerCase()) ||
      a.splitParticipantId.localeCompare(b.splitParticipantId),
  );

  const entries: ClassificationEntry[] = ranked.map(({ item, rank }) => ({
    splitParticipantId: item.splitParticipantId,
    personId: item.personId,
    alias: item.alias,
    fullName: item.fullName,
    pointsByWeek: item.pointsByWeek,
    weeklyRankByWeek: item.weeklyRankByWeek,
    totalKpiPointsByWeek: item.totalKpiPointsByWeek,
    attendanceStatusByWeek: item.attendanceStatusByWeek,
    totalPositionPoints: item.totalPositionPointsDecimal.toNumber(),
    totalKpiPoints: item.totalKpiPointsDecimal.toNumber(),
    publishedWeekCount: item.publishedWeekCount,
    rank,
  }));

  return { weeks, entries };
}

export interface KpiClassificationEntry {
  splitParticipantId: string;
  alias: string;
  fullName: string;
  levelSnapshot: string;
  sum: number;
  average: number;
  includedWeekCount: number;
  rank: number;
}

/**
 * Detalle por KPI (seccion 9.4): suma/media y ranking entre semanas
 * publicadas, incluyendo `COMPUTED` y `VAC` (hotfix AVISO/0, ver
 * docs/DECISIONS.md: VAC participa como un cero real, nunca se excluye de la
 * media ni del ranking). `NOT_APPLICABLE` queda siempre excluido.
 */
export async function computeSplitKpiClassification(
  db: PrismaClient,
  splitId: string,
  kpiCode: KpiCode,
  weekId: string | null,
): Promise<KpiClassificationEntry[]> {
  const rows = await db.publishedKpiResult.findMany({
    where: {
      kpiCode,
      outcomeStatus: { in: ["COMPUTED", "VAC"] },
      participantWeeklyResult: {
        splitId,
        ...(weekId ? { publication: { splitWeekId: weekId } } : {}),
      },
    },
    include: { participantWeeklyResult: true },
  });

  const byParticipant = new Map<
    string,
    { alias: string; fullName: string; level: string; sumDecimal: Prisma.Decimal; count: number }
  >();

  for (const row of rows) {
    const participantResult = row.participantWeeklyResult;
    let entry = byParticipant.get(participantResult.splitParticipantId);
    if (!entry) {
      entry = {
        alias: participantResult.aliasSnapshot,
        fullName: participantResult.fullNameSnapshot,
        level: participantResult.levelSnapshot,
        sumDecimal: new Prisma.Decimal(0),
        count: 0,
      };
      byParticipant.set(participantResult.splitParticipantId, entry);
    }
    // VAC (hotfix AVISO/0, ver docs/DECISIONS.md) no aporta puntos, pero cuenta en el denominador de la media como un cero real.
    if (row.outcomeStatus === "COMPUTED") {
      entry.sumDecimal = entry.sumDecimal.plus(row.finalPoints ?? new Prisma.Decimal(0));
    }
    entry.count += 1;
  }

  const working = Array.from(byParticipant.entries()).map(([splitParticipantId, entry]) => ({
    splitParticipantId,
    ...entry,
  }));

  const ranked = rankByComparator(
    working,
    (a, b) => compareDecimalDescending(a.sumDecimal, b.sumDecimal),
    (a, b) => compareNormalizedAlias(a.alias.trim().toLowerCase(), b.alias.trim().toLowerCase()) || a.splitParticipantId.localeCompare(b.splitParticipantId),
  );

  return ranked.map(({ item, rank }) => ({
    splitParticipantId: item.splitParticipantId,
    alias: item.alias,
    fullName: item.fullName,
    levelSnapshot: item.level,
    sum: item.sumDecimal.toNumber(),
    average: item.count > 0 ? item.sumDecimal.div(item.count).toNumber() : 0,
    includedWeekCount: item.count,
    rank,
  }));
}

export const CLASSIFICATION_KPI_OPTIONS = KPI_CATALOG_LIST.map((entry) => ({ code: entry.code, name: entry.name }));
