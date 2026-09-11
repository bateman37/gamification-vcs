import { Prisma, type PrismaClient } from "@prisma/client";
import { computeSplitClassification } from "@/server/services/classification.service";

/**
 * Vista individual de resultados (seccion 7 de docs/RESULTS_PUBLICATION.md):
 * lee siempre de la instantanea publicada, nunca recalcula con
 * configuracion actual. Usado tanto por la subvista "Por split" como por
 * "Historico general".
 */

export interface PersonOption {
  id: string;
  fullName: string;
}

export async function listPersonsWithPublishedResults(db: PrismaClient): Promise<PersonOption[]> {
  const rows = await db.publishedParticipantWeeklyResult.findMany({
    distinct: ["personId"],
    select: { personId: true },
  });
  const personIds = rows.map((row) => row.personId);
  if (personIds.length === 0) return [];
  const persons = await db.person.findMany({ where: { id: { in: personIds } }, orderBy: { fullName: "asc" } });
  return persons.map((person) => ({ id: person.id, fullName: person.fullName }));
}

export interface PersonSplitOption {
  splitId: string;
  splitName: string;
}

export async function listSplitsWithPublishedResultsForPerson(db: PrismaClient, personId: string): Promise<PersonSplitOption[]> {
  const rows = await db.publishedParticipantWeeklyResult.findMany({
    where: { personId },
    distinct: ["splitId"],
    include: { split: { select: { id: true, name: true, startDate: true } } },
  });
  return rows
    .map((row) => ({ splitId: row.split.id, splitName: row.split.name, startDate: row.split.startDate }))
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
    .map(({ splitId, splitName }) => ({ splitId, splitName }));
}

export interface PersonSplitKpiCell {
  kpiCode: string;
  kpiName: string;
  status: "COMPUTED" | "VAC" | "NOT_APPLICABLE";
  finalPoints: number | null;
  baseMax: number | null;
  kpiRank: number | null;
  rankedParticipantCount: number | null;
}

export interface PersonSplitWeekRow {
  splitWeekId: string;
  weekSequenceNumber: number;
  publishedAt: Date;
  kpiCells: PersonSplitKpiCell[];
  totalKpiPoints: number;
  applicableMaxPoints: number | null;
  weeklyRank: number;
  rankedParticipantCount: number;
  positionPoints: number;
}

export interface PersonSplitDetail {
  splitId: string;
  splitName: string;
  weeks: PersonSplitWeekRow[];
  totalPositionPoints: number;
  totalKpiPoints: number;
  currentRank: number | null;
  rankedParticipantCount: number;
}

export async function getPersonSplitDetail(db: PrismaClient, personId: string, splitId: string): Promise<PersonSplitDetail | null> {
  const rows = await db.publishedParticipantWeeklyResult.findMany({
    where: { personId, splitId },
    include: { kpiResults: true, publication: { include: { splitWeek: true } }, split: { select: { name: true } } },
  });
  if (rows.length === 0) return null;

  const sortedRows = [...rows].sort((a, b) => a.publication.splitWeek.sequenceNumber - b.publication.splitWeek.sequenceNumber);

  const weeks: PersonSplitWeekRow[] = sortedRows.map((row) => ({
    splitWeekId: row.publication.splitWeek.id,
    weekSequenceNumber: row.publication.splitWeek.sequenceNumber,
    publishedAt: row.publication.publishedAt,
    kpiCells: row.kpiResults.map((kpiResult) => ({
      kpiCode: kpiResult.kpiCode,
      kpiName: kpiResult.kpiNameSnapshot,
      status: kpiResult.outcomeStatus,
      finalPoints: kpiResult.finalPoints?.toNumber() ?? null,
      baseMax: kpiResult.baseMax?.toNumber() ?? null,
      kpiRank: kpiResult.kpiRank,
      rankedParticipantCount: kpiResult.rankedParticipantCount,
    })),
    totalKpiPoints: row.totalKpiPoints.toNumber(),
    applicableMaxPoints: row.applicableMaxPoints?.toNumber() ?? null,
    weeklyRank: row.weeklyRank,
    rankedParticipantCount: row.rankedParticipantCount,
    positionPoints: row.positionPoints,
  }));

  const totalPositionPoints = rows.reduce((sum, row) => sum + row.positionPoints, 0);
  const totalKpiPointsDecimal = rows.reduce((sum, row) => sum.plus(row.totalKpiPoints), new Prisma.Decimal(0));

  const classification = await computeSplitClassification(db, splitId);
  const entry = classification.entries.find((candidate) => candidate.personId === personId);

  return {
    splitId,
    splitName: rows[0]!.split.name,
    weeks,
    totalPositionPoints,
    totalKpiPoints: totalKpiPointsDecimal.toNumber(),
    currentRank: entry?.rank ?? null,
    rankedParticipantCount: classification.entries.length,
  };
}

export type HistoryGrouping = "semana" | "mes" | "año";

export interface HistoryFilters {
  year: number | "todos";
  splitId: string | "todos";
  grouping: HistoryGrouping;
}

export interface HistoryKpiBreakdown {
  kpiCode: string;
  kpiName: string;
  sum: number;
  average: number;
  /** Semanas que participan en `sum`/`average`: `COMPUTED` y `VAC` (VAC aporta 0, hotfix AVISO/0, ver docs/DECISIONS.md). `NOT_APPLICABLE` queda siempre excluido. */
  includedWeekCount: number;
  vacCount: number;
}

