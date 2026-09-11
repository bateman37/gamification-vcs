"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { updateParticipantAction } from "@/server/actions/participant.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage, FieldError, SubmitButton } from "@/components/ui";
import type { ParticipantWithPerson } from "@/server/services/participant.service";
import type { FactionWithCounts } from "@/server/services/faction.service";

function SaveButton() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending}>Guardar</SubmitButton>;
}

function FactionBadge({ faction }: { faction: { name: string; color: string } | null }) {
  if (!faction) return <span className="text-slate-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="h-3 w-3 rounded-full border border-slate-300" style={{ backgroundColor: faction.color }} />
      {faction.name}
    </span>
  );
}

export function ParticipantEditRow({
  splitId,
  participant,
  factions,
}: {
  splitId: string;
  participant: ParticipantWithPerson & { faction: { name: string; color: string } | null };
  factions: FactionWithCounts[];
}) {
  const [editing, setEditing] = useState(false);
  const updateWithIds = updateParticipantAction.bind(null, splitId, participant.id);
  const [state, formAction] = useFormState(updateWithIds, initialActionState);

  if (!editing) {
    return (
      <tr className="border-b border-slate-100">
        <td className="px-3 py-2">{participant.person.fullName}</td>
        <td className="px-3 py-2 font-medium">{participant.alias}</td>
        <td className="px-3 py-2">{participant.level}</td>
        <td className="px-3 py-2">
          <FactionBadge faction={participant.faction} />
        </td>
        <td className="px-3 py-2 text-center">{participant.startWeekSequenceNumber}</td>
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
      <td className="px-3 py-2">{participant.person.fullName}</td>
      <td colSpan={5} className="px-3 py-3">
        <form action={formAction} className="flex flex-wrap items-start gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">Alias</label>
            <input
              name="alias"
              defaultValue={participant.alias}
              required
              className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
            <FieldError message={state.fieldErrors?.alias} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Nivel</label>
            <select
              name="level"
              defaultValue={participant.level}
              className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="N0">N0</option>
              <option value="N1">N1</option>
              <option value="N2">N2</option>
            </select>
          </div>
          {factions.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600">Faccion</label>
              <select
                name="factionId"
                defaultValue={participant.factionId ?? ""}
                required
                className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
              >
                <option value="" disabled>
                  Selecciona una faccion
                </option>
                {factions.map((faction) => (
                  <option key={faction.id} value={faction.id}>
                    {faction.name}
                  </option>
                ))}
              </select>
              <FieldError message={state.fieldErrors?.factionId} />
            </div>
          )}
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
