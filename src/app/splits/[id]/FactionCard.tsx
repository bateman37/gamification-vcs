"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateFactionAction, deleteFactionAction } from "@/server/actions/faction.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage, FieldError, SubmitButton } from "@/components/ui";
import type { FactionWithCounts } from "@/server/services/faction.service";

function SaveFactionButton() {
  const { pending } = useFormStatus();
  return (
    <SubmitButton pending={pending} className="bg-slate-700 hover:bg-slate-600">
      Guardar
    </SubmitButton>
  );
}

function DeleteFactionButton({ disabled, title }: { disabled: boolean; title?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      title={title}
      className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Eliminando..." : "Eliminar"}
    </button>
  );
}

export function FactionCard({
  splitId,
  faction,
  readOnly,
  canDelete,
  deleteDisabledReason,
}: {
  splitId: string;
  faction: FactionWithCounts;
  readOnly: boolean;
  canDelete: boolean;
  deleteDisabledReason?: string;
}) {
  const updateWithIds = updateFactionAction.bind(null, splitId, faction.id);
  const [updateState, updateAction] = useFormState(updateWithIds, initialActionState);
  const deleteWithIds = deleteFactionAction.bind(null, splitId, faction.id);
  const [deleteState, deleteAction] = useFormState(deleteWithIds, initialActionState);

  if (readOnly) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="h-5 w-5 rounded-full border border-slate-300"
            style={{ backgroundColor: faction.color }}
          />
          <span className="font-medium">{faction.name}</span>
        </div>
        <span className="text-sm text-slate-500">{faction.participantCount} participante(s)</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <form action={updateAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
        <div>
          <label htmlFor={`faction-${faction.id}-name`} className="block text-xs font-medium text-slate-600">
            Nombre
          </label>
          <input
            id={`faction-${faction.id}-name`}
            name="name"
            type="text"
            defaultValue={faction.name}
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <FieldError message={updateState.fieldErrors?.name} />
        </div>
        <div>
          <label htmlFor={`faction-${faction.id}-color`} className="block text-xs font-medium text-slate-600">
            Color
          </label>
          <input
            id={`faction-${faction.id}-color`}
            name="color"
            type="color"
            defaultValue={faction.color}
            className="mt-1 h-9 w-full rounded-md border border-slate-300"
          />
          <FieldError message={updateState.fieldErrors?.color} />
        </div>
        <SaveFactionButton />
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm">
        <span className="text-slate-600">
          {faction.participantCount} participante{faction.participantCount === 1 ? "" : "s"} asignado
          {faction.participantCount === 1 ? "" : "s"}
        </span>
        <form action={deleteAction}>
          <DeleteFactionButton disabled={!canDelete} title={!canDelete ? deleteDisabledReason : undefined} />
        </form>
      </div>
      {!updateState.ok && updateState.error && <ErrorMessage>{updateState.error}</ErrorMessage>}
      {!deleteState.ok && deleteState.error && <ErrorMessage>{deleteState.error}</ErrorMessage>}
    </div>
  );
}
