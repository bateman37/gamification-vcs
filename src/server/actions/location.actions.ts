"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { deleteWeekLocation, upsertWeekLocation } from "@/server/services/location.service";
import { weekLocationFormSchema } from "@/server/validation/location";
import { runAction, type ActionState } from "@/server/actions/action-result";
import { requireAdminSession } from "@/lib/session";

/**
 * Administracion de localizaciones semanales (`0.8.5` / MVP-2C, ver
 * docs/WEEKLY_LOCATIONS.md). Solo `ADMIN`: cada accion vuelve a comprobar
 * `requireAdminSession` en servidor, porque una Server Action es una ruta
 * invocable directamente, ademas de que la pagina que renderiza el
 * formulario ya exige sesion de administrador.
 */

function revalidateWeekLocationPaths(splitId: string, weekId: string) {
  revalidatePath(`/splits/${splitId}`);
  revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis`);
  revalidatePath(`/splits/${splitId}/weeks/${weekId}/localizacion`);
  revalidatePath(`/splits/${splitId}/weeks/${weekId}/resultados`);
}

export async function upsertWeekLocationAction(
  splitId: string,
  weekId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    const input = weekLocationFormSchema.parse({
      name: formData.get("name"),
      kpiCode: formData.get("kpiCode"),
      bonusPercent: formData.get("bonusPercent"),
    });
    await upsertWeekLocation(prisma, splitId, weekId, input);
    revalidateWeekLocationPaths(splitId, weekId);
  });
}

export async function deleteWeekLocationAction(
  splitId: string,
  weekId: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    await deleteWeekLocation(prisma, splitId, weekId);
    revalidateWeekLocationPaths(splitId, weekId);
  });
}
