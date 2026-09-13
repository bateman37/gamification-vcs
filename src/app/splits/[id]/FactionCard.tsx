"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  updateFactionAction,
  deleteFactionAction,
  saveFactionImageAction,
  deleteFactionImageAction,
} from "@/server/actions/faction.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage, FieldError, SubmitButton, SuccessMessage } from "@/components/ui";
import { FactionImage } from "@/components/FactionImage";
import { FACTION_IMAGE_ACCEPT_ATTRIBUTE, FACTION_IMAGE_FIELD } from "@/domain/faction-image-constraints";
import type { FactionWithCounts } from "@/server/services/faction.service";

function SaveFactionButton() {
  const { pending } = useFormStatus();
  return (
    <SubmitButton pending={pending} className="bg-ink/90 hover:bg-ink/80">
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
      className="rounded-control border border-danger/30 px-3 py-2 text-sm font-medium text-danger-ink hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Eliminando..." : "Eliminar"}
    </button>
  );
}

function FactionImageManager({ splitId, faction }: { splitId: string; faction: FactionWithCounts }) {
  const [saveState, saveAction] = useFormState(saveFactionImageAction.bind(null, splitId, faction.id), initialActionState);
  const [deleteState, deleteAction] = useFormState(deleteFactionImageAction.bind(null, splitId, faction.id), initialActionState);

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <FactionImage
          splitId={splitId}
          factionId={faction.id}
          imageVersion={faction.imageVersion}
          factionName={faction.name}
          color={faction.color}
          size="lg"
          decorative
        />
        <div className="min-w-[12rem] flex-1 space-y-1">
          <form action={saveAction} className="space-y-1">
            <label htmlFor={`faction-${faction.id}-image`} className="block text-xs font-medium text-text-muted">
              Emblema de la facción (opcional)
            </label>
            <input
              id={`faction-${faction.id}-image`}
              type="file"
              name={FACTION_IMAGE_FIELD}
              accept={FACTION_IMAGE_ACCEPT_ATTRIBUTE}
              className="block w-full text-xs"
            />
            <SubmitButton pending={false} className="px-3 py-1 text-xs">
              {faction.imageVersion ? "Cambiar imagen" : "Subir imagen"}
            </SubmitButton>
            <FieldError message={saveState.fieldErrors?.[FACTION_IMAGE_FIELD]} />
          </form>
          {faction.imageVersion && (
            <form action={deleteAction}>
              <button type="submit" className="text-xs font-medium text-danger-ink hover:underline">
                Eliminar imagen
              </button>
            </form>
          )}
        </div>
      </div>
      <p className="text-xs text-text-muted">
        JPEG, PNG o WebP, hasta 5 MB. Se procesa en el servidor a WebP (máximo 512 px) y no se
        congela en snapshots históricos: cambiarla no altera clasificaciones ni noticias pasadas.
      </p>
      {!saveState.ok && saveState.error && <ErrorMessage>{saveState.error}</ErrorMessage>}
      {saveState.ok && <SuccessMessage>Imagen guardada correctamente.</SuccessMessage>}
      {!deleteState.ok && deleteState.error && <ErrorMessage>{deleteState.error}</ErrorMessage>}
    </div>
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
      <div className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <FactionImage
            splitId={splitId}
            factionId={faction.id}
            imageVersion={faction.imageVersion}
            factionName={faction.name}
            color={faction.color}
            size="sm"
            decorative
          />
          <span className="font-medium">{faction.name}</span>
        </div>
        <span className="text-sm text-text-muted">{faction.participantCount} participante(s)</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-card border border-border bg-surface p-4">
      <form action={updateAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
        <div>
          <label htmlFor={`faction-${faction.id}-name`} className="block text-xs font-medium text-text-muted">
            Nombre
          </label>
          <input
            id={`faction-${faction.id}-name`}
            name="name"
            type="text"
            defaultValue={faction.name}
            required
            className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
          />
          <FieldError message={updateState.fieldErrors?.name} />
        </div>
        <div>
          <label htmlFor={`faction-${faction.id}-color`} className="block text-xs font-medium text-text-muted">
            Color
          </label>
          <input
            id={`faction-${faction.id}-color`}
            name="color"
            type="color"
            defaultValue={faction.color}
            className="mt-1 h-9 w-full rounded-control border border-border-strong"
          />
          <FieldError message={updateState.fieldErrors?.color} />
        </div>
        <SaveFactionButton />
      </form>

      <FactionImageManager splitId={splitId} faction={faction} />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
        <span className="text-text-muted">
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
