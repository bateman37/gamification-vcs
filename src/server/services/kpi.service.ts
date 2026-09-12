import type { Prisma, PrismaClient, SplitKpiConfig } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { KPI_CATALOG_LIST, KPI_CATALOG, type KpiCode } from "@/domain/kpis/catalog";
import type { UpdateKpiConfigInput } from "@/server/validation/kpi";
import { assertSplitConfigurationIsEditable } from "@/server/services/shared/split-configuration-lock";
import { findFutureLocationsUsingKpi } from "@/server/services/location.service";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Crea las diez configuraciones de KPI de un split nuevo, inactivas y con
 * los valores predeterminados de Split 8. Debe llamarse dentro de la misma
 * transaccion que crea el split y sus semanas (ver
 * `createSplitWithWeeks`), para que la creacion sea atomica.
 */
export async function createDefaultKpiConfigs(tx: Prisma.TransactionClient, splitId: string): Promise<void> {
  await tx.splitKpiConfig.createMany({
    data: KPI_CATALOG_LIST.map((catalogEntry) => ({
      splitId,
      kpiCode: catalogEntry.code,
      isActive: false,
      baseMax: catalogEntry.defaultBaseMax,
      multiplierN0: catalogEntry.defaultMultipliers.N0,
      multiplierN1: catalogEntry.defaultMultipliers.N1,
      multiplierN2: catalogEntry.defaultMultipliers.N2,
      parameters: catalogEntry.defaultParameters,
    })),
  });
}

export async function listKpiConfigsForSplit(db: Db, splitId: string): Promise<SplitKpiConfig[]> {
  const configs = await db.splitKpiConfig.findMany({ where: { splitId } });
  const orderByCode = new Map(KPI_CATALOG_LIST.map((catalogEntry, index) => [catalogEntry.code, index]));
  return [...configs].sort(
    (a, b) => (orderByCode.get(a.kpiCode) ?? 0) - (orderByCode.get(b.kpiCode) ?? 0),
  );
}

export async function countActiveKpiConfigs(db: Db, splitId: string): Promise<number> {
  return db.splitKpiConfig.count({ where: { splitId, isActive: true } });
}

/**
 * Actualiza la configuracion de un KPI de un split. Bloqueada por completo
 * (activacion, maximo, multiplicadores y parametros) desde que el split
 * tiene al menos una semana publicada, ademas de en un split `CLOSED`
 * (`assertSplitConfigurationIsEditable`, seccion 12 de `0.7.0` / MVP-2A;
 * sustituye la decision provisional de `MVP-1B`, ver `docs/DECISIONS.md`).
 * La comprobacion se hace dentro de la misma transaccion que la escritura,
 * para proteger tambien una carrera entre la primera publicacion y una
 * edicion concurrente.
 */
export async function updateKpiConfig(
  db: PrismaClient,
  splitId: string,
  kpiCode: KpiCode,
  input: UpdateKpiConfigInput,
): Promise<SplitKpiConfig> {
  return db.$transaction(async (tx) => {
    const split = await tx.split.findUnique({ where: { id: splitId } });
    if (!split) {
      throw new DomainError("El split indicado no existe.");
    }
    await assertSplitConfigurationIsEditable(tx, split);

    const existing = await tx.splitKpiConfig.findUnique({
      where: { splitId_kpiCode: { splitId, kpiCode } },
    });
    if (!existing) {
      throw new DomainError("La configuracion de este KPI no existe para este split.");
    }

    // Desactivar un KPI usado por una localizacion futura la dejaria potenciando un KPI
    // inactivo: se rechaza identificando las semanas afectadas, sin tocar la localizacion
    // en silencio (seccion 8 del encargo, ver docs/WEEKLY_LOCATIONS.md).
    if (existing.isActive && !input.isActive) {
      const affected = await findFutureLocationsUsingKpi(tx, splitId, kpiCode);
      if (affected.length > 0) {
        const weeksText = affected.map((usage) => `semana ${usage.sequenceNumber} ("${usage.locationName}")`).join(", ");
        throw new DomainError(
          `No se puede desactivar "${KPI_CATALOG[kpiCode].name}": lo potencia la localizacion de ${weeksText}. Edita o elimina antes esa localizacion.`,
        );
      }
    }

    return tx.splitKpiConfig.update({
      where: { splitId_kpiCode: { splitId, kpiCode } },
      data: {
        isActive: input.isActive,
        baseMax: input.baseMax,
        multiplierN0: input.multiplierN0 ?? null,
        multiplierN1: input.multiplierN1 ?? null,
        multiplierN2: input.multiplierN2 ?? null,
        parameters: input.parameters,
      },
    });
  });
}
