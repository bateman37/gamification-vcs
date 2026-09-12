import type { SplitStatus } from "@prisma/client";
import { KPI_CATALOG_LIST } from "@/domain/kpis/catalog";
import { toKpiConfigView, type KpiConfigView } from "@/domain/kpis/mapping";
import type { SplitKpiConfig } from "@prisma/client";
import { KpiConfigCard } from "./KpiConfigCard";

export function KpiConfigSection({
  splitId,
  splitStatus,
  kpiConfigs,
  locked,
}: {
  splitId: string;
  splitStatus: SplitStatus;
  kpiConfigs: SplitKpiConfig[];
  /** `true` desde que el split tiene al menos una semana publicada (seccion 12 de `0.7.0` / MVP-2A). */
  locked: boolean;
}) {
  const configByCode = new Map<string, KpiConfigView>(
    kpiConfigs.map((config) => [config.kpiCode, toKpiConfigView(config)]),
  );
  const readOnly = splitStatus === "CLOSED" || locked;

  return (
    <section id="kpi-configuracion" className="scroll-mt-20 space-y-3">
      <h2 className="text-lg font-semibold">KPI del split</h2>
      {splitStatus === "CLOSED" ? (
        <p className="text-sm text-text-muted">
          El split esta cerrado: la configuracion de KPI se muestra en modo solo lectura.
        </p>
      ) : (
        locked && (
          <p className="text-sm text-reward-ink">
            La configuracion quedo bloqueada al publicar la primera semana del split.
          </p>
        )
      )}
      <div className="grid grid-cols-1 gap-3">
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
