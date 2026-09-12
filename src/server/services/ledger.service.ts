import type { CreditMovementType, Prisma, PrismaClient } from "@prisma/client";

/**
 * Libro de movimientos de creditos (`0.9.0` / MVP-2D, ver
 * docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md, seccion 4 del encargo): fuente de
 * verdad del saldo. `balance = suma de todos los movimientos`. Los
 * movimientos se crean exclusivamente desde `publish-week.service.ts`
 * (`WEEKLY_EARNING`) y `purchase.service.ts` (`PURCHASE`); este fichero solo
 * lee.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export async function getParticipantBalance(db: Db, splitParticipantId: string): Promise<number> {
  const result = await db.creditLedgerEntry.aggregate({
    where: { splitParticipantId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export interface LedgerEntryView {
  id: string;
  type: CreditMovementType;
  amount: number;
  description: string;
  createdAt: Date;
}

/** Historial compacto, del mas reciente al mas antiguo (seccion 18 del encargo). */
export async function listLedgerEntriesForParticipant(db: Db, splitParticipantId: string, limit = 200): Promise<LedgerEntryView[]> {
  const entries = await db.creditLedgerEntry.findMany({
    where: { splitParticipantId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return entries.map((entry) => ({
    id: entry.id,
    type: entry.type,
    amount: entry.amount,
    description: entry.description,
    createdAt: entry.createdAt,
  }));
}

export interface ParticipantEconomySummary {
  splitParticipantId: string;
  alias: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  purchaseCount: number;
}

/**
 * Resumen economico de todos los participantes de un split, para la
 * administracion (seccion 8 del encargo): saldo, total ganado, total
 * gastado y numero de compras. Dos consultas acotadas, nunca una por
 * participante.
 */
export async function listEconomySummaryForSplit(db: Db, splitId: string): Promise<ParticipantEconomySummary[]> {
  const participants = await db.splitParticipant.findMany({ where: { splitId }, select: { id: true, alias: true } });
  if (participants.length === 0) return [];

  const entries = await db.creditLedgerEntry.findMany({
    where: { splitParticipantId: { in: participants.map((participant) => participant.id) } },
    select: { splitParticipantId: true, type: true, amount: true },
  });

  const byParticipant = new Map<string, { earned: number; spent: number; purchases: number }>();
  for (const entry of entries) {
    const bucket = byParticipant.get(entry.splitParticipantId) ?? { earned: 0, spent: 0, purchases: 0 };
    if (entry.type === "WEEKLY_EARNING") {
      bucket.earned += entry.amount;
    } else {
      bucket.spent += -entry.amount;
      bucket.purchases += 1;
    }
    byParticipant.set(entry.splitParticipantId, bucket);
  }

  return participants
    .map((participant) => {
      const bucket = byParticipant.get(participant.id) ?? { earned: 0, spent: 0, purchases: 0 };
      return {
        splitParticipantId: participant.id,
        alias: participant.alias,
        balance: bucket.earned - bucket.spent,
        totalEarned: bucket.earned,
        totalSpent: bucket.spent,
        purchaseCount: bucket.purchases,
      };
    })
    .sort((a, b) => a.alias.localeCompare(b.alias, "es"));
}
