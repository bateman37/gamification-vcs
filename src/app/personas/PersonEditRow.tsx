"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { updatePersonAction } from "@/server/actions/person.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage, FieldError, SubmitButton } from "@/components/ui";
import type { PersonWithParticipationCount } from "@/server/services/person.service";
import type { PersonWithAccount } from "@/server/services/auth.service";
import { PersonAccountCell } from "./PersonAccountCell";

function SaveButton() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending}>Guardar</SubmitButton>;
}

export function PersonEditRow({
  person,
  account,
}: {
  person: PersonWithParticipationCount;
  account: PersonWithAccount["account"];
}) {
  const [editing, setEditing] = useState(false);
  const updateWithId = updatePersonAction.bind(null, person.id);
  const [state, formAction] = useFormState(updateWithId, initialActionState);

  if (!editing) {
    return (
      <tr className="border-b border-border">
        <td className="px-3 py-2">{person.fullName}</td>
        <td className="px-3 py-2 text-text-muted">{person.email ?? "-"}</td>
        <td className="px-3 py-2 text-center">{person.participationCount}</td>
        <td className="px-3 py-2">
          <PersonAccountCell personId={person.id} account={account} />
        </td>
        <td className="px-3 py-2 text-right">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-ink underline hover:text-ink"
          >
            Editar
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border bg-canvas">
      <td colSpan={5} className="px-3 py-3">
        <form action={formAction} className="flex flex-wrap items-start gap-3">
          <div>
            <label className="block text-xs font-medium text-text-muted">Nombre completo</label>
            <input
              name="fullName"
              defaultValue={person.fullName}
              required
              className="mt-1 rounded-control border border-border-strong px-2 py-1 text-sm"
            />
            <FieldError message={state.fieldErrors?.fullName} />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted">Correo</label>
            <input
              name="email"
              type="email"
              defaultValue={person.email ?? ""}
              className="mt-1 rounded-control border border-border-strong px-2 py-1 text-sm"
            />
            <FieldError message={state.fieldErrors?.email} />
          </div>
          <div className="flex gap-2 pt-5">
            <SaveButton />
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-control border border-border-strong px-3 py-2 text-sm"
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
