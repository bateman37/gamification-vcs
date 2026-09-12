"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveApprenticeEntriesAction } from "@/server/actions/apprentice.actions";
import {
  initialManualEntryActionState,
  type ManualEntryActionState,
} from "@/server/actions/manual-entry-action-state";
import { ErrorMessage, FieldError } from "@/components/ui";
import { ManualEntrySuccessPanel } from "../../ManualEntrySuccessPanel";
import type { ApprenticeFormView } from "@/server/services/apprentice-entry.service";

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

export function ApprenticeEntryForm({
  splitId,
  weekId,
  formView,
}: {
  splitId: string;
  weekId: string;
  formView: ApprenticeFormView;
}) {
  const saveWithIds = saveApprenticeEntriesAction.bind(null, splitId, weekId);
  const [state, formAction] = useFormState<ManualEntryActionState, FormData>(saveWithIds, initialManualEntryActionState);

  const introducirHref = `/splits/${splitId}/weeks/${weekId}/kpis/formaciones/introducir`;
  const comprobarHref = `/splits/${splitId}/weeks/${weekId}/kpis/formaciones/comprobar`;
  const backHref = `/splits/${splitId}/weeks/${weekId}/kpis`;

  if (state.ok && state.saved) {
    return (
      <ManualEntrySuccessPanel
        message="Datos de Aprendiz experto guardados correctamente."
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
      <p className="text-sm text-text-muted">
        Máximo configurado: <strong>{formView.targetValue}</strong>
      </p>

      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Alias</th>
              <th className="px-3 py-2 font-medium">Nombre real</th>
              <th className="px-3 py-2 font-medium">Nivel</th>
              <th className="px-3 py-2 font-medium">Formaciones completadas</th>
            </tr>
          </thead>
          <tbody>
            {formView.rows.map((row) => {
              const errorMessage = fieldErrorMessage(state, row.participantId, "completedTrainings");
              return (
                <tr key={row.participantId} className="border-b border-border">
                  <td className="px-3 py-2">{row.alias}</td>
                  <td className="px-3 py-2">{row.fullName}</td>
                  <td className="px-3 py-2">{row.level}</td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      name={`completedTrainings__${row.participantId}`}
                      defaultValue={row.completedTrainings ?? ""}
                      max={formView.targetValue}
                      aria-invalid={errorMessage ? "true" : undefined}
                      className="w-20 rounded-control border border-border-strong px-2 py-1 text-sm"
                    />
                    <FieldError message={errorMessage} />
                    {!errorMessage && row.exceedsTarget && (
                      <p className="mt-1 text-xs text-reward-ink">
                        Este valor supera el máximo actual ({formView.targetValue}); introduce un valor válido antes de guardar.
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SaveButton label={formView.hasExistingData ? "Actualizar datos" : "Guardar datos"} />
    </form>
  );
}
