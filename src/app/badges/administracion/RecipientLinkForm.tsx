"use client";

import { useFormState, useFormStatus } from "react-dom";
import { relinkBadgeRecipientAction } from "@/server/actions/badge.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage } from "@/components/ui";

function AutoSubmitSelect({
  persons,
  selectedPersonId,
}: {
  persons: { id: string; fullName: string }[];
  selectedPersonId: string | null;
}) {
  const { pending } = useFormStatus();
  return (
    <select
      name="personId"
      defaultValue={selectedPersonId ?? ""}
      disabled={pending}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className="w-full max-w-xs rounded-control border border-border-strong px-2 py-1.5 text-sm disabled:opacity-60"
    >
      <option value="">Pendiente de vincular</option>
      {persons.map((person) => (
        <option key={person.id} value={person.id}>
          {person.fullName}
        </option>
      ))}
    </select>
  );
}

/** Vincula, corrige o desvincula un destinatario historico concreto (seccion 3.3 del encargo). */
export function RecipientLinkForm({
  recipientId,
  persons,
  selectedPersonId,
}: {
  recipientId: string;
  persons: { id: string; fullName: string }[];
  selectedPersonId: string | null;
}) {
  const action = relinkBadgeRecipientAction.bind(null, recipientId);
  const [state, formAction] = useFormState(action, initialActionState);

  return (
    <form action={formAction} className="space-y-1">
      <AutoSubmitSelect persons={persons} selectedPersonId={selectedPersonId} />
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    </form>
  );
}
