"use client";

import { KPI_CATALOG_LIST } from "@/domain/kpis/catalog";
import { PROFESSION_BONUS_LABEL } from "@/domain/profession-bonus";
import { FieldError } from "@/components/ui";

/**
 * Campos compartidos por el formulario de creacion y por el de edicion de
 * una profesion (`0.8.0` / MVP-2B). El bonus siempre se muestra de forma
 * explicita y nunca es editable: es una constante del dominio.
 */
export function ProfessionFormFields({
  idPrefix,
  defaults,
  fieldErrors,
}: {
  idPrefix: string;
  defaults?: {
    name: string;
    kpiCodeA: string;
    kpiCodeB: string;
    availableN0: boolean;
    availableN1: boolean;
    availableN2: boolean;
  };
  fieldErrors?: Record<string, string>;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-name`} className="block text-sm font-medium text-ink">
          Nombre de la profesión
        </label>
        <input
          id={`${idPrefix}-name`}
          name="name"
          type="text"
          required
          maxLength={60}
          defaultValue={defaults?.name ?? ""}
          className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
        />
        <FieldError message={fieldErrors?.name} />
      </div>

      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium text-ink">Niveles disponibles</legend>
        <div className="mt-1 flex flex-wrap gap-4 text-sm">
          {(["N0", "N1", "N2"] as const).map((level) => (
            <label key={level} className="flex items-center gap-2">
              <input
                type="checkbox"
                name={`available${level}`}
                defaultChecked={
                  level === "N0" ? defaults?.availableN0 : level === "N1" ? defaults?.availableN1 : defaults?.availableN2
                }
              />
              {level}
            </label>
          ))}
        </div>
        <FieldError message={fieldErrors?.availableN0} />
      </fieldset>

      <div>
        <label htmlFor={`${idPrefix}-kpiCodeA`} className="block text-sm font-medium text-ink">
          Primer KPI potenciado
        </label>
        <select
          id={`${idPrefix}-kpiCodeA`}
          name="kpiCodeA"
          required
          defaultValue={defaults?.kpiCodeA ?? ""}
          className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Selecciona un KPI
          </option>
          {KPI_CATALOG_LIST.map((kpi) => (
            <option key={kpi.code} value={kpi.code}>
              {kpi.name}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors?.kpiCodeA} />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-kpiCodeB`} className="block text-sm font-medium text-ink">
          Segundo KPI potenciado
        </label>
        <select
          id={`${idPrefix}-kpiCodeB`}
          name="kpiCodeB"
          required
          defaultValue={defaults?.kpiCodeB ?? ""}
          className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Selecciona un KPI
          </option>
          {KPI_CATALOG_LIST.map((kpi) => (
            <option key={kpi.code} value={kpi.code}>
              {kpi.name}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors?.kpiCodeB} />
      </div>

      <p className="sm:col-span-2 rounded-md bg-canvas px-3 py-2 text-sm text-text-muted">
        Bonus: <span className="font-medium text-ink">{PROFESSION_BONUS_LABEL}</span>. Es fijo: no se puede editar.
      </p>
    </div>
  );
}
