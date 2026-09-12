"use client";

import { useRef } from "react";

export interface SplitOption {
  id: string;
  name: string;
}
export interface FactionOption {
  id: string;
  name: string;
}
export interface ParticipantOption {
  id: string;
  alias: string;
}

/**
 * Selector de split y publico (seccion 40/41 del encargo). Navega por GET
 * (mismo patron que `SplitSelector`/`PersonSelector` de Resultados): cada
 * cambio recarga la pagina con las opciones de faccion/persona del split
 * elegido, sin depender de una API adicional para poblarlas.
 */
export function AudienceSelectorForm({
  splits,
  selectedSplitId,
  audienceType,
  factions,
  selectedFactionId,
  participants,
  selectedParticipantId,
}: {
  splits: SplitOption[];
  selectedSplitId: string;
  audienceType: string;
  factions: FactionOption[];
  selectedFactionId: string;
  participants: ParticipantOption[];
  selectedParticipantId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} method="get" className="grid gap-3 sm:grid-cols-3">
      <div>
        <label htmlFor="ma-split" className="block text-xs font-medium text-text-muted">
          Split
        </label>
        <select
          id="ma-split"
          name="splitId"
          defaultValue={selectedSplitId}
          onChange={() => formRef.current?.requestSubmit()}
          className="mt-1 w-full rounded-control border border-border-strong bg-surface px-2 py-1.5 text-sm text-ink"
        >
          <option value="">Selecciona un split</option>
          {splits.map((split) => (
            <option key={split.id} value={split.id}>
              {split.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="ma-audience" className="block text-xs font-medium text-text-muted">
          Público
        </label>
        <select
          id="ma-audience"
          name="audienceType"
          defaultValue={audienceType}
          onChange={() => formRef.current?.requestSubmit()}
          className="mt-1 w-full rounded-control border border-border-strong bg-surface px-2 py-1.5 text-sm text-ink"
        >
          <option value="SPLIT">Todo el split</option>
          <option value="FACTION">Una facción</option>
          <option value="PERSON">Una persona participante</option>
        </select>
      </div>

      {audienceType === "FACTION" && (
        <div>
          <label htmlFor="ma-faction" className="block text-xs font-medium text-text-muted">
            Facción
          </label>
          <select
            id="ma-faction"
            name="factionId"
            defaultValue={selectedFactionId}
            onChange={() => formRef.current?.requestSubmit()}
            className="mt-1 w-full rounded-control border border-border-strong bg-surface px-2 py-1.5 text-sm text-ink"
          >
            <option value="">Selecciona una facción</option>
            {factions.map((faction) => (
              <option key={faction.id} value={faction.id}>
                {faction.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {audienceType === "PERSON" && (
        <div>
          <label htmlFor="ma-person" className="block text-xs font-medium text-text-muted">
            Persona
          </label>
          <select
            id="ma-person"
            name="splitParticipantId"
            defaultValue={selectedParticipantId}
            onChange={() => formRef.current?.requestSubmit()}
            className="mt-1 w-full rounded-control border border-border-strong bg-surface px-2 py-1.5 text-sm text-ink"
          >
            <option value="">Selecciona una persona</option>
            {participants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.alias}
              </option>
            ))}
          </select>
        </div>
      )}
    </form>
  );
}
