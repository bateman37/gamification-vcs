"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import type { ParticipantLevel } from "@prisma/client";
import { updateParticipantAction } from "@/server/actions/participant.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage, FieldError, SubmitButton } from "@/components/ui";
import type { ParticipantWithPerson } from "@/server/services/participant.service";
import type { FactionWithCounts } from "@/server/services/faction.service";
import { PROFESSION_BONUS_LABEL } from "@/domain/profession-bonus";
import { formatPoweredKpis, type ProfessionView } from "@/domain/profession-display";

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

/**
 * Celda "Profesion" de la tabla administrativa (`0.8.0` / MVP-2B, seccion
 * 23): nombre y resumen corto de sus dos KPI si esta asignada, badge visible
 * `Sin elegir` si el split usa profesiones y todavia falta, y un texto
 * neutro (sin alarma) cuando el split no utiliza profesiones.
 */
function ProfessionCell({
  profession,
  splitUsesProfessions,
}: {
  profession: ProfessionView | null;
  splitUsesProfessions: boolean;
}) {
  if (!splitUsesProfessions) return <span className="text-slate-400">—</span>;
  if (!profession) {
    return (
      <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Sin elegir
      </span>
    );
  }
  return (
    <span className="block">
      <span className="font-medium">{profession.name}</span>
      <span className="block text-xs text-slate-500">{formatPoweredKpis(profession)}</span>
    </span>
  );
}

function isAvailableForLevel(profession: ProfessionView, level: ParticipantLevel): boolean {
  if (level === "N0") return profession.availableN0;
  if (level === "N1") return profession.availableN1;
  return profession.availableN2;
}

export function ParticipantEditRow({
  splitId,
  participant,
  factions,
  professions,
  professionLocked,
}: {
  splitId: string;
  participant: ParticipantWithPerson & {
    faction: { name: string; color: string } | null;
    profession: ProfessionView | null;
  };
  factions: FactionWithCounts[];
  professions: ProfessionView[];
  /** `true` desde la primera publicacion del split: la profesion se muestra bloqueada y no editable. */
  professionLocked: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [level, setLevel] = useState<ParticipantLevel>(participant.level);
  const updateWithIds = updateParticipantAction.bind(null, splitId, participant.id);
  const [state, formAction] = useFormState(updateWithIds, initialActionState);
  const splitUsesProfessions = professions.length > 0;
  const availableProfessions = professions.filter((profession) => isAvailableForLevel(profession, level));

  if (!editing) {
    return (
      <tr className="border-b border-slate-100">
        <td className="px-3 py-2">{participant.person.fullName}</td>
        <td className="px-3 py-2 font-medium">{participant.alias}</td>
        <td className="px-3 py-2">{participant.level}</td>
        <td className="px-3 py-2">
          <FactionBadge faction={participant.faction} />
        </td>
        <td className="px-3 py-2">
          <ProfessionCell profession={participant.profession} splitUsesProfessions={splitUsesProfessions} />
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
      <td colSpan={6} className="px-3 py-3">
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
              value={level}
              onChange={(event) => setLevel(event.target.value as ParticipantLevel)}
              className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="N0">N0</option>
              <option value="N1">N1</option>
              <option value="N2">N2</option>
            </select>
            <FieldError message={state.fieldErrors?.level} />
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
          {splitUsesProfessions && (
            <div>
              <label className="block text-xs font-medium text-slate-600">Profesion</label>
              {professionLocked ? (
                <>
                  {/* La profesion congelada se reenvia tal cual: el servidor rechaza igualmente cualquier cambio. */}
                  <input type="hidden" name="professionId" value={participant.professionId ?? ""} />
                  <p className="mt-1 text-sm">
                    {participant.profession ? participant.profession.name : "Sin elegir"}
                    <span className="block text-xs text-slate-500">Bloqueada desde la primera publicacion.</span>
                  </p>
                </>
              ) : (
                <>
                  <select
                    name="professionId"
                    defaultValue={participant.professionId ?? ""}
                    className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
                  >
                    <option value="">Sin elegir</option>
                    {availableProfessions.map((profession) => (
                      <option key={profession.id} value={profession.id}>
                        {profession.name} ({formatPoweredKpis(profession)})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{PROFESSION_BONUS_LABEL}</p>
                </>
              )}
              <FieldError message={state.fieldErrors?.professionId} />
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
