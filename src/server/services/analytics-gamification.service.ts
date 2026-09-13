import type { Prisma, PrismaClient } from "@prisma/client";
import {
  buildEquippedItemAggregates,
  buildGamificationBonusSnapshot,
  resolveObservations,
  sumCreditsIssued,
  sumCreditsSpent,
  sumOpeningBalance,
  computeClosingBalance,
  type AnalyticsLevel,
  type EquippedItemAggregate,
  type GamificationBonusSnapshot,
} from "@/domain/analytics";
import {
  KPI_CATALOG_FOR_ANALYTICS,
  loadEconomyLedger,
  loadEquippedItemsForResults,
  loadParticipantWeekObservations,
  loadPurchaseSummary,
  type PurchaseSummaryRow,
} from "./analytics.service";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Datos del bloque 6 (parte H7/I del encargo): siempre muestra base y
 * bonificado a la vez, con independencia del selector principal (por eso
 * las observaciones se resuelven aqui forzando el modo `"sin"`). El
 * subbloque economico usa fechas de operacion (parte I2), no las fechas de
 * rendimiento, y no aplica el filtro de nivel ni la politica de exclusion.
 */
export interface GamificationTabData {
  bonus: GamificationBonusSnapshot;
  mostEquipped: EquippedItemAggregate[];
  mostValuable: EquippedItemAggregate[];
  economy: {
    creditsIssued: number;
    creditsSpent: number;
    openingBalance: number;
    closingBalance: number;
    purchaseCount: number;
    distinctBuyerCount: number;
    mostPurchasedItems: PurchaseSummaryRow[];
  };
}

export interface GamificationTabScope {
  splitIds: string[];
  startDate: Date;
  endDate: Date;
  levels: AnalyticsLevel[];
}

export async function buildGamificationTabData(db: Db, scope: GamificationTabScope): Promise<GamificationTabData> {
  const observations = await loadParticipantWeekObservations(db, {
    splitIds: scope.splitIds,
    startDate: scope.startDate,
    endDate: scope.endDate,
    levels: scope.levels,
  });

  const resolvedSin = resolveObservations(observations, { mode: "sin" }).filter((o) => !o.excluded);

  const bonus = buildGamificationBonusSnapshot(resolvedSin, KPI_CATALOG_FOR_ANALYTICS);

  const participantWeeklyResultIds = observations.map((o) => o.participantWeeklyResultId);
  const equippedItems = await loadEquippedItemsForResults(db, participantWeeklyResultIds);
  const cellsByResult = new Map(observations.map((o) => [o.participantWeeklyResultId, o.cells]));
  const equippedForAggregate = equippedItems.map((item) => {
    const cell = cellsByResult.get(item.participantWeeklyResultId)?.find((c) => c.kpiCode === item.kpiCodeSnapshot);
    const base = cell?.status === "COMPUTED" ? cell.basePointsBeforeProfession : null;
    const bonusPointsForKpi = base !== null && base !== undefined && base > 0 ? (base * item.bonusPercentSnapshot) / 100 : 0;
    return { storeItemId: item.storeItemId, itemNameSnapshot: item.itemNameSnapshot, kpiCodeSnapshot: item.kpiCodeSnapshot, bonusPercentSnapshot: item.bonusPercentSnapshot, bonusPointsForKpi };
  });
  const { mostEquipped, mostValuable } = buildEquippedItemAggregates(equippedForAggregate);

  const { before, inRange } = await loadEconomyLedger(db, { splitIds: scope.splitIds, startDate: scope.startDate, endDate: scope.endDate });
  const purchaseSummary = await loadPurchaseSummary(db, { splitIds: scope.splitIds, startDate: scope.startDate, endDate: scope.endDate });

  const openingBalance = sumOpeningBalance(before);
  const creditsIssued = sumCreditsIssued(inRange);
  const creditsSpent = sumCreditsSpent(inRange);

  return {
    bonus,
    mostEquipped,
    mostValuable,
    economy: {
      creditsIssued,
      creditsSpent,
      openingBalance,
      closingBalance: computeClosingBalance(openingBalance, creditsIssued, creditsSpent),
      purchaseCount: purchaseSummary.purchaseCount,
      distinctBuyerCount: purchaseSummary.distinctBuyerCount,
      mostPurchasedItems: purchaseSummary.items,
    },
  };
}