export interface HistoryGroupRow {
  periodKey: string;
  periodLabel: string;
  publishedWeekCount: number;
  sumPositionPoints: number;
  sumKpiPoints: number;
  averageKpiPoints: number;
  perKpi: HistoryKpiBreakdown[];
}

export interface PersonHistory {
  availableYears: number[];
  availableSplits: { id: string; name: string }[];
  groups: HistoryGroupRow[];
}

const MONTH_LABELS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function periodKeyFor(grouping: HistoryGrouping, startDate: Date, sequenceNumber: number, splitId: string): { key: string; label: string } {
  const year = startDate.getUTCFullYear();
  if (grouping === "año") return { key: `${year}`, label: `${year}` };
  if (grouping === "mes") {
    const month = startDate.getUTCMonth();
    return { key: `${year}-${month}`, label: `${MONTH_LABELS[month]} ${year}` };
  }
  return { key: `${splitId}-${sequenceNumber}`, label: `Semana ${sequenceNumber} (${year})` };
}

export async function getPersonHistory(db: PrismaClient, personId: string, filters: HistoryFilters): Promise<PersonHistory> {
  const allRows = await db.publishedParticipantWeeklyResult.findMany({
    where: { personId },
    include: { kpiResults: true, publication: { include: { splitWeek: true } }, split: { select: { id: true, name: true } } },
  });

  const availableYears = Array.from(new Set(allRows.map((row) => row.publication.splitWeek.startDate.getUTCFullYear()))).sort((a, b) => b - a);
  const splitMap = new Map(allRows.map((row) => [row.split.id, row.split.name]));
  const availableSplits = Array.from(splitMap.entries()).map(([id, name]) => ({ id, name }));

  const filteredRows = allRows.filter((row) => {
    if (filters.year !== "todos" && row.publication.splitWeek.startDate.getUTCFullYear() !== filters.year) return false;
    if (filters.splitId !== "todos" && row.splitId !== filters.splitId) return false;
    return true;
  });

  interface WorkingGroup {
    periodKey: string;
    periodLabel: string;
    publishedWeekCount: number;
    sumPositionPointsDecimal: Prisma.Decimal;
    sumKpiPointsDecimal: Prisma.Decimal;
    perKpi: Map<string, { kpiName: string; sumDecimal: Prisma.Decimal; includedWeekCount: number; vacCount: number }>;
  }

  const groupsByKey = new Map<string, WorkingGroup>();

  for (const row of filteredRows) {
    const week = row.publication.splitWeek;
    const { key, label } = periodKeyFor(filters.grouping, week.startDate, week.sequenceNumber, row.splitId);
    let group = groupsByKey.get(key);
    if (!group) {
      group = {
        periodKey: key,
        periodLabel: label,
        publishedWeekCount: 0,
        sumPositionPointsDecimal: new Prisma.Decimal(0),
        sumKpiPointsDecimal: new Prisma.Decimal(0),
        perKpi: new Map(),
      };
      groupsByKey.set(key, group);
    }
    group.publishedWeekCount += 1;
    group.sumPositionPointsDecimal = group.sumPositionPointsDecimal.plus(row.positionPoints);
    group.sumKpiPointsDecimal = group.sumKpiPointsDecimal.plus(row.totalKpiPoints);

    for (const kpiResult of row.kpiResults) {
      // No aplica queda siempre excluido de la suma/media/recuento: nunca se convierte en cero (ver docs/DECISIONS.md).
      if (kpiResult.outcomeStatus === "NOT_APPLICABLE") continue;

      let kpiGroup = group.perKpi.get(kpiResult.kpiCode);
      if (!kpiGroup) {
        kpiGroup = { kpiName: kpiResult.kpiNameSnapshot, sumDecimal: new Prisma.Decimal(0), includedWeekCount: 0, vacCount: 0 };
        group.perKpi.set(kpiResult.kpiCode, kpiGroup);
      }
      if (kpiResult.outcomeStatus === "COMPUTED") {
        kpiGroup.sumDecimal = kpiGroup.sumDecimal.plus(kpiResult.finalPoints ?? new Prisma.Decimal(0));
      } else {
        // VAC (hotfix AVISO/0, ver docs/DECISIONS.md): participa en la suma y la media como un cero real.
        kpiGroup.vacCount += 1;
      }
      kpiGroup.includedWeekCount += 1;
    }
  }

  const groups: HistoryGroupRow[] = Array.from(groupsByKey.values())
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey))
    .map((group) => ({
      periodKey: group.periodKey,
      periodLabel: group.periodLabel,
      publishedWeekCount: group.publishedWeekCount,
      sumPositionPoints: group.sumPositionPointsDecimal.toNumber(),
      sumKpiPoints: group.sumKpiPointsDecimal.toNumber(),
      averageKpiPoints: group.publishedWeekCount > 0 ? group.sumKpiPointsDecimal.div(group.publishedWeekCount).toNumber() : 0,
      perKpi: Array.from(group.perKpi.entries()).map(([kpiCode, kpiGroup]) => ({
        kpiCode,
        kpiName: kpiGroup.kpiName,
        sum: kpiGroup.sumDecimal.toNumber(),
        average: kpiGroup.includedWeekCount > 0 ? kpiGroup.sumDecimal.div(kpiGroup.includedWeekCount).toNumber() : 0,
        includedWeekCount: kpiGroup.includedWeekCount,
        vacCount: kpiGroup.vacCount,
      })),
    }));

  return { availableYears, availableSplits, groups };
}
