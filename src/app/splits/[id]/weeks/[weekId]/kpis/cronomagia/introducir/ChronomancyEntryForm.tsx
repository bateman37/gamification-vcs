"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveChronomancyEntriesAction } from "@/server/actions/chronomancy.actions";
import {
  initialManualEntryActionState,
  type ManualEntryActionState,
} from "@/server/actions/manual-entry-action-state";
import { ErrorMessage, FieldError } from "@/components/ui";
import { ManualEntrySuccessPanel } from "../../ManualEntrySuccessPanel";
import { formatPoints } from "@/lib/format";
import type { ChronomancyFormRow, ChronomancyFormView } from "@/server/services/chronomancy-entry.service";

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Guardando..." : label}
    </button>
  );
}

function fieldErrorMessage(state: ManualEntryActionState, participantId: string, field: string): string | undefined {
  return state.fieldErrors?.find((error) => error.participantId === participantId && error.field === field)?.message;
}

/** Convierte texto con coma o punto decimal en numero, para el occupancy en vivo (calculo de ayuda, no autoritativo). */
function parseHours(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function ChronomancyRow({
  row,
  productiveError,
  totalError,
}: {
  row: ChronomancyFormRow;
  productiveError: string | undefined;
  totalError: string | undefined;
}) {
  const [productiveHours, setProductiveHours] = useState(row.productiveHours?.toString() ?? "");
  const [totalHours, setTotalHours] = useState(row.totalHours?.toString() ?? "");

  const productive = parseHours(productiveHours);
  const total = parseHours(totalHours);
  let occupancyText = "-";
  if (total === 0) occupancyText = "VAC";
  else if (productive !== null && total !== null && total > 0) {
    occupancyText = `${formatPoints(Math.min(productive / total, 1) * 100)} %`;
  }

  return (
    <tr className="border-b border-slate-100">
      <td className="px-3 py-2">{row.alias}</td>
      <td className="px-3 py-2">{row.fullName}</td>
      <td className="px-3 py-2">{row.level}</td>
      <td className="px-3 py-2">
        <input
          type="text"
          inputMode="decimal"
          name={`productiveHours__${row.participantId}`}
          value={productiveHours}
          onChange={(event) => setProductiveHours(event.target.value)}
          aria-invalid={productiveError ? "true" : undefined}
          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
        <FieldError message={productiveError} />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          inputMode="decimal"
          name={`totalHours__${row.participantId}`}
          value={totalHours}
          onChange={(event) => setTotalHours(event.target.value)}
          aria-invalid={totalError ? "true" : undefined}
          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
        <FieldError message={totalError} />
      </td>
      <td className="px-3 py-2 text-slate-600">{occupancyText}</td>
    </tr>
  );
}

export function ChronomancyEntryForm({
  splitId,
  weekId,
  formView,
}: {
  splitId: string;
  weekId: string;
  formView: ChronomancyFormView;
}) {
  const saveWithIds = saveChronomancyEntriesAction.bind(null, splitId, weekId);
  const [state, formAction] = useFormState<ManualEntryActionState, FormData>(saveWithIds, initialManualEntryActionState);

  const introducirHref = `/splits/${splitId}/weeks/${weekId}/kpis/cronomagia/introducir`;
  const comprobarHref = `/splits/${splitId}/weeks/${weekId}/kpis/cronomagia/comprobar`;
  const backHref = `/splits/${splitId}/weeks/${weekId}/kpis`;

  if (state.ok && state.saved) {
    return (
      <ManualEntrySuccessPanel
        message="Datos de Cronomagia laboral guardados correctamente."
        introducirHref={introducirHref}
        comprobarHref={comprobarHref}
        backHref={backHref}
      />
    );
  }

  if (formView.rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
        No hay participantes aplicables en esta semana.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-100 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Alias</th>
              <th className="px-3 py-2 font-medium">Nombre real</th>
              <th className="px-3 py-2 font-medium">Nivel</th>
              <th className="px-3 py-2 font-medium">Horas productivas</th>
              <th className="px-3 py-2 font-medium">Horas totales de la semana</th>
              <th className="px-3 py-2 font-medium">Occupancy</th>
            </tr>
          </thead>
          <tbody>
            {formView.rows.map((row) => (
              <ChronomancyRow
                key={row.participantId}
                row={row}
                productiveError={fieldErrorMessage(state, row.participantId, "productiveHours")}
                totalError={fieldErrorMessage(state, row.participantId, "totalHours")}
              />
            ))}
          </tbody>
        </table>
      </div>

      <SaveButton label={formView.hasExistingData ? "Actualizar datos" : "Guardar datos"} />
    </form>
  );
}
