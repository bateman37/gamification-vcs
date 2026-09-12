"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { addParticipantAction } from "@/server/actions/participant.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage, FieldError, SubmitButton, SuccessMessage } from "@/components/ui";
import type { Person, ParticipantLevel, SplitWeek } from "@prisma/client";
import type { FactionWithCounts } from "@/server/services/faction.service";
import { PROFESSION_BONUS_LABEL } from "@/domain/profession-bonus";
import { formatPoweredKpis, type ProfessionView } from "@/domain/profession-display";

const PROFESSION_HELP_ID = "anadir-participante-profesion-ayuda";
const START_WEEK_HELP_ID = "anadir-participante-semana-inicial-ayuda";

function SubmitAddParticipantButton() {
  const { pending } = useFormStatus();
  return (
    <SubmitButton pending={pending} className="w-full lg:w-auto">
      Añadir participante
    </SubmitButton>
  );
}

function isAvailableForLevel(profession: ProfessionView, level: ParticipantLevel): boolean {
  if (level === "N0") return profession.availableN0;
  if (level === "N1") return profession.availableN1;
  return profession.availableN2;
}

/**
 * Formulario "Anadir participante" (`1.0.1`, parte H del encargo): todos
 * los campos alineados en una franja horizontal de altura comun, con el
 * boton de accion en una columna exterior estable a la derecha (nunca bajo
 * una nota de ayuda contextual). Los textos de asterisco viven en una
 * franja de ayuda unica bajo toda la rejilla, cada uno nombrando su campo
 * y asociado mediante `aria-describedby` (nunca solo un `title`).
 */
export function AddParticipantForm({
  splitId,
  people,
  weeks,
  splitStatus,
  factions,
  professions,
  professionRequired,
}: {
  splitId: string;
  people: Person[];
  weeks: SplitWeek[];
  splitStatus: string;
  factions: FactionWithCounts[];
  /** Profesiones del split. Vacio = el split no usa profesiones: no se muestra ningun selector. */
  professions: ProfessionView[];
  /** `true` cuando el split ya tiene una semana publicada: la profesion es obligatoria en el propio alta. */
  professionRequired: boolean;
}) {
  const addWithId = addParticipantAction.bind(null, splitId);
  const [state, formAction] = useFormState(addWithId, initialActionState);
  const [creatingPerson, setCreatingPerson] = useState(people.length === 0);
  const [level, setLevel] = useState<ParticipantLevel>("N0");
  const availableProfessions = professions.filter((profession) => isAvailableForLevel(profession, level));

  return (
    <form action={formAction} className="space-y-4 rounded-card border border-border bg-surface p-4">
      <h2 className="text-base font-semibold">Añadir participante</h2>

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

      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-4">
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
          {!creatingPerson ? (
            <div className="w-full sm:w-64">
              <label htmlFor="personId" className="block text-sm font-medium text-ink">
                Persona
              </label>
              <select
                id="personId"
                name="personId"
                className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
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
            <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2 sm:gap-4">
              <div className="sm:w-56">
                <label htmlFor="newPersonFullName" className="block text-sm font-medium text-ink">
                  Nombre completo
                </label>
                <input
                  id="newPersonFullName"
                  name="newPersonFullName"
                  type="text"
                  className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:w-56">
                <label htmlFor="newPersonEmail" className="block text-sm font-medium text-ink">
                  Correo (opcional)
                </label>
                <input
                  id="newPersonEmail"
                  name="newPersonEmail"
                  type="email"
                  className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          <div className="w-full sm:w-40">
            <label htmlFor="alias" className="block text-sm font-medium text-ink">
              Alias en este split
            </label>
            <input
              id="alias"
              name="alias"
              type="text"
              required
              className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
            />
            <FieldError message={state.fieldErrors?.alias} />
          </div>

          <div className="w-full sm:w-28">
            <label htmlFor="level" className="block text-sm font-medium text-ink">
              Nivel técnico
            </label>
            <select
              id="level"
              name="level"
              value={level}
              onChange={(event) => setLevel(event.target.value as ParticipantLevel)}
              className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
            >
              <option value="N0">N0</option>
              <option value="N1">N1</option>
              <option value="N2">N2</option>
            </select>
          </div>

          {professions.length > 0 && (
            <div className="w-full sm:w-64">
              <label htmlFor="professionId" className="block text-sm font-medium text-ink">
                Profesión *
              </label>
              <select
                id="professionId"
                name="professionId"
                required={professionRequired}
                aria-required={professionRequired}
                aria-describedby={PROFESSION_HELP_ID}
                defaultValue=""
                className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
              >
                <option value="">{professionRequired ? "Selecciona una profesión" : "Sin elegir"}</option>
                {availableProfessions.map((profession) => (
                  <option key={profession.id} value={profession.id}>
                    {profession.name} ({formatPoweredKpis(profession)})
                  </option>
                ))}
              </select>
              {availableProfessions.length === 0 && (
                <p className="mt-1 text-xs text-reward-ink">No hay ninguna profesion disponible para el nivel {level}.</p>
              )}
              <FieldError message={state.fieldErrors?.professionId} />
            </div>
          )}

          {factions.length > 0 && (
            <div className="w-full sm:w-44">
              <label htmlFor="factionId" className="block text-sm font-medium text-ink">
                Facción *
              </label>
              <select
                id="factionId"
                name="factionId"
                required
                defaultValue=""
                className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
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

          <div className="w-full sm:w-44">
            <label htmlFor="startWeekSequenceNumber" className="block text-sm font-medium text-ink">
              Semana inicial *
            </label>
            <select
              id="startWeekSequenceNumber"
              name="startWeekSequenceNumber"
              defaultValue="1"
              aria-describedby={START_WEEK_HELP_ID}
              className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
            >
              {weeks.map((week) => (
                <option key={week.sequenceNumber} value={week.sequenceNumber}>
                  Semana {week.sequenceNumber}
                </option>
              ))}
            </select>
            <FieldError message={state.fieldErrors?.startWeekSequenceNumber} />
          </div>
        </div>

        {/* Columna de accion exterior y estable: nunca bajo la franja de ayuda (seccion 21 del encargo). */}
        <div className="w-full shrink-0 lg:w-auto">
          <SubmitAddParticipantButton />
        </div>
      </div>

      {/* Franja de ayuda unica bajo toda la rejilla: cada explicacion nombra su campo para que el
          asterisco compartido no sea ambiguo (seccion 21 del encargo, `1.0.1`). */}
      <div className="space-y-1 border-t border-border pt-3 text-xs text-text-muted">
        {professions.length > 0 && (
          <p id={PROFESSION_HELP_ID}>
            * Profesión:{" "}
            {professionRequired
              ? "es obligatoria porque este split ya publico una semana usando profesiones; debe elegirse una compatible con el nivel."
              : "es opcional hasta la primera publicación."}{" "}
            {PROFESSION_BONUS_LABEL} y despues queda bloqueada.
          </p>
        )}
        <p id={START_WEEK_HELP_ID}>* Semana inicial: en un split activo, indica desde que semana empieza a competir esta persona.</p>
      </div>

      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {state.ok && <SuccessMessage>Participante anadido correctamente.</SuccessMessage>}
    </form>
  );
}
