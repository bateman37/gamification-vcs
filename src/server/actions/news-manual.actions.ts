"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { manualNewsFormSchema } from "@/server/validation/news-manual";
import { sendManualNews } from "@/server/services/news-manual.service";
import { runAction, type ActionState } from "@/server/actions/action-result";

/** Solo ADMIN llega aqui: la pagina que renderiza este formulario ya exige `requireAdminSession` (seccion 40 del encargo). */
export async function sendManualNewsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdminSession();
  return runAction(async () => {
    const input = manualNewsFormSchema.parse({
      splitId: formData.get("splitId"),
      audienceType: formData.get("audienceType"),
      factionId: formData.get("factionId") || undefined,
      splitParticipantId: formData.get("splitParticipantId") || undefined,
      priority: formData.get("priority"),
      title: formData.get("title"),
      body: formData.get("body"),
      destination: formData.get("destination"),
      idempotencyKey: formData.get("idempotencyKey"),
    });
    await sendManualNews(prisma, session.user.id, input);
    revalidatePath("/noticias/administrar");
    revalidatePath("/noticias");
  });
}
