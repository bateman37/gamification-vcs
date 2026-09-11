"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateOwnAliasAction } from "@/server/actions/profile.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage, FieldError, SubmitButton, SuccessMessage } from "@/components/ui";

function SaveAliasButton() {
  const { pending } = useFormStatus();
  return (
    <SubmitButton pending={pending} className="bg-slate-700 hover:bg-slate-600">
      Guardar alias
    </SubmitButton>
  );
}

/** Edicion del alias propio dentro de un split (`0.8.0` / MVP-2B). */
export function ProfileAliasForm({ splitParticipantId, alias }: { splitParticipantId: string; alias: string }) {
  const updateWithId = updateOwnAliasAction.bind(null, splitParticipantId);
  const [state, formAction] = useFormState(updateWithId, initialActionState);

  return (
    <form action={formAction} className="space-y-2">
      <label htmlFor={`alias-${splitParticipantId}`} className="block text-xs font-medium text-slate-600">
        Alias en este split
      </label>
      <div className="flex flex-wrap items-start gap-2">
        <input
          id={`alias-${splitParticipantId}`}
          name="alias"
          type="text"
          required
          maxLength={100}
          defaultValue={alias}
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <SaveAliasButton />
      </div>
      <FieldError message={state.fieldErrors?.alias} />
      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {state.ok && <SuccessMessage>Alias actualizado.</SuccessMessage>}
    </form>
  );
}
