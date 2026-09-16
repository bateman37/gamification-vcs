import type { Prisma, PrismaClient } from "@prisma/client";
import type { KpiCode } from "@/domain/kpis/catalog";
import type { SplitClassification } from "@/server/services/classification.service";
import type { KpiClassificationEntry } from "@/server/services/classification.service";
import type { FactionClassification } from "@/server/services/faction-classification.service";
import { selectMvpBadgeWinners, selectTeamMvpBadgeWinners, selectKpiBadgeWinners } from "@/domain/badges/badge-winners";
import { ensureBadgeCatalogSeeded } from "@/server/services/badge.service";

/**
 * Concesion automatica de badges al finalizar un split (`1.2.3`, seccion 1/7
 * del encargo, ver docs/BADGES.md). `buildBadgeGrantPlan` es una lectura
 * pura sobre las clasificaciones oficiales ya calculadas por
 * `finalize-split.service.ts` (nunca reimplementa ningun ranking);
 * `grantSplitFinalizationBadges` es la unica escritura, pensada para
 * ejecutarse dentro de la misma transaccion serializable que cierra el
 * split.
 */

export interface KpiClassificationForBadges {
  kpiCode: KpiCode;
  entries: KpiClassificationEntry[];
}

export interface BadgeGrantPlan {
  mvpPersonIds: string[];
  teamMvpPersonIds: string[];
  kpiWinners: { kpiCode: KpiCode; personIds: string[] }[];
}

/**
 * Calcula quien gana cada badge de un split, resolviendo `personId` a
 * partir de la participacion viva (una sola consulta acotada, nunca una por
 * ganador). MVP Team se concede a todas las personas que **pertenecen
 * actualmente** a la (o las, en empate) faccion ganadora; sin datos de
 * faccion, la lista queda vacia.
 */
export async function buildBadgeGrantPlan(
  db: PrismaClient | Prisma.TransactionClient,
  splitId: string,
  classification: SplitClassification,
  factionClassification: FactionClassification,
  kpiClassifications: readonly KpiClassificationForBadges[],
): Promise<BadgeGrantPlan> {
  const participants = await db.splitParticipant.findMany({
    where: { splitId },
    select: { id: true, personId: true, factionId: true },
  });
  const personIdBySplitParticipantId = new Map(participants.map((p) => [p.id, p.personId]));
  const memberPersonIdsByFaction = new Map<string, string[]>();
  for (const participant of participants) {
    if (!participant.factionId) continue;
    const list = memberPersonIdsByFaction.get(participant.factionId) ?? [];
    list.push(participant.personId);
    memberPersonIdsByFaction.set(participant.factionId, list);
  }

  const mvpPersonIds = selectMvpBadgeWinners(classification.entries.map((entry) => ({ rank: entry.rank, personId: entry.personId })));

  const teamMvpPersonIds = factionClassification.hasFactionData
    ? selectTeamMvpBadgeWinners(
        factionClassification.accumulated.map((entry) => ({ rank: entry.rank, factionId: entry.factionId })),
        memberPersonIdsByFaction,
      )
    : [];

  const kpiWinners = kpiClassifications.map(({ kpiCode, entries }) => ({
    kpiCode,
    personIds: selectKpiBadgeWinners(
      entries
        .filter((entry) => personIdBySplitParticipantId.has(entry.splitParticipantId))
        .map((entry) => ({ rank: entry.rank, personId: personIdBySplitParticipantId.get(entry.splitParticipantId)! })),
    ),
  }));

  return { mvpPersonIds, teamMvpPersonIds, kpiWinners };
}

export interface GrantSplitFinalizationBadgesParams {
  splitId: string;
  splitName: string;
  finalizedAt: Date;
  plan: BadgeGrantPlan;
}

export interface PersonEarnedBadges {
  personId: string;
  /** Nombres de los badges conseguidos en este split, en el orden del catalogo. */
  badgeNames: string[];
}

/**
 * Concede dentro de la transaccion de finalizacion los badges MVP, MVP Team
 * y de categoria KPI del plan ya calculado. Idempotente por
 * `idempotencyKey` (`split-finalized-badge:{splitId}:{badgeCode}:{personId}`):
 * un reintento nunca duplica una concesion. Devuelve, por persona premiada,
 * la lista agregada de badges conseguidos en este split (para la noticia
 * personal unica, seccion 7.8 del encargo).
 */
export async function grantSplitFinalizationBadges(
  tx: Prisma.TransactionClient,
  params: GrantSplitFinalizationBadgesParams,
): Promise<PersonEarnedBadges[]> {
  await ensureBadgeCatalogSeeded(tx);
  const badges = await tx.badge.findMany({ select: { id: true, code: true, name: true, sortOrder: true } });
  const badgeByCode = new Map(badges.map((badge) => [badge.code, badge]));

  const earnedByPerson = new Map<string, { sortOrder: number; name: string }[]>();

  async function grant(code: string, personId: string, reason: string): Promise<void> {
    const badge = badgeByCode.get(code);
    if (!badge) return; // Defensivo: `ensureBadgeCatalogSeeded` ya garantiza esta fila.
    const idempotencyKey = `split-finalized-badge:${params.splitId}:${code}:${personId}`;
    await tx.badgeAward.upsert({
      where: { idempotencyKey },
      update: {},
      create: {
        badgeId: badge.id,
        personId,
        splitId: params.splitId,
        splitLabelSnapshot: params.splitName,
        badgeNameSnapshot: badge.name,
        origin: "SPLIT_FINALIZATION",
        grantedAt: params.finalizedAt,
        reason,
        idempotencyKey,
      },
    });
    const list = earnedByPerson.get(personId) ?? [];
    if (!list.some((entry) => entry.name === badge.name)) list.push({ sortOrder: badge.sortOrder, name: badge.name });
    earnedByPerson.set(personId, list);
  }

  for (const personId of params.plan.mvpPersonIds) {
    await grant("MVP", personId, `Ganador de la clasificación general de ${params.splitName}.`);
  }
  for (const personId of params.plan.teamMvpPersonIds) {
    await grant("TEAM_MVP", personId, `Miembro de la facción ganadora de ${params.splitName}.`);
  }
  for (const group of params.plan.kpiWinners) {
    const badgeName = badgeByCode.get(group.kpiCode)?.name ?? group.kpiCode;
    for (const personId of group.personIds) {
      await grant(group.kpiCode, personId, `Ganador de ${badgeName} en ${params.splitName}.`);
    }
  }

  return Array.from(earnedByPerson.entries()).map(([personId, list]) => ({
    personId,
    badgeNames: list.sort((a, b) => a.sortOrder - b.sortOrder).map((entry) => entry.name),
  }));
}
