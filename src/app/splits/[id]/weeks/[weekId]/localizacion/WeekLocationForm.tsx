"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { upsertWeekLocationAction, deleteWeekLocationAction } from "@/server/actions/location.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage, FieldError, SubmitButton, SuccessMessage } from "@/components/ui";
import { LOCATION_BONUS_PERCENTS, locationBonusLabel } from "@/domain/location-bonus";
import { formatCalendarDateEs } from "@/lib/dates";
import type { KpiCode } from "@/domain/kpis/catalog";

function SaveButton() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending}>Guardar localizacion</SubmitButton>;
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Eliminando..." : "Eliminar localizacion"}
    </button>
  );
}

export function WeekLocationForm({
  splitId,
  weekId,
  weekStartDate,
  weekEndDate,
  activeKpis,
  initialLocation,
}: {
  splitId: string;
  weekId: string;
  weekStartDate: Date;
  weekEndDate: Date;
  activeKpis: { code: KpiCode; name: string }[];
  initialLocation: { name: string; kpiCode: KpiCode; bonusPercent: number } | null;
}) {
  const upsertWithIds = upsertWeekLocationAction.bind(null, splitId, weekId);
  const deleteWithIds = deleteWeekLocationAction.bind(null, splitId, weekId);
  const [state, formAction] = useFormState(upsertWithIds, initialActionState);
  const [deleteState, deleteAction] = useFormState(deleteWithIds, initialActionState);

  const [name, setName] = useState(initialLocation?.name ?? "");
  const [kpiCode, setKpiCode] = useState<KpiCode | "">(initialLocation?.kpiCode ?? activeKpis[0]?.code ?? "");
  const [bonusPercent, setBonusPercent] = useState<number>(initialLocation?.bonusPercent ?? LOCATION_BONUS_PERCENTS[0]);

  const kpiName = activeKpis.find((kpi) => kpi.code === kpiCode)?.name ?? null;

  if (activeKpis.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
        Este split no tiene ningun KPI activo. Activa al menos uno en &quot;KPI del split&quot; antes de preparar una
        localizacion.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700">
            Nombre de la localizacion
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <FieldError message={state.fieldErrors?.name} />
        </div>

        <div>
          <label htmlFor="kpiCode" className="block text-sm font-medium text-slate-700">
            KPI potenciado
          </label>
          <select
            id="kpiCode"
            name="kpiCode"
            value={kpiCode}
            onChange={(event) => setKpiCode(event.target.value as KpiCode)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {activeKpis.map((kpi) => (
              <option key={kpi.code} value={kpi.code}>
                {kpi.name}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.kpiCode} />
        </div>

        <div>
          <label htmlFor="bonusPercent" className="block text-sm font-medium text-slate-700">
            Bonus
          </label>
          <select
            id="bonusPercent"
            name="bonusPercent"
            value={bonusPercent}
            onChange={(event) => setBonusPercent(Number(event.target.value))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {LOCATION_BONUS_PERCENTS.map((percent) => (
              <option key={percent} value={percent}>
                {percent} %
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.bonusPercent} />
        </div>

        <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-medium">{name.trim() || "(sin nombre todavia)"}</p>
          <p>
            Semana: {formatCalendarDateEs(weekStartDate)} — {formatCalendarDateEs(weekEndDate)}
          </p>
          <p>Potencia: {kpiName ?? "(selecciona un KPI)"}</p>
          <p>
            Bonus para todos los participantes: {locationBonusLabel(bonusPercent)}
          </p>
        </div>

        {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
        {state.ok && <SuccessMessage>Localizacion guardada correctamente.</SuccessMessage>}
        <SaveButton />
      </form>

      {initialLocation && (
        <form action={deleteAction}>
          <DeleteButton />
          {!deleteState.ok && deleteState.error && (
            <div className="mt-2">
              <ErrorMessage>{deleteState.error}</ErrorMessage>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
