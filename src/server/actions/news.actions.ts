"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import {
  archiveNews,
  markAllNewsRead,
  markNewsRead,
  markNewsUnread,
  restoreNews,
  type NewsRecipientIdentity,
} from "@/server/services/news-inbox.service";

/**
 * Acciones propias de la bandeja de noticias (seccion 51 del encargo): solo
 * reciben el id de una entrega. La pertenencia se comprueba siempre en
 * servidor a partir de la sesion actual (`session.user.id`/`personId`),
 * nunca de un dato adicional enviado por el navegador; una entrega ajena
 * simplemente no se modifica, sin revelar si existe.
 */

async function currentRecipientIdentity(): Promise<NewsRecipientIdentity> {
  const session = await requireSession();
  return { userId: session.user.id, personId: session.user.personId };
}

function revalidateNewsRoutes(): void {
  revalidatePath("/noticias");
  revalidatePath("/", "layout");
}

export async function markNewsReadAction(deliveryId: string): Promise<void> {
  const identity = await currentRecipientIdentity();
  await markNewsRead(prisma, identity, deliveryId);
  revalidateNewsRoutes();
}

export async function markNewsUnreadAction(deliveryId: string): Promise<void> {
  const identity = await currentRecipientIdentity();
  await markNewsUnread(prisma, identity, deliveryId);
  revalidateNewsRoutes();
}

export async function archiveNewsAction(deliveryId: string): Promise<void> {
  const identity = await currentRecipientIdentity();
  await archiveNews(prisma, identity, deliveryId);
  revalidateNewsRoutes();
}

export async function restoreNewsAction(deliveryId: string): Promise<void> {
  const identity = await currentRecipientIdentity();
  await restoreNews(prisma, identity, deliveryId);
  revalidateNewsRoutes();
}

export async function markAllNewsReadAction(): Promise<void> {
  const identity = await currentRecipientIdentity();
  await markAllNewsRead(prisma, identity);
  revalidateNewsRoutes();
}

/** Abrir una noticia desde la campana: la marca leida y navega a su enlace (seccion 22 del encargo). */
export async function openNewsAction(deliveryId: string, actionPath: string | null): Promise<void> {
  const identity = await currentRecipientIdentity();
  await markNewsRead(prisma, identity, deliveryId);
  revalidateNewsRoutes();
  redirect(actionPath ?? "/noticias");
}
