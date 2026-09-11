import type { PrismaClient } from "@prisma/client";
import { selectFactionTopThree, rankFactions, type FactionMemberScore } from "@/domain/faction-ranking";

/**
 * Clasificacion de facciones (`0.7.0` / MVP-2A, ver docs/FACTIONS.md).
 * Fuente de verdad exclusiva: la pertenencia a faccion y los
 * `positionPoints` congelados en `PublishedParticipantWeeklyResult`. Se
 * calcula siempre al consultar (nunca se persiste un acumulado mutable).
 * Publicaciones sin snapshot de faccion (splits sin facciones, o semanas
 * publicadas antes de esta version) quedan excluidas por completo.
 */

export interface FactionWeekColumn {
  splitWeekId: string;
  weekSequenceNumber: number;
  publishedAt: Date;
}

export interface FactionWeeklyContributor {
  splitParticipantId: string;
  alias: string;
  positionPoints: number;
}

export interface FactionWeekEntry {
  factionId: string;
  /** Nombre/color congelados esa semana (ver docs/FACTIONS.md: el detalle de una semana publicada nunca usa el nombre/color actuales). */
  name: string;
  color: string;
  weeklyRank: number;
  weeklyScore: number;
  topContributors: FactionWeeklyContributor[];
  /** Puntuacion acumulada de la faccion hasta esta semana (incluida). */
  accumulatedScore: number;
  /** Posicion acumulada hasta esta semana (incluida). */
  accumulatedRank: number;
}

export interface FactionWeekClassification {
  splitWeekId: string;
  weekSequenceNumber: number;
  publishedAt: Date;
  entries: FactionWeekEntry[];
}

export interface FactionAccumulatedEntry {
  factionId: string;
  /** Nombre/color actuales de la faccion (la clasificacion acumulada siempre muestra el estado vigente). */
  name: string;
  color: string;
  scoreByWeek: Map<string, number>;
  totalScore: number;
  rank: number;
}

export interface FactionClassification {
  /** `false` si el split no usa facciones o no tiene ninguna publicacion con snapshot de faccion. */
  hasFactionData: boolean;
  weeks: FactionWeekColumn[];
  weekClassifications: Map<string, FactionWeekClassification>;
  accumulated: FactionAccumulatedEntry[];
}

