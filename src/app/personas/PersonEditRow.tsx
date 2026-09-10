"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { updatePersonAction } from "@/server/actions/person.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage, FieldError, SubmitButton } from "@/components/ui";
import type { PersonWithParticipationCount } from "@/server/services/person.service";

function SaveButton() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending}>Guardar</SubmitButton>;
}

export function PersonEditRow({ person }: { person: PersonWithParticipationCount }) {
  const [editing, setEditing] = useState(false);
  const updateWithId = updatePersonAction.bind(null, person.id);
  const [state, formAction] = useFormState(updateWithId, initialActionState);

  if (!editing) {
    return (
      <tr className="border-b border-slate-100">
        <td className="px-3 py-2">{person.fullName}</td>
        <td className="px-3 py-2 text-slate-500">{person.email ?? "-"}</td>
        <td className="px-3 py-2 text-center">{person.participationCount}</td>
        <td className="px-3 py-2 text-right">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-slate-700 underline hover:text-slate-900"
          >
            Editar
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-100 bg-slate-50">
      <td colSpan={4} className="px-3 py-3">
        <form action={formAction} className="flex flex-wrap items-start gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">Nombre completo</label>
            <input
              name="fullName"
              defaultValue={person.fullName}
              required
              className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
            <FieldError message={state.fieldErrors?.fullName} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Correo</label>
            <input
              name="email"
              type="email"
              defaultValue={person.email ?? ""}
              className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
            <FieldError message={state.fieldErrors?.email} />
          </div>
          <div className="flex gap-2 pt-5">
            <SaveButton />
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
          {!state.ok && state.error && (
            <div className="w-full">
              <ErrorMessage>{state.error}</ErrorMessage>
            </div>
          )}
        </form>
      </td>
    </tr>
  );
}
