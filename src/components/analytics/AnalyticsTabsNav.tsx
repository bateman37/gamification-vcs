import Link from "next/link";
import { buildAnalyticsHref, type AnalyticsTab, type RawSearchParams } from "@/app/analitica/filters";

/**
 * Navegacion de las seis pestañas (parte H1 del encargo), compartiendo el
 * resto de filtros de la URL. Enlaces de servidor sin JS: cambiar de
 * pestaña es una navegacion normal.
 */
export function AnalyticsTabsNav({
  tabs,
  activeTab,
  searchParams,
}: {
  tabs: { key: AnalyticsTab; label: string }[];
  activeTab: AnalyticsTab;
  searchParams: RawSearchParams;
}) {
  return (
    <div role="tablist" aria-label="Bloques de analítica avanzada" className="flex flex-wrap gap-1 rounded-card border border-border bg-surface p-1">
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <Link
            key={tab.key}
            href={buildAnalyticsHref(searchParams, { tab: tab.key })}
            role="tab"
            aria-selected={active}
            className={`rounded-control px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-ink text-white" : "text-text-muted hover:bg-surface-muted"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
