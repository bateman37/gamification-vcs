"use server";

import { revalidatePath } from "next/cache";
import type { KpiCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { buildKpiConfigSchema } from "@/server/validation/kpi";
import { KPI_CATALOG } from "@/domain/kpis/catalog";
import { runAction, type ActionState } from "@/server/actions/action-result";

/**
 * Actualiza la configuracion de un KPI. `parameters` nunca se toma tal
 * cual del formulario: se construye leyendo unicamente los campos que el
 * catalogo declara para este `kpiCode`, y se valida contra su esquema.
 */
export async function updateKpiConfigAction(
  splitId: string,
  kpiCode: KpiCode,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const catalogEntry = KPI_CATALOG[kpiCode];
    const rawParameters: Record<string, FormDataEntryValue | null> = {};
    for (const parameter of catalogEntry.parameters) {
      rawParameters[parameter.key] = formData.get(parameter.key);
    }

    const input = buildKpiConfigSchema(kpiCode).parse({
      isActive: formData.get("isActive") === "on",
      baseMax: formData.get("baseMax"),
      multiplierN0: formData.get("multiplierN0"),
      multiplierN1: formData.get("multiplierN1"),
      multiplierN2: formData.get("multiplierN2"),
      parameters: rawParameters,
    });

    await updateKpiConfig(prisma, splitId, kpiCode, input);
    revalidatePath(`/splits/${splitId}`);
  });
}
