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
  return <SubmitButton pending={pending}>Guardar localización</SubmitButton>;
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-control border border-danger/30 px-4 py-2 text-sm font-medium text-danger-ink hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Eliminando..." : "Eliminar localización"}
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
      <p className="rounded-card border border-dashed border-border-strong px-4 py-6 text-center text-sm text-text-muted">
        Este split no tiene ningun KPI activo. Activa al menos uno en &quot;KPI del split&quot; antes de preparar una
        localización.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="max-w-lg space-y-4 rounded-card border border-border bg-surface p-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-ink">
            Nombre de la localización
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
          />
          <FieldError message={state.fieldErrors?.name} />
        </div>

        <div>
          <label htmlFor="kpiCode" className="block text-sm font-medium text-ink">
            KPI potenciado
          </label>
          <select
            id="kpiCode"
            name="kpiCode"
            value={kpiCode}
            onChange={(event) => setKpiCode(event.target.value as KpiCode)}
            className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
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
          <label htmlFor="bonusPercent" className="block text-sm font-medium text-ink">
            Bonus
          </label>
          <select
            id="bonusPercent"
            name="bonusPercent"
            value={bonusPercent}
            onChange={(event) => setBonusPercent(Number(event.target.value))}
            className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
          >
            {LOCATION_BONUS_PERCENTS.map((percent) => (
              <option key={percent} value={percent}>
                {percent} %
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.bonusPercent} />
        </div>

        <div className="rounded-md bg-canvas p-3 text-sm text-ink">
          <p className="font-medium">{name.trim() || "(sin nombre todavía)"}</p>
          <p>
            Semana: {formatCalendarDateEs(weekStartDate)} — {formatCalendarDateEs(weekEndDate)}
          </p>
          <p>Potencia: {kpiName ?? "(selecciona un KPI)"}</p>
          <p>
            Bonus para todos los participantes: {locationBonusLabel(bonusPercent)}
          </p>
        </div>

        {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
        {state.ok && <SuccessMessage>Localización guardada correctamente.</SuccessMessage>}
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
