"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { KpiCode } from "@prisma/client";
import { updateKpiConfigAction } from "@/server/actions/kpi.actions";
import { initialActionState } from "@/server/actions/action-result";
import { Badge, ErrorMessage, FieldError, SubmitButton, SuccessMessage } from "@/components/ui";
import type { KpiConfigView } from "@/domain/kpis/mapping";
import type { KpiParameterDefinition } from "@/domain/kpis/catalog";

function SaveKpiButton() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending}>Guardar</SubmitButton>;
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
  disabled,
}: {
  id: string;
  name: string;
  label: string;
  value: number | null;
  error?: string;
  disabled: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-600">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        defaultValue={value === null ? "" : formatNumber(value)}
        placeholder="No aplica"
        disabled={disabled}
        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
      />
      <FieldError message={error} />
    </div>
  );
}

export function KpiConfigCard({
  splitId,
  kpiCode,
  name,
  description,
  calculationExplanation,
  parameterDefs,
  config,
  readOnly,
}: {
  splitId: string;
  kpiCode: KpiCode;
  name: string;
  description: string;
  calculationExplanation: string;
  parameterDefs: KpiParameterDefinition[];
  config: KpiConfigView;
  readOnly: boolean;
}) {
  const updateWithIds = updateKpiConfigAction.bind(null, splitId, kpiCode);
  const [state, formAction] = useFormState(updateWithIds, initialActionState);

  const multipliers: Array<{ level: "N0" | "N1" | "N2"; value: number | null; error?: string }> = [
    { level: "N0", value: config.multiplierN0, error: state.fieldErrors?.multiplierN0 },
    { level: "N1", value: config.multiplierN1, error: state.fieldErrors?.multiplierN1 },
    { level: "N2", value: config.multiplierN2, error: state.fieldErrors?.multiplierN2 },
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{name}</h3>
            <Badge tone={config.isActive ? "green" : "slate"}>
              {config.isActive ? "Activo" : "Inactivo"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
          <p className="mt-1 text-xs text-slate-500">{calculationExplanation}</p>
        </div>
      </div>

      {readOnly ? (
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs font-medium text-slate-500">Maximo base</dt>
            <dd>{formatNumber(config.baseMax)}</dd>
          </div>
          {multipliers.map(({ level, value }) => (
            <div key={level}>
              <dt className="text-xs font-medium text-slate-500">Multiplicador {level}</dt>
              <dd>{value === null ? "No aplica" : formatNumber(value)}</dd>
            </div>
          ))}
          {parameterDefs.map((parameter) => (
            <div key={parameter.key}>
              <dt className="text-xs font-medium text-slate-500">{parameter.label}</dt>
              <dd>{formatNumber(config.parameters[parameter.key] ?? parameter.defaultValue)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <form action={formAction} className="mt-4 space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" name="isActive" defaultChecked={config.isActive} className="h-4 w-4" />
            KPI activo en este split
          </label>
          <FieldError message={state.fieldErrors?.isActive} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label htmlFor={`${kpiCode}-baseMax`} className="block text-xs font-medium text-slate-600">
                Maximo base
              </label>
              <input
                id={`${kpiCode}-baseMax`}
                name="baseMax"
                type="text"
                inputMode="decimal"
                defaultValue={formatNumber(config.baseMax)}
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
              <FieldError message={state.fieldErrors?.baseMax} />
            </div>

            {multipliers.map(({ level, value, error }) => (
              <MultiplierField
                key={level}
                id={`${kpiCode}-multiplier${level}`}
                name={`multiplier${level}`}
                label={`Multiplicador ${level}`}
                value={value}
                error={error}
                disabled={false}
              />
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Deja un multiplicador vacio para indicar que ese nivel no aplica a este KPI.
          </p>

          {parameterDefs.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-slate-500">Parametros del calculo</h4>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {parameterDefs.map((parameter) => (
                  <div key={parameter.key}>
                    <label
                      htmlFor={`${kpiCode}-${parameter.key}`}
                      className="block text-xs font-medium text-slate-600"
                    >
                      {parameter.label}
                    </label>
                    <input
                      id={`${kpiCode}-${parameter.key}`}
                      name={parameter.key}
                      type="text"
                      inputMode="decimal"
                      defaultValue={formatNumber(config.parameters[parameter.key] ?? parameter.defaultValue)}
                      required
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                    <FieldError message={state.fieldErrors?.[`parameters.${parameter.key}`]} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
          {state.ok && <SuccessMessage>Configuracion guardada.</SuccessMessage>}
          <SaveKpiButton />
        </form>
      )}
    </div>
  );
}
