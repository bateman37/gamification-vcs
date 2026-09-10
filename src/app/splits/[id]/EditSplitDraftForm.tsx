"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateSplitDraftAction } from "@/server/actions/split.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage, FieldError, SubmitButton, SuccessMessage } from "@/components/ui";
import { MAX_SPLIT_WEEKS, MIN_SPLIT_WEEKS } from "@/server/validation/split";
import { formatCalendarDate } from "@/lib/dates";
import type { Split } from "@prisma/client";

function SaveDraftButton() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending}>Guardar cambios</SubmitButton>;
}

export function EditSplitDraftForm({ split }: { split: Split }) {
  const updateWithId = updateSplitDraftAction.bind(null, split.id);
  const [state, formAction] = useFormState(updateWithId, initialActionState);

  return (
    <form action={formAction} className="max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold">Editar borrador</h2>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={split.name}
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <FieldError message={state.fieldErrors?.name} />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-700">
          Descripcion (opcional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={split.description ?? ""}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="startDate" className="block text-sm font-medium text-slate-700">
          Lunes de inicio
        </label>
        <input
          id="startDate"
          name="startDate"
          type="date"
          defaultValue={formatCalendarDate(split.startDate)}
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <FieldError message={state.fieldErrors?.startDate} />
      </div>
      <div>
        <label htmlFor="numberOfWeeks" className="block text-sm font-medium text-slate-700">
          Numero de semanas
        </label>
        <input
          id="numberOfWeeks"
          name="numberOfWeeks"
          type="number"
          min={MIN_SPLIT_WEEKS}
          max={MAX_SPLIT_WEEKS}
          defaultValue={split.numberOfWeeks}
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <FieldError message={state.fieldErrors?.numberOfWeeks} />
      </div>
      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {state.ok && <SuccessMessage>Cambios guardados.</SuccessMessage>}
      <SaveDraftButton />
    </form>
  );
}
