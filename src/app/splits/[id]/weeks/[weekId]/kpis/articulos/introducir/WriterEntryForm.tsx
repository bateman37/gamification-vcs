"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { saveWriterEntriesAction } from "@/server/actions/writer.actions";
import {
  initialManualEntryActionState,
  type ManualEntryActionState,
} from "@/server/actions/manual-entry-action-state";
import { ErrorMessage, FieldError, SuccessMessage } from "@/components/ui";
import type { WriterFormView } from "@/server/services/writer-entry.service";

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

export function WriterEntryForm({ splitId, weekId, formView }: { splitId: string; weekId: string; formView: WriterFormView }) {
  const saveWithIds = saveWriterEntriesAction.bind(null, splitId, weekId);
  const [state, formAction] = useFormState<ManualEntryActionState, FormData>(saveWithIds, initialManualEntryActionState);

  const introducirHref = `/splits/${splitId}/weeks/${weekId}/kpis/articulos/introducir`;
  const comprobarHref = `/splits/${splitId}/weeks/${weekId}/kpis/articulos/comprobar`;
  const backHref = `/splits/${splitId}/weeks/${weekId}/kpis`;

  if (state.ok && state.saved) {
    return (
      <div className="space-y-3">
        <SuccessMessage>Datos de Redactor estrella guardados correctamente.</SuccessMessage>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href={comprobarHref} className="underline hover:text-slate-900">
            Ir a Comprobar
          </Link>
          <Link href={introducirHref} className="underline hover:text-slate-900">
            Volver a introducir datos
          </Link>
          <Link href={backHref} className="underline hover:text-slate-900">
            Volver a las cargas de la semana
          </Link>
        </div>
      </div>
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
              <th className="px-3 py-2 font-medium">Articulos entregados</th>
              <th className="px-3 py-2 font-medium">Articulos no entregados</th>
              <th className="px-3 py-2 font-medium">Articulos propuestos</th>
            </tr>
          </thead>
          <tbody>
            {formView.rows.map((row) => {
              const deliveredError = fieldErrorMessage(state, row.participantId, "deliveredArticles");
              const undeliveredError = fieldErrorMessage(state, row.participantId, "undeliveredArticles");
              const proposedError = fieldErrorMessage(state, row.participantId, "proposedArticles");
              return (
                <tr key={row.participantId} className="border-b border-slate-100">
                  <td className="px-3 py-2">{row.alias}</td>
                  <td className="px-3 py-2">{row.fullName}</td>
                  <td className="px-3 py-2">{row.level}</td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      name={`deliveredArticles__${row.participantId}`}
                      defaultValue={row.deliveredArticles ?? ""}
                      aria-invalid={deliveredError ? "true" : undefined}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                    <FieldError message={deliveredError} />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      name={`undeliveredArticles__${row.participantId}`}
                      defaultValue={row.undeliveredArticles ?? ""}
                      aria-invalid={undeliveredError ? "true" : undefined}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                    <FieldError message={undeliveredError} />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      name={`proposedArticles__${row.participantId}`}
                      defaultValue={row.proposedArticles ?? ""}
                      aria-invalid={proposedError ? "true" : undefined}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                    <FieldError message={proposedError} />
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
