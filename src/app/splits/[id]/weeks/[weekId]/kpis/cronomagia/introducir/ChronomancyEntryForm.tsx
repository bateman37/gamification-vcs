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
      className="rounded-control bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Guardando..." : label}
    </button>
  );
}

function fieldErrorMessage(state: ManualEntryActionState, participantId: string, field: string): string | undefined {
  return state.fieldErrors?.find((error) => error.participantId === participantId && error.field === field)?.message;
}

/**
 * Convierte texto con coma o punto decimal en numero, para el occupancy en
 * vivo (calculo de ayuda, no autoritativo). Un campo vacio se interpreta
 * como `0`, igual que el servidor al guardar (bugfix `0.6.0` / MVP-1C).
 */
function parseHours(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return 0;
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
  if (total === 0) occupancyText = "Ausencia · 0 %";
  else if (row.productiveHoursApplicable && productive !== null && total !== null && total > 0) {
    occupancyText = `${formatPoints(Math.min(productive / total, 1) * 100)} %`;
  } else if (!row.productiveHoursApplicable) {
    occupancyText = "No aplica";
  }

  return (
    <tr className="border-b border-border">
      <td className="px-3 py-2">{row.alias}</td>
      <td className="px-3 py-2">{row.fullName}</td>
      <td className="px-3 py-2">{row.level}</td>
      <td className="px-3 py-2">
        {row.productiveHoursApplicable ? (
          <>
            <input
              type="text"
              inputMode="decimal"
              name={`productiveHours__${row.participantId}`}
              value={productiveHours}
              onChange={(event) => setProductiveHours(event.target.value)}
              aria-invalid={productiveError ? "true" : undefined}
              className="w-24 rounded-control border border-border-strong px-2 py-1 text-sm"
            />
            <FieldError message={productiveError} />
          </>
        ) : (
          <span className="text-sm text-text-muted">No aplica</span>
        )}
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          inputMode="decimal"
          name={`totalHours__${row.participantId}`}
          value={totalHours}
          onChange={(event) => setTotalHours(event.target.value)}
          aria-invalid={totalError ? "true" : undefined}
          className="w-24 rounded-control border border-border-strong px-2 py-1 text-sm"
        />
        <FieldError message={totalError} />
      </td>
      <td className="px-3 py-2 text-text-muted">{occupancyText}</td>
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
      <p className="rounded-card border border-dashed border-border-strong px-4 py-6 text-center text-sm text-text-muted">
        No hay participantes aplicables en esta semana.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-card border border-border bg-surface p-4">
      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-text-muted">
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
