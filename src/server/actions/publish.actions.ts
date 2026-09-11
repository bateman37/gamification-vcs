"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { requireAdminSession } from "@/lib/session";
import { publishWeek } from "@/server/services/publish-week.service";
import type { SimpleActionState } from "@/server/actions/auth.actions";
import { initialSimpleActionState } from "@/server/actions/auth.actions";

export { initialSimpleActionState };

/** Publica una semana (seccion 5.2 de docs/RESULTS_PUBLICATION.md). Solo administrador; recalcula todo en servidor. */
export async function publishWeekAction(
  splitId: string,
  weekId: string,
  _prevState: SimpleActionState,
  _formData: FormData,
): Promise<SimpleActionState> {
  const session = await requireAdminSession();

  try {
    await publishWeek(prisma, splitId, weekId, session.user.id);
    revalidatePath(`/splits/${splitId}`);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/kpis`);
    revalidatePath(`/splits/${splitId}/weeks/${weekId}/resultados`);
    revalidatePath(`/splits/${splitId}/clasificacion`);
    revalidatePath("/resultados");
    return { ok: true, saved: true };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: error.message };
    throw error;
  }
}
