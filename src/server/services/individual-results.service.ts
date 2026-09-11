import { Prisma, type PrismaClient } from "@prisma/client";
import { computeSplitClassification } from "@/server/services/classification.service";
import { countParticipantsForSplit } from "@/server/services/participant.service";
import { KPI_CATALOG, KPI_CATALOG_LIST } from "@/domain/kpis/catalog";
import { formatCalendarDateEs } from "@/lib/dates";

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
  /** Puntos definitivos publicados (incluyen el bonus de profesion desde `0.8.0`). */
  finalPoints: number | null;
  baseMax: number | null;
  /** Puntos tras el maximo base y antes del bonus. `null` en publicaciones anteriores a `0.8.0`. */
  basePointsBeforeProfession: number | null;
  /** Puntos anadidos por la profesion segun la instantanea. `null` en publicaciones anteriores. */
  professionBonusPoints: number | null;
  professionApplied: boolean;
  professionName: string | null;
  kpiRank: number | null;
  /** Numerador real del ranking de este KPI (participantes con resultado COMPUTED). No usar como denominador de "x de n" (ver seccion 17 de `0.7.0` / MVP-2A). */
  rankedParticipantCount: number | null;
}

/** Profesion congelada de una semana publicada (`0.8.0` / MVP-2B). Nunca se lee la definicion actual. */
export interface PersonSplitWeekProfession {
  name: string;
  kpiNames: string | null;
  bonusPercent: number | null;
}

export interface PersonSplitWeekRow {
  splitWeekId: string;
  weekSequenceNumber: number;
  weekStartDate: Date;
  publishedAt: Date;
  kpiCells: PersonSplitKpiCell[];
  totalKpiPoints: number;
  applicableMaxPoints: number | null;
  weeklyRank: number;
  rankedParticipantCount: number;
  positionPoints: number;
  /** `true` si el split usaba profesiones al publicar esa semana. */
  splitUsedProfessions: boolean;
  /** Profesion congelada de esa semana, o `null` (split sin profesiones o publicacion anterior a `0.8.0`). */
  profession: PersonSplitWeekProfession | null;
  /** Suma del bonus de profesion publicado en esa semana. */
  professionBonusTotal: number;
}

export interface PersonSplitDetail {
  splitId: string;
  splitName: string;
  weeks: PersonSplitWeekRow[];
  totalPositionPoints: number;
  totalKpiPoints: number;
  currentRank: number | null;
  rankedParticipantCount: number;
  /** Numero total de personas que participan en el split: denominador unico de todo "x de n" (seccion 17 de `0.7.0` / MVP-2A). */
  splitParticipantCount: number;
  /** Faccion actual de la persona en este split (`0.7.0` / MVP-2A). `null` si el split no usa facciones. */
  currentFaction: { id: string; name: string; color: string } | null;
}

