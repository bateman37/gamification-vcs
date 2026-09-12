import { randomUUID } from "node:crypto";
import type { NewsCategory, NewsItem, PrismaClient } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { createNewsWithDeliveries, resolveAllParticipantsForSplit, resolveFactionMembers } from "@/server/services/news.service";
import { buildManualNewsActionPath } from "@/domain/news-links";
import type { ManualNewsFormInput } from "@/server/validation/news-manual";

/**
 * Envio manual de noticias desde administracion (`1.0.0` / MVP-3, ver
 * docs/NEWS_CENTER.md, seccion 42 del encargo). El publico se resuelve y
 * congela siempre en servidor a partir del `splitId`/`factionId`/
 * `splitParticipantId` validados, nunca de una lista de ids enviada desde
 * el navegador. La proteccion de doble envio depende de `idempotencyKey`
 * (un valor generado una sola vez al renderizar el formulario, no de
 * deshabilitar el boton en el navegador): un reenvio con la misma clave
 * nunca duplica la noticia.
 */

export interface ManualNewsRecipientPreview {
  recipientCount: number;
  audienceLabel: string;
}

/** Numero de destinatarios que resultarian del publico elegido, para "Se enviará a N personas" (seccion 42). */
export async function previewManualNewsAudience(
  db: PrismaClient,
  splitId: string,
  audience: { audienceType: "SPLIT" } | { audienceType: "FACTION"; factionId: string } | { audienceType: "PERSON"; splitParticipantId: string },
): Promise<ManualNewsRecipientPreview> {
  if (audience.audienceType === "SPLIT") {
    const recipients = await resolveAllParticipantsForSplit(db, splitId);
    return { recipientCount: recipients.length, audienceLabel: "Todo el split" };
  }
  if (audience.audienceType === "FACTION") {
    const faction = await db.splitFaction.findUnique({ where: { id: audience.factionId } });
    if (!faction || faction.splitId !== splitId) throw new DomainError("La faccion seleccionada no pertenece a este split.", "factionId");
    const recipients = await resolveFactionMembers(db, splitId, audience.factionId);
    return { recipientCount: recipients.length, audienceLabel: `Faccion ${faction.name}` };
  }
  const participant = await db.splitParticipant.findUnique({ where: { id: audience.splitParticipantId }, include: { person: true } });
  if (!participant || participant.splitId !== splitId) {
    throw new DomainError("La persona seleccionada no pertenece a este split.", "splitParticipantId");
  }
  return { recipientCount: 1, audienceLabel: `Persona: ${participant.alias}` };
}

export interface SendManualNewsResult {
  newsItemId: string;
  recipientCount: number;
  alreadySent: boolean;
}

export async function sendManualNews(db: PrismaClient, createdByUserId: string, input: ManualNewsFormInput): Promise<SendManualNewsResult> {
  const split = await db.split.findUnique({ where: { id: input.splitId } });
  if (!split) throw new DomainError("El split indicado no existe.");

  let recipients: { splitParticipantId: string; personId: string }[];
  let audienceLabel: string;

  if (input.audienceType === "SPLIT") {
    recipients = await resolveAllParticipantsForSplit(db, input.splitId);
    audienceLabel = "Todo el split";
  } else if (input.audienceType === "FACTION") {
    if (!input.factionId) throw new DomainError("Selecciona una faccion.", "factionId");
    const faction = await db.splitFaction.findUnique({ where: { id: input.factionId } });
    if (!faction || faction.splitId !== input.splitId) {
      throw new DomainError("La faccion seleccionada no pertenece a este split.", "factionId");
    }
    recipients = await resolveFactionMembers(db, input.splitId, input.factionId);
    audienceLabel = `Faccion ${faction.name}`;
  } else {
    if (!input.splitParticipantId) throw new DomainError("Selecciona una persona.", "splitParticipantId");
    const participant = await db.splitParticipant.findUnique({ where: { id: input.splitParticipantId } });
    if (!participant || participant.splitId !== input.splitId) {
      throw new DomainError("La persona seleccionada no pertenece a este split.", "splitParticipantId");
    }
    recipients = [{ splitParticipantId: participant.id, personId: participant.personId }];
    audienceLabel = `Persona: ${participant.alias}`;
  }

  if (recipients.length === 0) {
    throw new DomainError("No hay destinatarios para el publico seleccionado. No se puede enviar.");
  }

  const eventKey = `manual-news:${input.idempotencyKey}`;
  const category: NewsCategory = "ANNOUNCEMENT";

  const result = await createNewsWithDeliveries(
    db,
    {
      splitId: input.splitId,
      splitNameSnapshot: split.name,
      origin: "MANUAL",
      category,
      priority: input.priority,
      title: input.title,
      body: input.body,
      createdByUserId,
      manualAudienceSnapshot: audienceLabel,
      eventKey,
    },
    recipients.map((recipient) => ({
      personId: recipient.personId,
      actionPath: buildManualNewsActionPath(input.destination, { splitId: input.splitId, splitParticipantId: recipient.splitParticipantId }),
    })),
  );

  return { newsItemId: result.newsItemId, recipientCount: recipients.length, alreadySent: !result.created };
}

export interface ManualNewsHistoryEntry extends Pick<NewsItem, "id" | "title" | "body" | "priority" | "createdAt" | "manualAudienceSnapshot" | "splitNameSnapshot"> {
  authorEmail: string | null;
  recipientCount: number;
}

/** Historico de envios manuales, mas reciente primero (seccion 44 del encargo). Nunca expone lecturas individuales. */
export async function listManualNewsHistory(db: PrismaClient, limit = 50): Promise<ManualNewsHistoryEntry[]> {
  const items = await db.newsItem.findMany({
    where: { origin: "MANUAL" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { createdByUser: { select: { email: true } }, _count: { select: { deliveries: true } } },
  });
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    priority: item.priority,
    createdAt: item.createdAt,
    manualAudienceSnapshot: item.manualAudienceSnapshot,
    splitNameSnapshot: item.splitNameSnapshot,
    authorEmail: item.createdByUser?.email ?? null,
    recipientCount: item._count.deliveries,
  }));
}

/** Uso propio de un UUID de idempotencia, generado una vez por render del formulario. */
export function generateIdempotencyKey(): string {
  return randomUUID();
}
