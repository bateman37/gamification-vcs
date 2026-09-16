"use client";

import { useRef } from "react";

/** Selector de persona del administrador para "Badges de la persona" (seccion 5.3/6.1 del encargo), mismo patron que `/resultados/PersonSelector.tsx`. */
export function BadgePersonSelector({
  persons,
  selectedPersonId,
}: {
  persons: { id: string; fullName: string }[];
  selectedPersonId: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} method="get" className="rounded-card border border-border bg-surface p-4">
      <input type="hidden" name="vista" value="vitrina" />
      <label htmlFor="badge-persona" className="block text-xs font-medium text-text-muted">
        Persona
      </label>
      <select
        id="badge-persona"
        name="persona"
        defaultValue={selectedPersonId ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className="mt-1 w-full max-w-sm rounded-control border border-border-strong px-2 py-1.5 text-sm"
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
