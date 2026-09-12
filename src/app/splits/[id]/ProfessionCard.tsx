"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { deleteProfessionAction, updateProfessionAction } from "@/server/actions/profession.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage, SubmitButton } from "@/components/ui";
import { PROFESSION_BONUS_LABEL } from "@/domain/profession-bonus";
import { formatAvailableLevels, formatPoweredKpis, type ProfessionView } from "@/domain/profession-display";
import { ProfessionFormFields } from "./ProfessionFormFields";

function SaveProfessionButton() {
  const { pending } = useFormStatus();
  return (
    <SubmitButton pending={pending} className="bg-ink/90 hover:bg-ink/80">
      Guardar
    </SubmitButton>
  );
}

function DeleteProfessionButton({ disabled, title }: { disabled: boolean; title?: string }) {
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

/** Resumen visual de una profesion, reutilizado por la tarjeta y por la ficha del participante. */
export function ProfessionSummary({ profession }: { profession: ProfessionView }) {
  return (
    <div className="space-y-0.5 text-sm">
      <p className="font-medium text-ink">{profession.name}</p>
      <p className="text-text-muted">Disponible para: {formatAvailableLevels(profession)}</p>
      <p className="text-text-muted">Potencia: {formatPoweredKpis(profession)}</p>
      <p className="text-text-muted">Bonus: {PROFESSION_BONUS_LABEL}</p>
    </div>
  );
}

export function ProfessionCard({
  splitId,
  profession,
  participantCount,
  readOnly,
  canEditOrDelete,
  lockedReason,
}: {
  splitId: string;
  profession: ProfessionView;
  participantCount: number;
  readOnly: boolean;
  canEditOrDelete: boolean;
  lockedReason?: string;
}) {
  const [editing, setEditing] = useState(false);
  const updateWithIds = updateProfessionAction.bind(null, splitId, profession.id);
  const [updateState, updateAction] = useFormState(updateWithIds, initialActionState);
  const deleteWithIds = deleteProfessionAction.bind(null, splitId, profession.id);
  const [deleteState, deleteAction] = useFormState(deleteWithIds, initialActionState);

  const canDelete = canEditOrDelete && participantCount === 0;
  const deleteDisabledReason = !canEditOrDelete
    ? lockedReason
    : participantCount > 0
      ? "No se puede eliminar: tiene participantes asignados."
      : undefined;

  return (
    <div className="space-y-3 rounded-card border border-border bg-surface p-4">
      {editing && canEditOrDelete && !readOnly ? (
        <form action={updateAction} className="space-y-3">
          <ProfessionFormFields
            idPrefix={`profession-${profession.id}`}
            defaults={{
              name: profession.name,
              kpiCodeA: profession.kpiCodeA,
              kpiCodeB: profession.kpiCodeB,
              availableN0: profession.availableN0,
              availableN1: profession.availableN1,
              availableN2: profession.availableN2,
            }}
            fieldErrors={updateState.fieldErrors}
          />
          <div className="flex flex-wrap gap-2">
            <SaveProfessionButton />
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-control border border-border-strong px-3 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
          {!updateState.ok && updateState.error && <ErrorMessage>{updateState.error}</ErrorMessage>}
        </form>
      ) : (
        <>
          <ProfessionSummary profession={profession} />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
            <span className="text-text-muted">
              {participantCount} participante{participantCount === 1 ? "" : "s"} asignado
              {participantCount === 1 ? "" : "s"}
            </span>
            {!readOnly && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canEditOrDelete}
                  title={!canEditOrDelete ? lockedReason : undefined}
                  onClick={() => setEditing(true)}
                  className="rounded-control border border-border-strong px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Editar
                </button>
                <form action={deleteAction}>
                  <DeleteProfessionButton disabled={!canDelete} title={deleteDisabledReason} />
                </form>
              </div>
            )}
          </div>
          {!updateState.ok && updateState.error && <ErrorMessage>{updateState.error}</ErrorMessage>}
          {!deleteState.ok && deleteState.error && <ErrorMessage>{deleteState.error}</ErrorMessage>}
        </>
      )}
    </div>
  );
}
