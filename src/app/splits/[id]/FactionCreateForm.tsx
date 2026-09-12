"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createFactionAction } from "@/server/actions/faction.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage, FieldError, SubmitButton, SuccessMessage } from "@/components/ui";

function CreateFactionButton() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending}>Crear facción</SubmitButton>;
}

export function FactionCreateForm({ splitId }: { splitId: string }) {
  const createWithId = createFactionAction.bind(null, splitId);
  const [state, formAction] = useFormState(createWithId, initialActionState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 rounded-card border border-dashed border-border-strong bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
      <div>
        <label htmlFor="faction-new-name" className="block text-sm font-medium text-ink">
          Nombre de la nueva facción
        </label>
        <input
          id="faction-new-name"
          name="name"
          type="text"
          required
          className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
        />
        <FieldError message={state.fieldErrors?.name} />
      </div>
      <div>
        <label htmlFor="faction-new-color" className="block text-sm font-medium text-ink">
          Color
        </label>
        <input
          id="faction-new-color"
          name="color"
          type="color"
          defaultValue="#1d4ed8"
          className="mt-1 h-10 w-full rounded-control border border-border-strong"
        />
        <FieldError message={state.fieldErrors?.color} />
      </div>
      <div>
        <CreateFactionButton />
      </div>
      {!state.ok && state.error && (
        <div className="sm:col-span-3">
          <ErrorMessage>{state.error}</ErrorMessage>
        </div>
      )}
      {state.ok && (
        <div className="sm:col-span-3">
          <SuccessMessage>Facción creada correctamente.</SuccessMessage>
        </div>
      )}
    </form>
  );
}
