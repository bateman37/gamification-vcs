import { Prisma, type PrismaClient, type NewsCategory, type NewsOrigin, type NewsPriority } from "@prisma/client";
import { DomainError } from "@/lib/errors";

/**
 * Nucleo del centro de noticias (`1.0.0` / MVP-3, ver docs/NEWS_CENTER.md).
 * No es un motor generico de eventos: solo sabe crear una noticia con sus
 * entregas de forma atomica e idempotente. Cada evento automatico (alta de
 * participante, activacion, facciones, profesiones, localizaciones,
 * mercado, compra, publicacion...) vive en el servicio de negocio que lo
 * dispara, que llama aqui con el texto ya redactado
 * (`src/domain/news-templates.ts`) y los destinatarios ya resueltos.
 *
 * Acepta `PrismaClient | Prisma.TransactionClient` para poder escribir la
 * noticia dentro de la misma transaccion que confirma el hecho de negocio
 * (compra, publicacion, apertura/cierre de mercado...), igual que el resto
 * de servicios del proyecto.
 */

type Db = PrismaClient | Prisma.TransactionClient;

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

export interface NewsRecipient {
  /** Destinatario de jugador: se entrega a la `Person`, exista o no su `User` todavia. */
  personId?: string;
  /** Destinatario de administracion: se entrega directamente al `User`. */
  userId?: string;
  /** Ruta interna ya construida (`src/domain/news-links.ts`), o `null`/`undefined` sin enlace. */
  actionPath?: string | null;
}

export interface CreateNewsInput {
  splitId?: string | null;
  splitNameSnapshot?: string | null;
  origin: NewsOrigin;
  category: NewsCategory;
  priority?: NewsPriority;
  title: string;
  body: string;
  /**
   * Clave de idempotencia. Para eventos no repetibles, un identificador
   * estable (`participant-added:<splitParticipantId>`). Para eventos
   * repetibles (mercado, facciones, localizaciones...), el llamador debe
   * incluir un identificador de operacion distinto por cambio real (por
   * ejemplo un UUID generado una sola vez antes de entrar a la transaccion),
   * nunca solo `updatedAt`.
   */
  eventKey?: string | null;
  createdByUserId?: string | null;
  manualAudienceSnapshot?: string | null;
}

export interface CreateNewsResult {
  newsItemId: string;
  /** `false` si ya existia una noticia con el mismo `eventKey` (idempotencia; no es un error). */
  created: boolean;
}

function dedupeRecipients(recipients: NewsRecipient[]): NewsRecipient[] {
  const seenPersons = new Set<string>();
  const seenUsers = new Set<string>();
  const result: NewsRecipient[] = [];
  for (const recipient of recipients) {
    if (recipient.personId) {
      if (seenPersons.has(recipient.personId)) continue;
      seenPersons.add(recipient.personId);
      result.push(recipient);
    } else if (recipient.userId) {
      if (seenUsers.has(recipient.userId)) continue;
      seenUsers.add(recipient.userId);
      result.push(recipient);
    }
  }
  return result;
}

/**
 * Crea una noticia con sus entregas. Si `eventKey` ya existe (creacion
 * previa o carrera concurrente), no crea nada nuevo y devuelve la noticia
 * existente (`created: false`): una publicacion, compra o reintento nunca
 * debe duplicar la noticia asociada.
 */
export async function createNewsWithDeliveries(
  db: Db,
  input: CreateNewsInput,
  rawRecipients: NewsRecipient[],
): Promise<CreateNewsResult> {
  const recipients = dedupeRecipients(rawRecipients);
  if (recipients.length === 0) {
    throw new DomainError("Una noticia no puede crearse sin destinatarios.");
  }

  if (input.eventKey) {
    const existing = await db.newsItem.findUnique({ where: { eventKey: input.eventKey }, select: { id: true } });
    if (existing) {
      return { newsItemId: existing.id, created: false };
    }
  }

  try {
    const newsItem = await db.newsItem.create({
      data: {
        splitId: input.splitId ?? null,
        splitNameSnapshot: input.splitNameSnapshot ?? null,
        origin: input.origin,
        category: input.category,
        priority: input.priority ?? "NORMAL",
        title: input.title,
        body: input.body,
        eventKey: input.eventKey ?? null,
        createdByUserId: input.createdByUserId ?? null,
        manualAudienceSnapshot: input.manualAudienceSnapshot ?? null,
      },
    });
    await db.newsDelivery.createMany({
      data: recipients.map((recipient) => ({
        newsItemId: newsItem.id,
        recipientPersonId: recipient.personId ?? null,
        recipientUserId: recipient.userId ?? null,
        actionPath: recipient.actionPath ?? null,
      })),
    });
    return { newsItemId: newsItem.id, created: true };
  } catch (error) {
    if (input.eventKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_ERROR_CODE) {
      const raceExisting = await db.newsItem.findUnique({ where: { eventKey: input.eventKey }, select: { id: true } });
      if (raceExisting) {
        return { newsItemId: raceExisting.id, created: false };
      }
    }
    throw error;
  }
}

// --- Resolucion de destinatarios (seccion 29/45 del encargo) --------------

export interface ParticipantRecipient {
  splitParticipantId: string;
  personId: string;
}

/** Todas las personas participantes de un split, en el instante exacto de la operacion. */
export async function resolveAllParticipantsForSplit(db: Db, splitId: string): Promise<ParticipantRecipient[]> {
  const participants = await db.splitParticipant.findMany({
    where: { splitId },
    select: { id: true, personId: true },
  });
  return participants.map((p) => ({ splitParticipantId: p.id, personId: p.personId }));
}

/** Personas actualmente asignadas a una faccion concreta del split. */
export async function resolveFactionMembers(db: Db, splitId: string, factionId: string): Promise<ParticipantRecipient[]> {
  const participants = await db.splitParticipant.findMany({
    where: { splitId, factionId },
    select: { id: true, personId: true },
  });
  return participants.map((p) => ({ splitParticipantId: p.id, personId: p.personId }));
}

/** Usuarios administradores activos, destinatarios de toda noticia de administracion. */
export async function resolveActiveAdminUserIds(db: Db): Promise<string[]> {
  const admins = await db.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
  return admins.map((admin) => admin.id);
}
