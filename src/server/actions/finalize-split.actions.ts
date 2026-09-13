"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { finalizeSplit } from "@/server/services/finalize-split.service";
import { runAction, type ActionState } from "@/server/actions/action-result";

/** "Finalizar split" del detalle del split (`1.2.2`, seccion 7 del encargo). Solo `ADMIN`. */
export async function finalizeSplitAction(splitId: string, _prevState: ActionState, _formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    await finalizeSplit(prisma, splitId);
    revalidatePath(`/splits/${splitId}`);
  });
}
