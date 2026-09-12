"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { SplitStatus, KpiCode } from "@prisma/client";
import { KPI_CATALOG_LIST } from "@/domain/kpis/catalog";
import { toKpiConfigView, type KpiConfigView } from "@/domain/kpis/mapping";
import type { SplitKpiConfig } from "@prisma/client";
import { updateAllKpiConfigsAction } from "@/server/actions/kpi.actions";
import { initialActionState } from "@/server/actions/action-result";
import { Button, ErrorMessage, SuccessMessage } from "@/components/ui";
import { KpiConfigCard } from "./KpiConfigCard";

function SaveAllKpiButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Guardando todos..." : "Guardar todos los KPI"}
    </Button>
  );
}

/**
 * Agrupa los errores del guardado conjunto (claves `${kpiCode}.${campo}`)
 * por KPI, ya sin el prefijo, para que cada tarjeta solo reciba los suyos
 * (`1.0.1`, parte H del encargo).
 */
function groupBulkErrorsByKpi(fieldErrors: Record<string, string> | undefined): Partial<Record<KpiCode, Record<string, string>>> {
  const grouped: Partial<Record<KpiCode, Record<string, string>>> = {};
  if (!fieldErrors) return grouped;
  for (const [key, message] of Object.entries(fieldErrors)) {
    const separatorIndex = key.indexOf(".");
    if (separatorIndex === -1) continue;
    const kpiCode = key.slice(0, separatorIndex) as KpiCode;
    const field = key.slice(separatorIndex + 1);
    const bucket = grouped[kpiCode] ?? {};
    bucket[field] = message;
    grouped[kpiCode] = bucket;
  }
  return grouped;
}

/**
 * Configuracion de KPI del split (`1.0.1`, parte H del encargo): un unico
 * `<form>` exterior comparte la `FormData` entre el guardado individual de
 * cada tarjeta (su boton usa `formAction` propio) y el guardado conjunto
 * "Guardar todos los KPI" (accion por defecto del `<form>`), sin llamar a
 * diez Server Actions ni abrir diez transacciones independientes.
 */
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
  const configByCode = new Map<string, KpiConfigView>(kpiConfigs.map((config) => [config.kpiCode, toKpiConfigView(config)]));
  const readOnly = splitStatus === "CLOSED" || locked;

  const bulkAction = updateAllKpiConfigsAction.bind(null, splitId);
  const [bulkState, bulkFormAction] = useFormState(bulkAction, initialActionState);
  const bulkErrorsByKpi = groupBulkErrorsByKpi(bulkState.fieldErrors);

  return (
    <section id="kpi-configuracion" className="scroll-mt-20 space-y-3">
      <form action={bulkFormAction} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">KPI del split</h2>
          {!readOnly && <SaveAllKpiButton />}
        </div>
        {splitStatus === "CLOSED" ? (
          <p className="text-sm text-text-muted">El split está cerrado: la configuración de KPI se muestra en modo solo lectura.</p>
        ) : (
          locked && <p className="text-sm text-reward-ink">La configuración quedó bloqueada al publicar la primera semana del split.</p>
        )}
        {!bulkState.ok && bulkState.error && <ErrorMessage>{bulkState.error}</ErrorMessage>}
        {bulkState.ok && <SuccessMessage>Todos los KPI se han guardado correctamente.</SuccessMessage>}

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
                bulkFieldErrors={bulkErrorsByKpi[catalogEntry.code]}
              />
            );
          })}
        </div>
      </form>
    </section>
  );
}
