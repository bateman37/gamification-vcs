"use server";

import { revalidatePath } from "next/cache";
import type { KpiCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { DomainError } from "@/lib/errors";
import { updateKpiConfig, updateAllKpiConfigs } from "@/server/services/kpi.service";
import { buildKpiConfigSchema, parseAllKpiConfigsFromFormData } from "@/server/validation/kpi";
import { KPI_CATALOG } from "@/domain/kpis/catalog";
import { runAction, type ActionState } from "@/server/actions/action-result";

/**
 * Actualiza la configuracion de un KPI. `parameters` nunca se toma tal
 * cual del formulario: se construye leyendo unicamente los campos que el
 * catalogo declara para este `kpiCode`, y se valida contra su esquema. Los
 * campos viven en el `<form>` compartido de `KpiConfigSection.tsx`
 * (`1.0.1`, parte H del encargo), por eso se leen con el prefijo
 * `${kpiCode}__`.
 */
export async function updateKpiConfigAction(
  splitId: string,
  kpiCode: KpiCode,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminSession();
    const catalogEntry = KPI_CATALOG[kpiCode];
    const prefix = `${kpiCode}__`;
    const rawParameters: Record<string, FormDataEntryValue | null> = {};
    for (const parameter of catalogEntry.parameters) {
      rawParameters[parameter.key] = formData.get(`${prefix}${parameter.key}`);
    }

    const input = buildKpiConfigSchema(kpiCode).parse({
      isActive: formData.get(`${prefix}isActive`) === "on",
      baseMax: formData.get(`${prefix}baseMax`),
      multiplierN0: formData.get(`${prefix}multiplierN0`),
      multiplierN1: formData.get(`${prefix}multiplierN1`),
      multiplierN2: formData.get(`${prefix}multiplierN2`),
      parameters: rawParameters,
    });

    await updateKpiConfig(prisma, splitId, kpiCode, input);
    revalidatePath(`/splits/${splitId}`);
  });
}

/**
 * "Guardar todos los KPI" (`1.0.1`, parte H del encargo): valida los diez
 * KPI con el mismo esquema que el guardado individual
 * (`parseAllKpiConfigsFromFormData`, funcion pura); si cualquiera es
 * invalido, no se guarda ninguno y los errores se devuelven atados a su
 * KPI y campo (`${kpiCode}.${campo}`, para que cada tarjeta muestre solo
 * los suyos). Si todos son validos, se guardan de una vez en una unica
 * transaccion (`updateAllKpiConfigs`), reutilizando exactamente las mismas
 * comprobaciones de bloqueo y de localizaciones/objetos que el guardado
 * individual.
 */
export async function updateAllKpiConfigsAction(
  splitId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminSession();

  const parsed = parseAllKpiConfigsFromFormData(formData);
  if (!parsed.ok) {
    return { ok: false, error: "Revisa los datos marcados en cada KPI.", fieldErrors: parsed.fieldErrors };
  }

  try {
    await updateAllKpiConfigs(prisma, splitId, parsed.updates);
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  revalidatePath(`/splits/${splitId}`);
  return { ok: true };
}
