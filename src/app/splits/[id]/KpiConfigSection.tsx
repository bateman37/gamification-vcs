import type { SplitStatus } from "@prisma/client";
import { KPI_CATALOG_LIST } from "@/domain/kpis/catalog";
import { toKpiConfigView, type KpiConfigView } from "@/domain/kpis/mapping";
import type { SplitKpiConfig } from "@prisma/client";
import { KpiConfigCard } from "./KpiConfigCard";

export function KpiConfigSection({
  splitId,
  splitStatus,
  kpiConfigs,
}: {
  splitId: string;
  splitStatus: SplitStatus;
  kpiConfigs: SplitKpiConfig[];
}) {
  const configByCode = new Map<string, KpiConfigView>(
    kpiConfigs.map((config) => [config.kpiCode, toKpiConfigView(config)]),
  );
  const readOnly = splitStatus === "CLOSED";

  return (
    <section id="kpi-configuracion" className="scroll-mt-6 space-y-3">
      <h2 className="text-lg font-semibold">KPI del split</h2>
      {readOnly && (
        <p className="text-sm text-slate-500">
          El split esta cerrado: la configuracion de KPI se muestra en modo solo lectura.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {KPI_CATALOG_LIST.map((catalogEntry) => {
          const config = configByCode.get(catalogEntry.code);
          if (!config) return null;
          return (
            <KpiConfigCard
              key={catalogEntry.code}
              splitId={splitId}
              kpiCode={catalogEntry.code}
              name={catalogEntry.name}
              description={catalogEntry.description}
              calculationExplanation={catalogEntry.calculationExplanation}
              parameterDefs={catalogEntry.parameters}
              config={config}
              readOnly={readOnly}
            />
          );
        })}
      </div>
    </section>
  );
}
