import Link from "next/link";

export type BadgesTab = "clasificacion" | "vitrina";

/** Pestañas de `/badges` (seccion 6.1 del encargo): mismo patron que `AnalyticsTabsNav`. */
export function BadgesTabsNav({
  activeTab,
  isAdmin,
  orden,
  persona,
}: {
  activeTab: BadgesTab;
  isAdmin: boolean;
  orden: string;
  persona: string | null;
}) {
  const tabs: { key: BadgesTab; label: string }[] = [
    { key: "clasificacion", label: "Clasificación general" },
    { key: "vitrina", label: isAdmin ? "Badges de la persona" : "Mi vitrina" },
  ];

  function hrefFor(key: BadgesTab): string {
    const params = new URLSearchParams();
    params.set("vista", key);
    if (key === "clasificacion") params.set("orden", orden);
    if (isAdmin && persona) params.set("persona", persona);
    return `/badges?${params.toString()}`;
  }

  return (
    <div role="tablist" aria-label="Secciones de Badges" className="flex flex-wrap gap-1 rounded-card border border-border bg-surface p-1">
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <Link
            key={tab.key}
            href={hrefFor(tab.key)}
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
