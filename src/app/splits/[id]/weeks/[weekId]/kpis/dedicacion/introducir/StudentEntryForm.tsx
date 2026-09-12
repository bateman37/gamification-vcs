"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveStudentEntriesAction } from "@/server/actions/student.actions";
import {
  initialManualEntryActionState,
  type ManualEntryActionState,
} from "@/server/actions/manual-entry-action-state";
import { ErrorMessage, FieldError } from "@/components/ui";
import { ManualEntrySuccessPanel } from "../../ManualEntrySuccessPanel";
import type { StudentFormView } from "@/server/services/student-entry.service";

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

export function StudentEntryForm({ splitId, weekId, formView }: { splitId: string; weekId: string; formView: StudentFormView }) {
  const saveWithIds = saveStudentEntriesAction.bind(null, splitId, weekId);
  const [state, formAction] = useFormState<ManualEntryActionState, FormData>(saveWithIds, initialManualEntryActionState);

  const introducirHref = `/splits/${splitId}/weeks/${weekId}/kpis/dedicacion/introducir`;
  const comprobarHref = `/splits/${splitId}/weeks/${weekId}/kpis/dedicacion/comprobar`;
  const backHref = `/splits/${splitId}/weeks/${weekId}/kpis`;

  if (state.ok && state.saved) {
    return (
      <ManualEntrySuccessPanel
        message="Datos de Estudiante entusiasta guardados correctamente."
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
              <th className="px-3 py-2 font-medium">Horas dedicadas</th>
            </tr>
          </thead>
          <tbody>
            {formView.rows.map((row) => {
              const errorMessage = fieldErrorMessage(state, row.participantId, "dedicatedHours");
              return (
                <tr key={row.participantId} className="border-b border-border">
                  <td className="px-3 py-2">{row.alias}</td>
                  <td className="px-3 py-2">{row.fullName}</td>
                  <td className="px-3 py-2">{row.level}</td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      name={`dedicatedHours__${row.participantId}`}
                      defaultValue={row.dedicatedHours ?? ""}
                      aria-invalid={errorMessage ? "true" : undefined}
                      className="w-28 rounded-control border border-border-strong px-2 py-1 text-sm"
                    />
                    <FieldError message={errorMessage} />
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