export async function computeFactionClassification(db: PrismaClient, splitId: string): Promise<FactionClassification> {
  const rows = await db.publishedParticipantWeeklyResult.findMany({
    where: { splitId, factionId: { not: null } },
    include: { publication: { include: { splitWeek: true } } },
  });

  if (rows.length === 0) {
    return { hasFactionData: false, weeks: [], weekClassifications: new Map(), accumulated: [] };
  }

  const currentFactions = await db.splitFaction.findMany({ where: { splitId } });
  const currentFactionById = new Map(currentFactions.map((faction) => [faction.id, faction]));

  interface WeekBucket {
    splitWeekId: string;
    weekSequenceNumber: number;
    publishedAt: Date;
    membersByFaction: Map<string, { name: string; color: string; members: FactionMemberScore[] }>;
  }

  const weekBuckets = new Map<string, WeekBucket>();

  for (const row of rows) {
    const week = row.publication.splitWeek;
    let bucket = weekBuckets.get(week.id);
    if (!bucket) {
      bucket = { splitWeekId: week.id, weekSequenceNumber: week.sequenceNumber, publishedAt: row.publication.publishedAt, membersByFaction: new Map() };
      weekBuckets.set(week.id, bucket);
    }
    const factionId = row.factionId!;
    let factionBucket = bucket.membersByFaction.get(factionId);
    if (!factionBucket) {
      factionBucket = { name: row.factionNameSnapshot ?? "—", color: row.factionColorSnapshot ?? "#94a3b8", members: [] };
      bucket.membersByFaction.set(factionId, factionBucket);
    }
    factionBucket.members.push({ splitParticipantId: row.splitParticipantId, alias: row.aliasSnapshot, positionPoints: row.positionPoints });
  }

  const orderedWeeks = Array.from(weekBuckets.values()).sort((a, b) => a.weekSequenceNumber - b.weekSequenceNumber);

  const weeks: FactionWeekColumn[] = orderedWeeks.map((bucket) => ({
    splitWeekId: bucket.splitWeekId,
    weekSequenceNumber: bucket.weekSequenceNumber,
    publishedAt: bucket.publishedAt,
  }));

  const weekClassifications = new Map<string, FactionWeekClassification>();
  const scoreByWeekByFaction = new Map<string, Map<string, number>>();
  const accumulatedScoreByFaction = new Map<string, number>();
  const accumulatedContributionByFaction = new Map<string, Map<string, number>>();
  const factionDisplayName = new Map<string, { name: string; color: string }>();

  for (const bucket of orderedWeeks) {
    interface FactionWeekWorking {
      factionId: string;
      name: string;
      color: string;
      weeklyScore: number;
      topContributors: FactionWeeklyContributor[];
    }
    const working: FactionWeekWorking[] = [];

    for (const [factionId, factionBucket] of bucket.membersByFaction) {
      const top = selectFactionTopThree(factionBucket.members);
      // Defensivo: la publicacion ya exige >=3 aplicables por faccion; si por algun motivo hay menos, esa faccion
      // simplemente no puntua esta semana en vez de romper la clasificacion.
      if (!top) continue;
      working.push({ factionId, name: factionBucket.name, color: factionBucket.color, weeklyScore: top.weeklyScore, topContributors: top.topContributors });
      factionDisplayName.set(factionId, { name: factionBucket.name, color: factionBucket.color });
    }

    const ranked = rankFactions(
      working.map((entry) => ({
        factionId: entry.factionId,
        factionName: entry.name,
        score: entry.weeklyScore,
        contributionVector: entry.topContributors.map((contributor) => contributor.positionPoints),
      })),
    );

    const entries: FactionWeekEntry[] = ranked
      .map(({ item, rank }) => {
        const entry = working.find((candidate) => candidate.factionId === item.factionId)!;
        const previousTotal = accumulatedScoreByFaction.get(entry.factionId) ?? 0;
        const newTotal = previousTotal + entry.weeklyScore;
        accumulatedScoreByFaction.set(entry.factionId, newTotal);

        let contributionMap = accumulatedContributionByFaction.get(entry.factionId);
        if (!contributionMap) {
          contributionMap = new Map();
          accumulatedContributionByFaction.set(entry.factionId, contributionMap);
        }
        for (const contributor of entry.topContributors) {
          contributionMap.set(contributor.splitParticipantId, (contributionMap.get(contributor.splitParticipantId) ?? 0) + contributor.positionPoints);
        }

        let weekScoreMap = scoreByWeekByFaction.get(entry.factionId);
        if (!weekScoreMap) {
          weekScoreMap = new Map();
          scoreByWeekByFaction.set(entry.factionId, weekScoreMap);
        }
        weekScoreMap.set(bucket.splitWeekId, entry.weeklyScore);

        return {
          factionId: entry.factionId,
          name: entry.name,
          color: entry.color,
          weeklyRank: rank,
          weeklyScore: entry.weeklyScore,
          topContributors: entry.topContributors,
          accumulatedScore: newTotal,
          accumulatedRank: 0, // se rellena tras calcular el ranking acumulado de esta semana, ver mas abajo.
        };
      })
      .sort((a, b) => a.weeklyRank - b.weeklyRank);

    // Ranking acumulado tal y como quedaba justo despues de esta semana (para "posicion acumulada hasta esta semana").
    const accumulatedRanked = rankFactions(
      Array.from(accumulatedScoreByFaction.entries()).map(([factionId, score]) => ({
        factionId,
        factionName: factionDisplayName.get(factionId)?.name ?? "—",
        score,
        contributionVector: Array.from(accumulatedContributionByFaction.get(factionId)?.values() ?? []).sort((a, b) => b - a),
      })),
    );
    const accumulatedRankByFaction = new Map(accumulatedRanked.map(({ item, rank }) => [item.factionId, rank]));

    for (const entry of entries) {
      entry.accumulatedRank = accumulatedRankByFaction.get(entry.factionId) ?? entry.weeklyRank;
    }

    weekClassifications.set(bucket.splitWeekId, {
      splitWeekId: bucket.splitWeekId,
      weekSequenceNumber: bucket.weekSequenceNumber,
      publishedAt: bucket.publishedAt,
      entries,
    });
  }

  const finalAccumulatedRanked = rankFactions(
    Array.from(accumulatedScoreByFaction.entries()).map(([factionId, score]) => ({
      factionId,
      factionName: currentFactionById.get(factionId)?.name ?? factionDisplayName.get(factionId)?.name ?? "—",
      score,
      contributionVector: Array.from(accumulatedContributionByFaction.get(factionId)?.values() ?? []).sort((a, b) => b - a),
    })),
  );

  const accumulated: FactionAccumulatedEntry[] = finalAccumulatedRanked
    .map(({ item, rank }) => {
      const current = currentFactionById.get(item.factionId);
      const fallback = factionDisplayName.get(item.factionId);
      return {
        factionId: item.factionId,
        name: current?.name ?? fallback?.name ?? "—",
        color: current?.color ?? fallback?.color ?? "#94a3b8",
        scoreByWeek: scoreByWeekByFaction.get(item.factionId) ?? new Map(),
        totalScore: accumulatedScoreByFaction.get(item.factionId) ?? 0,
        rank,
      };
    })
    .sort((a, b) => a.rank - b.rank);

  return { hasFactionData: true, weeks, weekClassifications, accumulated };
}
