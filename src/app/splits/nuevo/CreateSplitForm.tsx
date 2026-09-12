"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createSplitAction } from "@/server/actions/split.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage, FieldError, SubmitButton } from "@/components/ui";
import { MAX_SPLIT_WEEKS, MIN_SPLIT_WEEKS } from "@/server/validation/split";

function SubmitCreateSplitButton() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending}>Guardar borrador</SubmitButton>;
}

export function CreateSplitForm() {
  const [state, formAction] = useFormState(createSplitAction, initialActionState);

  return (
    <form action={formAction} className="max-w-lg space-y-4 rounded-card border border-border bg-surface p-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-ink">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
        />
        <FieldError message={state.fieldErrors?.name} />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-ink">
          Descripcion (opcional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
        />
        <FieldError message={state.fieldErrors?.description} />
      </div>
      <div>
        <label htmlFor="startDate" className="block text-sm font-medium text-ink">
          Lunes de inicio
        </label>
        <input
          id="startDate"
          name="startDate"
          type="date"
          required
          className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-text-muted">Debe ser un lunes.</p>
        <FieldError message={state.fieldErrors?.startDate} />
      </div>
      <div>
        <label htmlFor="numberOfWeeks" className="block text-sm font-medium text-ink">
          Numero de semanas
        </label>
        <input
          id="numberOfWeeks"
          name="numberOfWeeks"
          type="number"
          min={MIN_SPLIT_WEEKS}
          max={MAX_SPLIT_WEEKS}
          required
          className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
        />
        <FieldError message={state.fieldErrors?.numberOfWeeks} />
      </div>
      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      <SubmitCreateSplitButton />
    </form>
  );
}