export async function getPersonSplitDetail(db: PrismaClient, personId: string, splitId: string): Promise<PersonSplitDetail | null> {
  const rows = await db.publishedParticipantWeeklyResult.findMany({
    where: { personId, splitId },
    include: { kpiResults: true, publication: { include: { splitWeek: true } }, split: { select: { name: true } } },
  });
  if (rows.length === 0) return null;

  const currentParticipant = await db.splitParticipant.findUnique({
    where: { splitId_personId: { splitId, personId } },
    include: { faction: { select: { id: true, name: true, color: true } } },
  });

  const sortedRows = [...rows].sort((a, b) => a.publication.splitWeek.sequenceNumber - b.publication.splitWeek.sequenceNumber);

  const weeks: PersonSplitWeekRow[] = sortedRows.map((row) => ({
    splitWeekId: row.publication.splitWeek.id,
    weekSequenceNumber: row.publication.splitWeek.sequenceNumber,
    weekStartDate: row.publication.splitWeek.startDate,
    publishedAt: row.publication.publishedAt,
    kpiCells: row.kpiResults.map((kpiResult) => ({
      kpiCode: kpiResult.kpiCode,
      kpiName: kpiResult.kpiNameSnapshot,
      status: kpiResult.outcomeStatus,
      finalPoints: kpiResult.finalPoints?.toNumber() ?? null,
      baseMax: kpiResult.baseMax?.toNumber() ?? null,
      basePointsBeforeProfession: kpiResult.basePointsBeforeProfession?.toNumber() ?? null,
      professionBonusPoints: kpiResult.professionBonusPoints?.toNumber() ?? null,
      professionApplied: kpiResult.professionApplied,
      professionName: kpiResult.professionNameSnapshot,
      kpiRank: kpiResult.kpiRank,
      rankedParticipantCount: kpiResult.rankedParticipantCount,
    })),
    totalKpiPoints: row.totalKpiPoints.toNumber(),
    applicableMaxPoints: row.applicableMaxPoints?.toNumber() ?? null,
    weeklyRank: row.weeklyRank,
    rankedParticipantCount: row.rankedParticipantCount,
    positionPoints: row.positionPoints,
    splitUsedProfessions: row.splitUsedProfessions,
    // Siempre desde la instantanea: una semana historica nunca se explica con la profesion actual.
    profession: row.professionNameSnapshot
      ? {
          name: row.professionNameSnapshot,
          kpiNames:
            row.professionKpiCodeA && row.professionKpiCodeB
              ? `${KPI_CATALOG[row.professionKpiCodeA].name} + ${KPI_CATALOG[row.professionKpiCodeB].name}`
              : null,
          bonusPercent: row.professionBonusPercent,
        }
      : null,
    professionBonusTotal: row.kpiResults
      .reduce((sum, kpiResult) => sum.plus(kpiResult.professionBonusPoints ?? 0), new Prisma.Decimal(0))
      .toNumber(),
  }));

  const totalPositionPoints = rows.reduce((sum, row) => sum + row.positionPoints, 0);
  const totalKpiPointsDecimal = rows.reduce((sum, row) => sum.plus(row.totalKpiPoints), new Prisma.Decimal(0));

  const classification = await computeSplitClassification(db, splitId);
  const entry = classification.entries.find((candidate) => candidate.personId === personId);
  const splitParticipantCount = await countParticipantsForSplit(db, splitId);

  return {
    splitId,
    splitName: rows[0]!.split.name,
    weeks,
    totalPositionPoints,
    totalKpiPoints: totalKpiPointsDecimal.toNumber(),
    currentRank: entry?.rank ?? null,
    rankedParticipantCount: classification.entries.length,
    splitParticipantCount,
    currentFaction: currentParticipant?.faction ?? null,
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
  /** Porcentaje agregado reproducible (suma mostrada / suma de maximos aplicables x 100), o `null` si el denominador es cero (seccion 18 de `0.7.0` / MVP-2A). */
  percentageOfMax: number | null;
  /**
   * Suma de los `professionBonusPoints` **publicados** de este KPI en el
   * periodo (`0.8.0` / MVP-2B). Nunca se recalcula con la profesion actual.
   * `0` cuando no hubo bonus o cuando las publicaciones son anteriores a
   * `0.8.0`. Ya esta incluido dentro de `sum`.
   */
  professionBonusSum: number;
}

export interface HistoryGroupRow {
  periodKey: string;
  periodLabel: string;
  /** Texto secundario del periodo: nombre del split cuando el filtro incluye varios (seccion 27). */
  periodSecondaryLabel: string | null;
  publishedWeekCount: number;
  sumPositionPoints: number;
  sumKpiPoints: number;
  averageKpiPoints: number;
  /** Suma de los `professionBonusPoints` publicados en el periodo, ya incluida en `sumKpiPoints`. */
  professionBonusSum: number;
  /** Una entrada solo para los KPI presentes en este periodo; el resto de columnas de `availableKpis` deben mostrarse como "—" (seccion 18). */
  perKpi: HistoryKpiBreakdown[];
}

export interface PersonHistory {
  availableYears: number[];
  availableSplits: { id: string; name: string }[];
  /** Union de KPI presentes en los grupos filtrados, ordenados segun `KPI_CATALOG_LIST` (seccion 18 de `0.7.0` / MVP-2A). */
  availableKpis: { code: string; name: string }[];
  groups: HistoryGroupRow[];
}

const MONTH_LABELS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Clave, rotulo y fecha de ordenacion de un periodo del historico general.
 *
 * Correccion de `0.8.0` / MVP-2B (seccion 27 del encargo): con agrupacion
 * `Semana`, el periodo se identifica por la **fecha de inicio real** de esa
 * semana (`SplitWeek.startDate`, formateada con el helper UTC para no
 * desplazarla un dia), nunca por `Semana 1`, `Semana 2`... La clave interna
 * sigue incluyendo el split y el numero de semana, para no fusionar por
 * accidente dos semanas de splits distintos que empiecen el mismo dia, y
 * `sortDate` permite ordenar cronologicamente por la fecha real, no
 * alfabeticamente por la etiqueta. `Mes` y `Año` no cambian.
 */
function periodKeyFor(
  grouping: HistoryGrouping,
  startDate: Date,
  sequenceNumber: number,
  splitId: string,
): { key: string; label: string; sortDate: Date } {
  const year = startDate.getUTCFullYear();
  if (grouping === "año") {
    return { key: `${year}`, label: `${year}`, sortDate: new Date(Date.UTC(year, 0, 1)) };
  }
  if (grouping === "mes") {
    const month = startDate.getUTCMonth();
    return { key: `${year}-${month}`, label: `${MONTH_LABELS[month]} ${year}`, sortDate: new Date(Date.UTC(year, month, 1)) };
  }
  return { key: `${splitId}-${sequenceNumber}`, label: formatCalendarDateEs(startDate), sortDate: startDate };
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

  interface WorkingKpiGroup {
    kpiName: string;
    sumDecimal: Prisma.Decimal;
    sumBaseMaxDecimal: Prisma.Decimal;
    includedWeekCount: number;
    vacCount: number;
    professionBonusDecimal: Prisma.Decimal;
  }

  interface WorkingGroup {
    periodKey: string;
    periodLabel: string;
    sortDate: Date;
    splitNames: Set<string>;
    publishedWeekCount: number;
    sumPositionPointsDecimal: Prisma.Decimal;
    sumKpiPointsDecimal: Prisma.Decimal;
    professionBonusDecimal: Prisma.Decimal;
    perKpi: Map<string, WorkingKpiGroup>;
  }

  const groupsByKey = new Map<string, WorkingGroup>();
  const kpiOrderByCode = new Map(KPI_CATALOG_LIST.map((entry, index) => [entry.code as string, index]));
  const kpiNameByCode = new Map<string, string>();

  for (const row of filteredRows) {
    const week = row.publication.splitWeek;
    const { key, label, sortDate } = periodKeyFor(filters.grouping, week.startDate, week.sequenceNumber, row.splitId);
    let group = groupsByKey.get(key);
    if (!group) {
      group = {
        periodKey: key,
        periodLabel: label,
        sortDate,
        splitNames: new Set<string>(),
        publishedWeekCount: 0,
        sumPositionPointsDecimal: new Prisma.Decimal(0),
        sumKpiPointsDecimal: new Prisma.Decimal(0),
        professionBonusDecimal: new Prisma.Decimal(0),
        perKpi: new Map(),
      };
      groupsByKey.set(key, group);
    }
    group.splitNames.add(row.split.name);
    group.publishedWeekCount += 1;
    group.sumPositionPointsDecimal = group.sumPositionPointsDecimal.plus(row.positionPoints);
    group.sumKpiPointsDecimal = group.sumKpiPointsDecimal.plus(row.totalKpiPoints);

    for (const kpiResult of row.kpiResults) {
      // No aplica queda siempre excluido de la suma/media/recuento: nunca se convierte en cero (ver docs/DECISIONS.md).
      if (kpiResult.outcomeStatus === "NOT_APPLICABLE") continue;
      kpiNameByCode.set(kpiResult.kpiCode, kpiResult.kpiNameSnapshot);

      let kpiGroup = group.perKpi.get(kpiResult.kpiCode);
      if (!kpiGroup) {
        kpiGroup = {
          kpiName: kpiResult.kpiNameSnapshot,
          sumDecimal: new Prisma.Decimal(0),
          sumBaseMaxDecimal: new Prisma.Decimal(0),
          includedWeekCount: 0,
          vacCount: 0,
          professionBonusDecimal: new Prisma.Decimal(0),
        };
        group.perKpi.set(kpiResult.kpiCode, kpiGroup);
      }
      kpiGroup.sumBaseMaxDecimal = kpiGroup.sumBaseMaxDecimal.plus(kpiResult.baseMax ?? new Prisma.Decimal(0));
      if (kpiResult.outcomeStatus === "COMPUTED") {
        kpiGroup.sumDecimal = kpiGroup.sumDecimal.plus(kpiResult.finalPoints ?? new Prisma.Decimal(0));
        // Solo se suman los `professionBonusPoints` ya publicados: nunca se recalcula con la profesion actual.
        const publishedBonus = kpiResult.professionBonusPoints ?? new Prisma.Decimal(0);
        kpiGroup.professionBonusDecimal = kpiGroup.professionBonusDecimal.plus(publishedBonus);
        group.professionBonusDecimal = group.professionBonusDecimal.plus(publishedBonus);
      } else {
        // VAC (hotfix AVISO/0, ver docs/DECISIONS.md): participa en la suma y la media como un cero real.
        kpiGroup.vacCount += 1;
      }
      kpiGroup.includedWeekCount += 1;
    }
  }

  const availableKpis = Array.from(kpiNameByCode.entries())
    .sort(([codeA], [codeB]) => (kpiOrderByCode.get(codeA) ?? 0) - (kpiOrderByCode.get(codeB) ?? 0))
    .map(([code, name]) => ({ code, name }));

  // Con varios splits en el filtro, dos semanas distintas pueden empezar el mismo dia: el nombre del
  // split se muestra como texto secundario para distinguirlas (nunca se fusionan: la clave las separa).
  const filteredSplitCount = new Set(filteredRows.map((row) => row.splitId)).size;
  const showSplitAsSecondaryLabel = filters.grouping === "semana" && filteredSplitCount > 1;

  const groups: HistoryGroupRow[] = Array.from(groupsByKey.values())
    // Orden cronologico descendente por la fecha real del periodo, nunca alfabetico por la etiqueta.
    .sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime() || a.periodLabel.localeCompare(b.periodLabel, "es"))
    .map((group) => ({
      periodKey: group.periodKey,
      periodLabel: group.periodLabel,
      periodSecondaryLabel: showSplitAsSecondaryLabel ? Array.from(group.splitNames).join(", ") : null,
      publishedWeekCount: group.publishedWeekCount,
      sumPositionPoints: group.sumPositionPointsDecimal.toNumber(),
      sumKpiPoints: group.sumKpiPointsDecimal.toNumber(),
      averageKpiPoints: group.publishedWeekCount > 0 ? group.sumKpiPointsDecimal.div(group.publishedWeekCount).toNumber() : 0,
      professionBonusSum: group.professionBonusDecimal.toNumber(),
      perKpi: Array.from(group.perKpi.entries()).map(([kpiCode, kpiGroup]) => ({
        kpiCode,
        kpiName: kpiGroup.kpiName,
        sum: kpiGroup.sumDecimal.toNumber(),
        average: kpiGroup.includedWeekCount > 0 ? kpiGroup.sumDecimal.div(kpiGroup.includedWeekCount).toNumber() : 0,
        includedWeekCount: kpiGroup.includedWeekCount,
        vacCount: kpiGroup.vacCount,
        percentageOfMax: kpiGroup.sumBaseMaxDecimal.greaterThan(0) ? kpiGroup.sumDecimal.div(kpiGroup.sumBaseMaxDecimal).mul(100).toNumber() : null,
        professionBonusSum: kpiGroup.professionBonusDecimal.toNumber(),
      })),
    }));

  return { availableYears, availableSplits, availableKpis, groups };
}
