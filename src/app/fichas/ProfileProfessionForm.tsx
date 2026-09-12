"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { chooseOwnProfessionAction } from "@/server/actions/profile.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage, FieldError, SubmitButton, SuccessMessage } from "@/components/ui";
import { PROFESSION_BONUS_LABEL } from "@/domain/profession-bonus";
import { formatAvailableLevels, formatPoweredKpis, type ProfessionView } from "@/domain/profession-display";

function SaveProfessionButton() {
  const { pending } = useFormStatus();
  return (
    <SubmitButton pending={pending} className="bg-ink/90 hover:bg-ink/80">
      Guardar profesion
    </SubmitButton>
  );
}

function ProfessionDetails({ profession }: { profession: ProfessionView }) {
  return (
    <div className="rounded-md bg-canvas px-3 py-2 text-sm">
      <p className="font-medium text-ink">{profession.name}</p>
      <p className="text-text-muted">Disponible para: {formatAvailableLevels(profession)}</p>
      <p className="text-text-muted">Potencia: {formatPoweredKpis(profession)}</p>
      <p className="text-text-muted">Bonus: {PROFESSION_BONUS_LABEL}</p>
    </div>
  );
}

/**
 * Eleccion de la propia profesion desde la ficha (`0.8.0` / MVP-2B).
 * Mientras el split no tenga ninguna semana publicada se puede elegir,
 * cambiar o dejar sin elegir; despues, el selector se sustituye por
 * informacion de solo lectura y el servidor rechaza cualquier cambio.
 */
export function ProfileProfessionForm({
  splitParticipantId,
  splitUsesProfessions,
  profession,
  availableProfessions,
  locked,
  editable,
}: {
  splitParticipantId: string;
  splitUsesProfessions: boolean;
  profession: ProfessionView | null;
  availableProfessions: ProfessionView[];
  locked: boolean;
  editable: boolean;
}) {
  const chooseWithId = chooseOwnProfessionAction.bind(null, splitParticipantId);
  const [state, formAction] = useFormState(chooseWithId, initialActionState);
  const [selectedId, setSelectedId] = useState(profession?.id ?? "");

  if (!splitUsesProfessions) {
    return <p className="text-sm text-text-muted">Este split no utiliza profesiones.</p>;
  }

  const selected = availableProfessions.find((candidate) => candidate.id === selectedId) ?? null;

  if (locked || !editable) {
    return (
      <div className="space-y-2">
        {profession ? <ProfessionDetails profession={profession} /> : <p className="text-sm text-text-muted">Sin profesion elegida.</p>}
        <p className="text-sm text-reward-ink">
          {locked ? "Profesión bloqueada desde la publicación de la primera semana." : "El split esta cerrado: la ficha es de solo lectura."}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <label htmlFor={`profession-${splitParticipantId}`} className="block text-xs font-medium text-text-muted">
        Profesión
      </label>
      <div className="flex flex-wrap items-start gap-2">
        <select
          id={`profession-${splitParticipantId}`}
          name="professionId"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          className="min-w-0 flex-1 rounded-control border border-border-strong px-3 py-2 text-sm"
        >
          <option value="">Sin elegir</option>
          {availableProfessions.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name} — {formatPoweredKpis(candidate)} ({PROFESSION_BONUS_LABEL})
            </option>
          ))}
        </select>
        <SaveProfessionButton />
      </div>
      {availableProfessions.length === 0 && (
        <p className="text-sm text-reward-ink">No hay ninguna profesion disponible para tu nivel. Contacta con un administrador.</p>
      )}
      {selected && <ProfessionDetails profession={selected} />}
      <FieldError message={state.fieldErrors?.professionId} />
      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {state.ok && <SuccessMessage>Profesión guardada.</SuccessMessage>}
    </form>
  );
}
