"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { addParticipantAction } from "@/server/actions/participant.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage, FieldError, SubmitButton, SuccessMessage } from "@/components/ui";
import type { Person, SplitWeek } from "@prisma/client";

function SubmitAddParticipantButton() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending}>Anadir participante</SubmitButton>;
}

export function AddParticipantForm({
  splitId,
  people,
  weeks,
  splitStatus,
}: {
  splitId: string;
  people: Person[];
  weeks: SplitWeek[];
  splitStatus: string;
}) {
  const addWithId = addParticipantAction.bind(null, splitId);
  const [state, formAction] = useFormState(addWithId, initialActionState);
  const [creatingPerson, setCreatingPerson] = useState(people.length === 0);

  return (
    <form action={formAction} className="max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold">Anadir participante</h2>

      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={!creatingPerson}
            onChange={() => setCreatingPerson(false)}
            disabled={people.length === 0}
          />
          Persona existente
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={creatingPerson} onChange={() => setCreatingPerson(true)} />
          Nueva persona
        </label>
      </div>

      {!creatingPerson ? (
        <div>
          <label htmlFor="personId" className="block text-sm font-medium text-slate-700">
            Persona
          </label>
          <select
            id="personId"
            name="personId"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Selecciona una persona
            </option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.fullName}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.personId} />
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label htmlFor="newPersonFullName" className="block text-sm font-medium text-slate-700">
              Nombre completo
            </label>
            <input
              id="newPersonFullName"
              name="newPersonFullName"
              type="text"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="newPersonEmail" className="block text-sm font-medium text-slate-700">
              Correo (opcional)
            </label>
            <input
              id="newPersonEmail"
              name="newPersonEmail"
              type="email"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      <div>
        <label htmlFor="alias" className="block text-sm font-medium text-slate-700">
          Alias en este split
        </label>
        <input
          id="alias"
          name="alias"
          type="text"
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <FieldError message={state.fieldErrors?.alias} />
      </div>

      <div>
        <label htmlFor="level" className="block text-sm font-medium text-slate-700">
          Nivel tecnico
        </label>
        <select
          id="level"
          name="level"
          defaultValue="N0"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="N0">N0</option>
          <option value="N1">N1</option>
          <option value="N2">N2</option>
        </select>
      </div>

      <div>
        <label htmlFor="startWeekSequenceNumber" className="block text-sm font-medium text-slate-700">
          Semana inicial
        </label>
        <select
          id="startWeekSequenceNumber"
          name="startWeekSequenceNumber"
          defaultValue="1"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {weeks.map((week) => (
            <option key={week.sequenceNumber} value={week.sequenceNumber}>
              Semana {week.sequenceNumber}
            </option>
          ))}
        </select>
        {splitStatus === "ACTIVE" && (
          <p className="mt-1 text-xs text-slate-500">
            El split ya esta activo: indica desde que semana compite esta persona.
          </p>
        )}
        <FieldError message={state.fieldErrors?.startWeekSequenceNumber} />
      </div>

      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {state.ok && <SuccessMessage>Participante anadido correctamente.</SuccessMessage>}
      <SubmitAddParticipantButton />
    </form>
  );
}
