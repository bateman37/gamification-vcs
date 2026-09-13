import type { Prisma, PrismaClient } from "@prisma/client";
import { addCalendarDays, currentCalendarDate } from "@/lib/dates";
import { KPI_CATALOG_LIST } from "@/domain/kpis/catalog";
import type { AnalyticsLevel, ParticipantWeekObservation } from "@/domain/analytics";

/**
 * Capa de lectura del modulo de Analitica avanzada (`1.1.0`, ver
 * docs/ADVANCED_ANALYTICS.md): consultas acotadas y adaptacion de
 * instantaneas publicadas al contrato del motor puro
 * (`src/domain/analytics/*`). Nunca invoca `computeWeeklyResults` ni
 * consulta configuracion o equipo actuales: toda lectura de rendimiento
 * viene exclusivamente de `PublishedParticipantWeeklyResult`/
 * `PublishedKpiResult`.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export const KPI_CATALOG_FOR_ANALYTICS = KPI_CATALOG_LIST.map((entry) => ({ code: entry.code, name: entry.name }));

export interface AnalyticsSplitOption {
  id: string;
  name: string;
  startDate: Date;
}

/** Splits con al menos una publicacion (parte D3): unico universo de "todos" en este modulo. */
export async function listAnalyticsSplitOptions(db: Db): Promise<AnalyticsSplitOption[]> {
  const splits = await db.split.findMany({
    where: { publishedResults: { some: {} } },
    select: { id: true, name: true, startDate: true },
    orderBy: { startDate: "desc" },
  });
  return splits;
}

export interface DefaultAnalyticsFilters {
  splitIds: string[];
  startDate: Date;
  endDate: Date;
}

const DEFAULT_WINDOW_WEEKS = 12;

/**
 * Filtros predeterminados (parte D3): todos los splits con publicaciones,
 * ultimas 12 semanas de calendario hasta la ultima semana publicada
 * disponible. Si hay menos de 12 semanas, se piden igualmente: las
 * ausentes se muestran como huecos, nunca se centra en la fecha de hoy.
 */
export async function resolveDefaultAnalyticsFilters(db: Db): Promise<DefaultAnalyticsFilters> {
  const splitOptions = await listAnalyticsSplitOptions(db);
  const splitIds = splitOptions.map((split) => split.id);
  if (splitIds.length === 0) {
    const today = currentCalendarDate();
    return { splitIds: [], startDate: today, endDate: today };
  }

  const lastPublishedWeek = await db.splitWeek.findFirst({
    where: { splitId: { in: splitIds }, publication: { isNot: null } },
    orderBy: { startDate: "desc" },
    select: { startDate: true },
  });
  const endDate = lastPublishedWeek?.startDate ?? currentCalendarDate();
  const startDate = addCalendarDays(endDate, -7 * (DEFAULT_WINDOW_WEEKS - 1));
  return { splitIds, startDate, endDate };
}

export interface AnalyticsScope {
  splitIds: string[];
  startDate: Date;
  endDate: Date;
  levels?: AnalyticsLevel[];
}

const ALL_LEVELS: AnalyticsLevel[] = ["N0", "N1", "N2"];

/**
 * Carga observaciones persona-split-semana publicadas dentro del alcance
 * dado, en una unica consulta con `include` explicito (sin N+1). Nunca
 * incluye borradores ni resultados no publicados.
 */
