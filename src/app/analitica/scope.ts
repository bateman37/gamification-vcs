import type { PrismaClient } from "@prisma/client";
import type { AnalyticsLevel } from "@/domain/analytics";
import { listAnalyticsSplitOptions, resolveDefaultAnalyticsFilters, type AnalyticsSplitOption } from "@/server/services/analytics.service";
import { parseAnalyticsSearchParams, type ParsedAnalyticsFilters, type RawSearchParams } from "./filters";

/**
 * Resuelve los filtros efectivos (parte D3 del encargo) compartidos por la
 * pagina principal y el detalle por persona: mismos splits, periodo y
 * niveles, validados en servidor (nunca se confia en un `splitId` de la URL
 * sin comprobar que pertenece al universo de splits con publicaciones).
 */
export interface AnalyticsEffectiveScope {
  filters: ParsedAnalyticsFilters;
  splitOptions: AnalyticsSplitOption[];
  effectiveSplitIds: string[];
  effectiveLevels: AnalyticsLevel[];
  startDate: Date;
  endDate: Date;
}

export async function resolveEffectiveScope(db: PrismaClient, searchParams: RawSearchParams): Promise<AnalyticsEffectiveScope> {
  const filters = parseAnalyticsSearchParams(searchParams);
  const splitOptions = await listAnalyticsSplitOptions(db);
  const defaults = await resolveDefaultAnalyticsFilters(db);

  const validSplitIds = new Set(splitOptions.map((s) => s.id));
  const effectiveSplitIds =
    filters.requestedSplitIds.length > 0 ? filters.requestedSplitIds.filter((id) => validSplitIds.has(id)) : defaults.splitIds;
  const effectiveLevels: AnalyticsLevel[] = filters.levels.length > 0 ? filters.levels : ["N0", "N1", "N2"];
  const startDate = filters.startDate ?? defaults.startDate;
  const endDate = filters.endDate ?? defaults.endDate;

  return { filters, splitOptions, effectiveSplitIds, effectiveLevels, startDate, endDate };
}
