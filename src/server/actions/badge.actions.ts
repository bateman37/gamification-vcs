"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import {
  importLegacyBadgesV1,
  relinkBadgeHistoricalRecipient,
  runAutomaticBadgeRecipientLinking,
} from "@/server/services/badge-historical.service";
import { runAction, type ActionState } from "@/server/actions/action-result";

/** Administracion historica de Badges (`1.2.3`, seccion 3.3/4.2 del encargo). Solo `ADMIN`. */

export async function importLegacyBadgesAction(_prevState: ActionState, _formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    await importLegacyBadgesV1(prisma);
    revalidatePath("/badges/administracion");
    revalidatePath("/badges");
  });
}

export async function runAutomaticBadgeLinkingAction(_prevState: ActionState, _formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    await runAutomaticBadgeRecipientLinking(prisma);
    revalidatePath("/badges/administracion");
    revalidatePath("/badges");
  });
}

export async function relinkBadgeRecipientAction(recipientId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    const raw = formData.get("personId");
    const personId = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
    await relinkBadgeHistoricalRecipient(prisma, recipientId, personId);
    revalidatePath("/badges/administracion");
    revalidatePath("/badges");
  });
}
