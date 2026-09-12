"use client";

import { useRef } from "react";
import type { PersonOption } from "@/server/services/individual-results.service";

export function PersonSelector({
  persons,
  selectedPersonId,
  gamificationMode,
}: {
  persons: PersonOption[];
  selectedPersonId: string | null;
  gamificationMode?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} method="get" className="rounded-lg border border-slate-200 bg-white p-4">
      {gamificationMode && <input type="hidden" name="gamificacion" value={gamificationMode} />}
      <label htmlFor="persona" className="block text-xs font-medium text-slate-600">
        Persona
      </label>
      <select
        id="persona"
        name="persona"
        defaultValue={selectedPersonId ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className="mt-1 w-full max-w-sm rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="">Selecciona una persona</option>
        {persons.map((person) => (
          <option key={person.id} value={person.id}>
            {person.fullName}
          </option>
        ))}
      </select>
    </form>
  );
}
