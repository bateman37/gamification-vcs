"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { closeMarket, openMarket } from "@/server/services/economy.service";
import { runAction, type ActionState } from "@/server/actions/action-result";

/**
 * Apertura/cierre del mercado (`0.9.0` / MVP-2D, parte B del encargo). Solo
 * `ADMIN`: se comprueba dentro de la propia Server Action, no solo en la
 * pagina que renderiza el boton.
 */

function revalidateEconomyPaths(splitId: string) {
  revalidatePath(`/splits/${splitId}`);
  revalidatePath(`/splits/${splitId}/economia`);
  revalidatePath("/fichas");
}

export async function openMarketAction(splitId: string, _prevState: ActionState, _formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    await openMarket(prisma, splitId);
    revalidateEconomyPaths(splitId);
  });
}

export async function closeMarketAction(splitId: string, _prevState: ActionState, _formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    await closeMarket(prisma, splitId);
    revalidateEconomyPaths(splitId);
  });
}
