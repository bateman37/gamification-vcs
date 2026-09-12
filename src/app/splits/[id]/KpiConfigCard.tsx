"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { KpiCode } from "@prisma/client";
import { updateKpiConfigAction } from "@/server/actions/kpi.actions";
import { initialActionState } from "@/server/actions/action-result";
import { Badge, Button, ErrorMessage, FieldError, SuccessMessage } from "@/components/ui";
import type { KpiConfigView } from "@/domain/kpis/mapping";
import type { KpiParameterDefinition } from "@/domain/kpis/catalog";

function SaveKpiButton({ formAction }: { formAction: (formData: FormData) => void }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" formAction={formAction} disabled={pending} className="w-full lg:w-auto">
      {pending ? "Guardando..." : "Guardar"}
    </Button>
  );
}

function formatNumber(value: number): string {
  return String(value).replace(".", ",");
}

function MultiplierField({
  id,
  name,
  label,
  value,
  error,
}: {
  id: string;
  name: string;
  label: string;
  value: number | null;
  error?: string;
}) {
  return (
    <div className="w-28">
      <label htmlFor={id} className="block text-xs font-medium text-text-muted">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        defaultValue={value === null ? "" : formatNumber(value)}
        placeholder="No aplica"
        className="mt-1 w-full rounded-control border border-border-strong px-2 py-1 text-sm"
      />
      <FieldError message={error} />
    </div>
  );
}

/**
 * Fila de configuracion de un KPI (`1.0.1`, parte H del encargo): zonas
 * estables (identidad, activo/inactivo, maximo, multiplicadores,
 * parametros propios, columna de accion fija a la derecha) y guardado
 * individual y conjunto compartiendo la misma `FormData` del `<form>`
 * exterior (`KpiConfigSection.tsx`): los campos se nombran con el prefijo
 * `${kpiCode}__` para no colisionar entre KPI, y esta tarjeta ya no
 * renderiza su propio `<form>` (un `<form>` anidado seria HTML invalido).
 */
export function KpiConfigCard({
  splitId,
  kpiCode,
  name,
  description,
  calculationExplanation,
  parameterDefs,
  config,
  readOnly,
  bulkFieldErrors,
}: {
  splitId: string;
  kpiCode: KpiCode;
  name: string;
  description: string;
  calculationExplanation: string;
  parameterDefs: KpiParameterDefinition[];
  config: KpiConfigView;
  readOnly: boolean;
  /** Errores del guardado conjunto para este KPI concreto, ya sin el prefijo `${kpiCode}.` (seccion 20 del encargo). */
  bulkFieldErrors?: Record<string, string>;
}) {
  const prefix = `${kpiCode}__`;
  const updateWithIds = updateKpiConfigAction.bind(null, splitId, kpiCode);
  const [state, formAction] = useFormState(updateWithIds, initialActionState);

  const fieldError = (field: string): string | undefined => state.fieldErrors?.[field] ?? bulkFieldErrors?.[field];

  const multipliers: Array<{ level: "N0" | "N1" | "N2"; value: number | null }> = [
    { level: "N0", value: config.multiplierN0 },
    { level: "N1", value: config.multiplierN1 },
    { level: "N2", value: config.multiplierN2 },
  ];

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="lg:flex lg:items-start lg:gap-6">
        <div className="lg:w-64 lg:shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{name}</h3>
            <Badge tone={config.isActive ? "green" : "slate"}>{config.isActive ? "Activo" : "Inactivo"}</Badge>
          </div>
          <p className="mt-1 text-sm text-text-muted">{description}</p>
          <p className="mt-1 text-xs text-text-muted">{calculationExplanation}</p>
        </div>

        <div className="mt-4 lg:mt-0 lg:min-w-0 lg:flex-1">
          {readOnly ? (
            <dl className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
              <div className="w-24">
                <dt className="text-xs font-medium text-text-muted">Máximo base</dt>
                <dd>{formatNumber(config.baseMax)}</dd>
              </div>
              {multipliers.map(({ level, value }) => (
                <div key={level} className="w-28">
                  <dt className="text-xs font-medium text-text-muted">Multiplicador {level}</dt>
                  <dd>{value === null ? "No aplica" : formatNumber(value)}</dd>
                </div>
              ))}
              {parameterDefs.map((parameter) => (
                <div key={parameter.key} className="w-32">
                  <dt className="text-xs font-medium text-text-muted">{parameter.label}</dt>
                  <dd>{formatNumber(config.parameters[parameter.key] ?? parameter.defaultValue)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <fieldset className="flex flex-col gap-3 border-0 p-0 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
              <div className="flex flex-1 flex-wrap items-end gap-x-6 gap-y-3">
                <label className="flex items-center gap-2 pb-1 text-sm font-medium text-ink">
                  <input type="checkbox" name={`${prefix}isActive`} defaultChecked={config.isActive} className="h-4 w-4" />
                  Activo
                </label>

                <div className="w-24">
                  <label htmlFor={`${kpiCode}-baseMax`} className="block text-xs font-medium text-text-muted">
                    Máximo base
                  </label>
                  <input
                    id={`${kpiCode}-baseMax`}
                    name={`${prefix}baseMax`}
                    type="text"
                    inputMode="decimal"
                    defaultValue={formatNumber(config.baseMax)}
                    required
                    className="mt-1 w-full rounded-control border border-border-strong px-2 py-1 text-sm"
                  />
                  <FieldError message={fieldError("baseMax")} />
                </div>

                {multipliers.map(({ level, value }) => (
                  <MultiplierField
                    key={level}
                    id={`${kpiCode}-multiplier${level}`}
                    name={`${prefix}multiplier${level}`}
                    label={`Multiplicador ${level}`}
                    value={value}
                    error={fieldError(`multiplier${level}`)}
                  />
                ))}

                {parameterDefs.map((parameter) => (
                  <div key={parameter.key} className="w-32">
                    <label htmlFor={`${kpiCode}-${parameter.key}`} className="block text-xs font-medium text-text-muted">
                      {parameter.label}
                    </label>
                    <input
                      id={`${kpiCode}-${parameter.key}`}
                      name={`${prefix}${parameter.key}`}
                      type="text"
                      inputMode="decimal"
                      defaultValue={formatNumber(config.parameters[parameter.key] ?? parameter.defaultValue)}
                      required
                      className="mt-1 w-full rounded-control border border-border-strong px-2 py-1 text-sm"
                    />
                    <FieldError message={fieldError(`parameters.${parameter.key}`)} />
                  </div>
                ))}
              </div>

              {/* Columna de accion: ancho estable, fuera del grupo de campos que envuelve (seccion 20 del encargo). */}
              <div className="shrink-0 lg:w-28 lg:pt-5">
                <SaveKpiButton formAction={formAction} />
              </div>
            </fieldset>
          )}
          {!readOnly && (
            <>
              <FieldError message={fieldError("isActive")} />
              <p className="mt-2 text-xs text-text-muted">Deja un multiplicador vacio para indicar que ese nivel no aplica a este KPI.</p>
              {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
              {state.ok && <SuccessMessage>Configuración guardada.</SuccessMessage>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
