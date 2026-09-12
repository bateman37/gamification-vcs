import type { NewsCategory, Prisma, PrismaClient } from "@prisma/client";

/**
 * Bandeja privada de noticias (`1.0.0` / MVP-3, ver docs/NEWS_CENTER.md,
 * secciones 22/23/26). Toda consulta y mutacion se resuelve siempre a
 * partir de la identidad de la sesion (`recipientUserId`/`recipientPersonId`),
 * nunca de un id de destinatario recibido del navegador.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export interface NewsRecipientIdentity {
  userId: string;
  personId: string | null;
}

export type NewsStatusFilter = "all" | "unread" | "archived";

export interface NewsListItem {
  deliveryId: string;
  category: NewsCategory;
  priority: "NORMAL" | "IMPORTANT";
  title: string;
  body: string;
  splitId: string | null;
  splitName: string | null;
  actionPath: string | null;
  createdAt: Date;
  isUnread: boolean;
  isArchived: boolean;
}

function recipientWhere(identity: NewsRecipientIdentity): Prisma.NewsDeliveryWhereInput {
  return {
    OR: [{ recipientUserId: identity.userId }, ...(identity.personId ? [{ recipientPersonId: identity.personId }] : [])],
  };
}

function toListItem(delivery: {
  id: string;
  readAt: Date | null;
  archivedAt: Date | null;
  actionPath: string | null;
  createdAt: Date;
  newsItem: { category: NewsCategory; priority: "NORMAL" | "IMPORTANT"; title: string; body: string; splitId: string | null; splitNameSnapshot: string | null };
}): NewsListItem {
  return {
    deliveryId: delivery.id,
    category: delivery.newsItem.category,
    priority: delivery.newsItem.priority,
    title: delivery.newsItem.title,
    body: delivery.newsItem.body,
    splitId: delivery.newsItem.splitId,
    splitName: delivery.newsItem.splitNameSnapshot,
    actionPath: delivery.actionPath,
    createdAt: delivery.createdAt,
    isUnread: delivery.readAt === null,
    isArchived: delivery.archivedAt !== null,
  };
}

export async function countUnreadNews(db: Db, identity: NewsRecipientIdentity): Promise<number> {
  return db.newsDelivery.count({ where: { ...recipientWhere(identity), archivedAt: null, readAt: null } });
}

/** Las cinco noticias no archivadas mas recientes, para la vista previa de la campana. */
export async function previewRecentNews(db: Db, identity: NewsRecipientIdentity, limit = 5): Promise<NewsListItem[]> {
  const deliveries = await db.newsDelivery.findMany({
    where: { ...recipientWhere(identity), archivedAt: null },
    include: { newsItem: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });
  return deliveries.map(toListItem);
}

export interface NewsListPage {
  items: NewsListItem[];
  nextCursor: string | null;
}

export interface NewsListFilters {
  status: NewsStatusFilter;
  splitId?: string | null;
  category?: NewsCategory | null;
}

/** Bandeja paginada por cursor (20 por pagina), mas reciente primero (seccion 26 del encargo). */
export async function listNewsDeliveries(
  db: Db,
  identity: NewsRecipientIdentity,
  filters: NewsListFilters,
  cursor?: string | null,
  limit = 20,
): Promise<NewsListPage> {
  const where: Prisma.NewsDeliveryWhereInput = {
    ...recipientWhere(identity),
    archivedAt: filters.status === "archived" ? { not: null } : null,
    ...(filters.status === "unread" ? { readAt: null } : {}),
    newsItem: {
      ...(filters.splitId ? { splitId: filters.splitId } : {}),
      ...(filters.category ? { category: filters.category } : {}),
    },
  };

  const deliveries = await db.newsDelivery.findMany({
    where,
    include: { newsItem: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = deliveries.length > limit;
  const page = hasMore ? deliveries.slice(0, limit) : deliveries;
  return {
    items: page.map(toListItem),
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}

/** Splits con al menos una noticia entregada a este destinatario, para el filtro compacto de la bandeja. */
export async function listNewsSplitsForRecipient(db: Db, identity: NewsRecipientIdentity): Promise<{ splitId: string; splitName: string }[]> {
  const items = await db.newsItem.findMany({
    where: { splitId: { not: null }, deliveries: { some: recipientWhere(identity) } },
    select: { splitId: true, splitNameSnapshot: true },
    distinct: ["splitId"],
    orderBy: { splitNameSnapshot: "asc" },
  });
  return items
    .filter((item): item is { splitId: string; splitNameSnapshot: string } => item.splitId !== null && item.splitNameSnapshot !== null)
    .map((item) => ({ splitId: item.splitId, splitName: item.splitNameSnapshot }));
}

export async function markNewsRead(db: Db, identity: NewsRecipientIdentity, deliveryId: string): Promise<void> {
  await db.newsDelivery.updateMany({
    where: { id: deliveryId, ...recipientWhere(identity) },
    data: { readAt: new Date() },
  });
}

export async function markNewsUnread(db: Db, identity: NewsRecipientIdentity, deliveryId: string): Promise<void> {
  await db.newsDelivery.updateMany({
    where: { id: deliveryId, ...recipientWhere(identity) },
    data: { readAt: null },
  });
}

/** Archivar marca tambien como leida si todavia no lo estaba (seccion 22 del encargo); es idempotente. */
export async function archiveNews(db: Db, identity: NewsRecipientIdentity, deliveryId: string): Promise<void> {
  const now = new Date();
  const baseWhere = { id: deliveryId, ...recipientWhere(identity), archivedAt: null };
  await db.newsDelivery.updateMany({ where: { ...baseWhere, readAt: null }, data: { readAt: now, archivedAt: now } });
  await db.newsDelivery.updateMany({ where: baseWhere, data: { archivedAt: now } });
}

/** Restaurar solo limpia `archivedAt`; nunca vuelve a marcar como no leida. */
export async function restoreNews(db: Db, identity: NewsRecipientIdentity, deliveryId: string): Promise<void> {
  await db.newsDelivery.updateMany({
    where: { id: deliveryId, ...recipientWhere(identity), archivedAt: { not: null } },
    data: { archivedAt: null },
  });
}

/** Marca como leidas todas las entregas no archivadas del destinatario. */
export async function markAllNewsRead(db: Db, identity: NewsRecipientIdentity): Promise<void> {
  await db.newsDelivery.updateMany({
    where: { ...recipientWhere(identity), archivedAt: null, readAt: null },
    data: { readAt: new Date() },
  });
}
