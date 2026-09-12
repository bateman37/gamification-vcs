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