export async function loadParticipantWeekObservations(db: Db, scope: AnalyticsScope): Promise<ParticipantWeekObservation[]> {
  if (scope.splitIds.length === 0) return [];
  const levels = scope.levels && scope.levels.length > 0 && scope.levels.length < ALL_LEVELS.length ? scope.levels : undefined;

  const rows = await db.publishedParticipantWeeklyResult.findMany({
    where: {
      splitId: { in: scope.splitIds },
      ...(levels ? { levelSnapshot: { in: levels } } : {}),
      publication: { splitWeek: { startDate: { gte: scope.startDate, lte: scope.endDate } } },
    },
    select: {
      personId: true,
      fullNameSnapshot: true,
      splitId: true,
      splitParticipantId: true,
      id: true,
      publicationId: true,
      levelSnapshot: true,
      creditsEarned: true,
      attendanceStatus: true,
      totalHoursSnapshot: true,
      split: { select: { name: true } },
      publication: { select: { publishedAt: true, splitWeek: { select: { id: true, sequenceNumber: true, startDate: true } } } },
      kpiResults: {
        select: {
          kpiCode: true,
          kpiNameSnapshot: true,
          outcomeStatus: true,
          finalPoints: true,
          basePointsBeforeProfession: true,
          baseMax: true,
          professionBonusPoints: true,
          locationBonusPoints: true,
          equipmentBonusPoints: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    personId: row.personId,
    personFullName: row.fullNameSnapshot,
    splitId: row.splitId,
    splitName: row.split.name,
    splitParticipantId: row.splitParticipantId,
    participantWeeklyResultId: row.id,
    publicationId: row.publicationId,
    splitWeekId: row.publication.splitWeek.id,
    weekSequenceNumber: row.publication.splitWeek.sequenceNumber,
    weekStartDate: row.publication.splitWeek.startDate,
    publishedAt: row.publication.publishedAt,
    levelSnapshot: row.levelSnapshot as AnalyticsLevel,
    creditsEarned: row.creditsEarned,
    attendanceStatus: row.attendanceStatus,
    totalHours: row.attendanceStatus === "PRESENT" ? row.totalHoursSnapshot?.toNumber() ?? null : null,
    cells: row.kpiResults.map((kpi) => ({
      kpiCode: kpi.kpiCode,
      kpiName: kpi.kpiNameSnapshot,
      status: kpi.outcomeStatus,
      finalPoints: kpi.finalPoints?.toNumber() ?? null,
      basePointsBeforeProfession: kpi.basePointsBeforeProfession?.toNumber() ?? null,
      baseMax: kpi.baseMax?.toNumber() ?? null,
      professionBonusPoints: kpi.professionBonusPoints?.toNumber() ?? 0,
      locationBonusPoints: kpi.locationBonusPoints?.toNumber() ?? 0,
      equipmentBonusPoints: kpi.equipmentBonusPoints?.toNumber() ?? 0,
    })),
  }));
}

/** Igual que `loadParticipantWeekObservations`, ampliando 7 dias hacia atras para resolver "Semana anterior" (parte G1). */
export async function loadParticipantWeekObservationsWithLookback(db: Db, scope: AnalyticsScope): Promise<ParticipantWeekObservation[]> {
  return loadParticipantWeekObservations(db, { ...scope, startDate: addCalendarDays(scope.startDate, -7) });
}

export interface PublishedEquippedItemRow {
  participantWeeklyResultId: string;
  storeItemId: string | null;
  itemNameSnapshot: string;
  kpiCodeSnapshot: string;
  bonusPercentSnapshot: number;
}

/** Objetos equipados congelados de las observaciones ya cargadas (parte I1), en una unica consulta. */
export async function loadEquippedItemsForResults(db: Db, participantWeeklyResultIds: string[]): Promise<PublishedEquippedItemRow[]> {
  if (participantWeeklyResultIds.length === 0) return [];
  const rows = await db.publishedEquippedItem.findMany({
    where: { participantWeeklyResultId: { in: participantWeeklyResultIds } },
    select: { participantWeeklyResultId: true, storeItemId: true, itemNameSnapshot: true, kpiCodeSnapshot: true, bonusPercentSnapshot: true },
  });
  return rows;
}

export interface LedgerEntryRow {
  splitParticipantId: string;
  splitId: string;
  personId: string;
  type: "WEEKLY_EARNING" | "PURCHASE";
  amount: number;
  createdAt: Date;
}

export interface EconomyScope {
  splitIds: string[];
  startDate: Date;
  endDate: Date;
}

/**
 * Libro de movimientos para el subbloque economico (parte I2): fechas de
 * operacion (`createdAt`), nunca fechas de rendimiento; nunca filtra por
 * nivel historico ni por la politica de exclusion de rendimiento.
 */
export async function loadEconomyLedger(
  db: Db,
  scope: EconomyScope,
): Promise<{ before: LedgerEntryRow[]; inRange: LedgerEntryRow[] }> {
  if (scope.splitIds.length === 0) return { before: [], inRange: [] };
  const endOfDay = addCalendarDays(scope.endDate, 1);
  const rows = await db.creditLedgerEntry.findMany({
    where: { splitParticipant: { splitId: { in: scope.splitIds } } },
    select: {
      splitParticipantId: true,
      type: true,
      amount: true,
      createdAt: true,
      splitParticipant: { select: { splitId: true, personId: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const mapped: LedgerEntryRow[] = rows.map((row) => ({
    splitParticipantId: row.splitParticipantId,
    splitId: row.splitParticipant.splitId,
    personId: row.splitParticipant.personId,
    type: row.type,
    amount: row.amount,
    createdAt: row.createdAt,
  }));
  return {
    before: mapped.filter((row) => row.createdAt < scope.startDate),
    inRange: mapped.filter((row) => row.createdAt >= scope.startDate && row.createdAt < endOfDay),
  };
}

export interface PurchaseSummaryRow {
  storeItemId: string;
  itemName: string;
  count: number;
}

/** Compras confirmadas del intervalo (fecha de operacion), para "objetos mas comprados" (parte H7/I2). */
export async function loadPurchaseSummary(db: Db, scope: EconomyScope): Promise<{ purchaseCount: number; distinctBuyerCount: number; items: PurchaseSummaryRow[] }> {
  if (scope.splitIds.length === 0) return { purchaseCount: 0, distinctBuyerCount: 0, items: [] };
  const endOfDay = addCalendarDays(scope.endDate, 1);
  const purchases = await db.itemPurchase.findMany({
    where: {
      purchasedAt: { gte: scope.startDate, lt: endOfDay },
      splitParticipant: { splitId: { in: scope.splitIds } },
    },
    select: { storeItemId: true, itemNameSnapshot: true, splitParticipantId: true },
  });
  const byItem = new Map<string, PurchaseSummaryRow>();
  const buyers = new Set<string>();
  for (const purchase of purchases) {
    buyers.add(purchase.splitParticipantId);
    const existing = byItem.get(purchase.storeItemId);
    if (existing) existing.count += 1;
    else byItem.set(purchase.storeItemId, { storeItemId: purchase.storeItemId, itemName: purchase.itemNameSnapshot, count: 1 });
  }
  return {
    purchaseCount: purchases.length,
    distinctBuyerCount: buyers.size,
    items: [...byItem.values()].sort((a, b) => b.count - a.count).slice(0, 10),
  };
}
