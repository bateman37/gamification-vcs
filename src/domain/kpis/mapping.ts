import type { SplitKpiConfig } from "@prisma/client";

/**
 * Version serializable de `SplitKpiConfig`, apta para pasar a componentes
 * cliente (los `Decimal` de Prisma no se pueden pasar directamente a un
 * Client Component).
 */
export interface KpiConfigView {
  kpiCode: SplitKpiConfig["kpiCode"];
  isActive: boolean;
  baseMax: number;
  multiplierN0: number | null;
  multiplierN1: number | null;
  multiplierN2: number | null;
  parameters: Record<string, number>;
}

export function toKpiConfigView(config: SplitKpiConfig): KpiConfigView {
  return {
    kpiCode: config.kpiCode,
    isActive: config.isActive,
    baseMax: config.baseMax.toNumber(),
    multiplierN0: config.multiplierN0?.toNumber() ?? null,
    multiplierN1: config.multiplierN1?.toNumber() ?? null,
    multiplierN2: config.multiplierN2?.toNumber() ?? null,
    parameters: config.parameters as Record<string, number>,
  };
}
