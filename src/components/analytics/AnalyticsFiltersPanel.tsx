import Link from "next/link";
import type { AnalyticsSplitOption } from "@/server/services/analytics.service";
import { GAMIFICATION_MODE_PARAM } from "@/domain/gamification-view";
import { formatDateEs, formatDateIso } from "./format";
import { buildAnalyticsHref, type ParsedAnalyticsFilters, type RawSearchParams } from "@/app/analitica/filters";
import { HiddenPassthroughFields } from "./HiddenPassthroughFields";

const OWNED_FORM_KEYS = ["splits", "nivel", "inicio", "fin", "agrupacion", "umbral"];
const SEMANA_FORM_KEYS = ["semana"];

function ToggleLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded-control px-3 py-1.5 text-sm font-medium ${active ? "bg-ink text-white" : "text-text-muted hover:bg-surface-muted"}`}
    >
      {children}
    </Link>
  );
}

/**
 * Filtros compartidos por las seis pestañas (parte D3 del encargo): splits,
 * periodo, agrupacion, nivel, modo, politica de ceros y comparacion. Sin
 * JavaScript de cliente: los controles complejos son formularios GET
 * nativos y los controles binarios son enlaces que preservan el resto de
 * la URL (mismo patron que `GamificationToggle` de `/resultados`).
 */
export function AnalyticsFiltersPanel({
  searchParams,
  splitOptions,
  filters,
  effectiveSplitIds,
  startDate,
  endDate,
  periodWeekStartDates,
  defaultZeroThreshold,
}: {
  searchParams: RawSearchParams;
  splitOptions: AnalyticsSplitOption[];
  filters: ParsedAnalyticsFilters;
  effectiveSplitIds: string[];
  startDate: Date;
  endDate: Date;
  periodWeekStartDates: Date[];
  defaultZeroThreshold: number;
}) {
  const selectedSplitSet = new Set(effectiveSplitIds);

  return (
    <details className="rounded-card border border-border bg-surface p-4" open>
      <summary className="cursor-pointer text-sm font-semibold text-ink">Filtros de la consulta</summary>
      <div className="mt-4 space-y-4">
        <form method="get" action="/analitica" className="flex flex-wrap items-end gap-4">
          <HiddenPassthroughFields searchParams={searchParams} excludeKeys={OWNED_FORM_KEYS} />

          <div className="flex flex-col gap-1">
            <label htmlFor="analitica-splits" className="text-xs font-medium text-text-muted">
              Splits ({selectedSplitSet.size} seleccionados)
            </label>
            <select
              id="analitica-splits"
              name="splits"
              multiple
              size={Math.min(5, Math.max(2, splitOptions.length))}
              defaultValue={[...selectedSplitSet]}
              className="min-w-[14rem] rounded-control border border-border-strong bg-surface px-2 py-1 text-sm"
            >
              {splitOptions.map((split) => (
                <option key={split.id} value={split.id}>
                  {split.name}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs font-medium text-text-muted">Nivel</legend>
            <div className="flex gap-3 text-sm">
              {(["N0", "N1", "N2"] as const).map((level) => (
                <label key={level} className="flex items-center gap-1">
                  <input type="checkbox" name="nivel" value={level} defaultChecked={filters.levels.length === 0 || filters.levels.includes(level)} />
                  {level}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1">
            <label htmlFor="analitica-inicio" className="text-xs font-medium text-text-muted">
              Desde (lunes de la semana)
            </label>
            <input id="analitica-inicio" type="date" name="inicio" defaultValue={formatDateIso(startDate)} className="rounded-control border border-border-strong bg-surface px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="analitica-fin" className="text-xs font-medium text-text-muted">
              Hasta
            </label>
            <input id="analitica-fin" type="date" name="fin" defaultValue={formatDateIso(endDate)} className="rounded-control border border-border-strong bg-surface px-2 py-1 text-sm" />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="analitica-agrupacion" className="text-xs font-medium text-text-muted">
              Agrupación de gráficos
            </label>
            <select id="analitica-agrupacion" name="agrupacion" defaultValue={filters.grouping} className="rounded-control border border-border-strong bg-surface px-2 py-1 text-sm">
              <option value="semana">Semana</option>
              <option value="mes">Mes</option>
              <option value="año">Año</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="analitica-umbral" className="text-xs font-medium text-text-muted">
              Umbral de ceros/ausencias
            </label>
            <input
              id="analitica-umbral"
              type="number"
              name="umbral"
              min={2}
              max={10}
              defaultValue={filters.zeroThreshold || defaultZeroThreshold}
              className="w-20 rounded-control border border-border-strong bg-surface px-2 py-1 text-sm"
            />
          </div>

          <button type="submit" className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
            Aplicar filtros
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-muted">Modo:</span>
            <div className="inline-flex gap-1 rounded-card border border-border-strong bg-surface p-1">
              <ToggleLink href={buildAnalyticsHref(searchParams, { [GAMIFICATION_MODE_PARAM]: "sin" })} active={filters.mode === "sin"}>
                Sin gamificación
              </ToggleLink>
              <ToggleLink href={buildAnalyticsHref(searchParams, { [GAMIFICATION_MODE_PARAM]: "con" })} active={filters.mode === "con"}>
                Con gamificación
              </ToggleLink>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-muted">Posibles ausencias:</span>
            <div className="inline-flex gap-1 rounded-card border border-border-strong bg-surface p-1">
              <ToggleLink href={buildAnalyticsHref(searchParams, { exclusion: "on" })} active={filters.exclusionEnabled}>
                Excluir (umbral {filters.zeroThreshold})
              </ToggleLink>
              <ToggleLink href={buildAnalyticsHref(searchParams, { exclusion: "off" })} active={!filters.exclusionEnabled}>
                Incluir todo
              </ToggleLink>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-muted">Comparar con:</span>
            <div className="inline-flex gap-1 rounded-card border border-border-strong bg-surface p-1">
              <ToggleLink href={buildAnalyticsHref(searchParams, { comparacion: "semana_anterior" })} active={filters.comparisonMode === "semana_anterior"}>
                Semana anterior
              </ToggleLink>
              <ToggleLink href={buildAnalyticsHref(searchParams, { comparacion: "media_periodo" })} active={filters.comparisonMode === "media_periodo"}>
                Media del período
              </ToggleLink>
            </div>
          </div>

          {periodWeekStartDates.length > 0 && (
            <form method="get" action="/analitica" className="flex items-center gap-2">
              <HiddenPassthroughFields searchParams={searchParams} excludeKeys={SEMANA_FORM_KEYS} />
              <label htmlFor="analitica-semana" className="text-xs font-medium text-text-muted">
                Comparar semana del
              </label>
              <select
                id="analitica-semana"
                name="semana"
                defaultValue={formatDateIso(filters.analyzedWeek ?? periodWeekStartDates[periodWeekStartDates.length - 1]!)}
                className="rounded-control border border-border-strong bg-surface px-2 py-1 text-sm"
              >
                {periodWeekStartDates.map((date) => (
                  <option key={date.toISOString()} value={formatDateIso(date)}>
                    {formatDateEs(date)}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded-control border border-border-strong px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
                Ver
              </button>
            </form>
          )}

          <Link href="/analitica" className="ml-auto text-sm font-medium text-primary hover:underline">
            Restablecer filtros
          </Link>
        </div>
      </div>
    </details>
  );
}
