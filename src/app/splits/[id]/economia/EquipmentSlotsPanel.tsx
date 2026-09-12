"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createEquipmentSlotAction,
  deleteEquipmentSlotAction,
  renameEquipmentSlotAction,
  reorderEquipmentSlotsAction,
} from "@/server/actions/equipment-slot.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage, FieldError, SubmitButton, SuccessMessage } from "@/components/ui";

export interface SlotRow {
  id: string;
  name: string;
  storeItemCount: number;
}

function CreateSlotButton() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending}>Anadir ranura</SubmitButton>;
}

function SlotRowItem({
  splitId,
  slot,
  index,
  total,
  locked,
  onMove,
}: {
  splitId: string;
  slot: SlotRow;
  index: number;
  total: number;
  locked: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  const [editing, setEditing] = useState(false);
  const renameWithIds = renameEquipmentSlotAction.bind(null, splitId, slot.id);
  const [renameState, renameAction] = useFormState(renameWithIds, initialActionState);
  const deleteWithIds = deleteEquipmentSlotAction.bind(null, splitId, slot.id);
  const [deleteState, deleteAction] = useFormState(deleteWithIds, initialActionState);

  if (editing) {
    return (
      <li className="rounded-md border border-slate-200 bg-white p-3">
        <form action={renameAction} className="flex flex-wrap items-center gap-2">
          <input
            name="name"
            defaultValue={slot.name}
            required
            maxLength={60}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
          <SubmitButton pending={false} className="px-3 py-1">
            Guardar
          </SubmitButton>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm"
          >
            Cancelar
          </button>
        </form>
        <FieldError message={renameState.fieldErrors?.name} />
        {!renameState.ok && renameState.error && <ErrorMessage>{renameState.error}</ErrorMessage>}
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white p-3">
      <div>
        <span className="font-medium text-slate-800">{slot.name}</span>
        <span className="ml-2 text-xs text-slate-500">
          {slot.storeItemCount} objeto{slot.storeItemCount === 1 ? "" : "s"}
        </span>
      </div>
      {!locked && (
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`Subir ${slot.name}`}
          >
            ↑
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(index, 1)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`Bajar ${slot.name}`}
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Renombrar
          </button>
          <form action={deleteAction}>
            <button
              type="submit"
              disabled={slot.storeItemCount > 0}
              title={slot.storeItemCount > 0 ? "No se puede eliminar: tiene objetos asociados." : undefined}
              className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Eliminar
            </button>
          </form>
        </div>
      )}
      {!deleteState.ok && deleteState.error && <ErrorMessage>{deleteState.error}</ErrorMessage>}
    </li>
  );
}

/**
 * Ranuras de equipo del split (`0.9.0` / MVP-2D, secciones 10-11 del
 * encargo). Solo editable con el mercado cerrado y el split no cerrado
 * (`locked` refleja ambas condiciones, calculadas en el servidor).
 */
export function EquipmentSlotsPanel({ splitId, slots, locked, maxSlots }: { splitId: string; slots: SlotRow[]; locked: boolean; maxSlots: number }) {
  const [orderedSlots, setOrderedSlots] = useState(slots);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const createWithId = createEquipmentSlotAction.bind(null, splitId);
  const [createState, createAction] = useFormState(createWithId, initialActionState);

  function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= orderedSlots.length) return;
    const next = [...orderedSlots];
    const moved = next.splice(index, 1)[0]!;
    next.splice(target, 0, moved);
    setOrderedSlots(next);
    setReorderError(null);
    startTransition(async () => {
      const formData = new FormData();
      for (const slot of next) formData.append("slotId", slot.id);
      const result = await reorderEquipmentSlotsAction(splitId, initialActionState, formData);
      if (!result.ok) setReorderError(result.error ?? "No se pudo reordenar.");
    });
  }

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold">Ranuras de equipo</h3>
      <p className="text-sm text-slate-600">
        El numero y el nombre de las ranuras los decides tu: no hay ranuras predeterminadas. Cada objeto del catalogo
        pertenece exactamente a una ranura, y cada participante puede equipar como maximo un objeto por ranura.
      </p>
      {locked && (
        <p className="text-sm text-amber-700">
          No se pueden crear, renombrar, reordenar ni eliminar ranuras mientras el mercado este abierto o el split este
          cerrado.
        </p>
      )}
      {reorderError && <ErrorMessage>{reorderError}</ErrorMessage>}

      {orderedSlots.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          Todavia no hay ninguna ranura de equipo configurada.
        </p>
      ) : (
        <ul className="space-y-2">
          {orderedSlots.map((slot, index) => (
            <SlotRowItem
              key={slot.id}
              splitId={splitId}
              slot={slot}
              index={index}
              total={orderedSlots.length}
              locked={locked}
              onMove={handleMove}
            />
          ))}
        </ul>
      )}

      {!locked && orderedSlots.length < maxSlots && (
        <form action={createAction} className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-slate-300 bg-white p-3">
          <div>
            <label htmlFor="new-slot-name" className="block text-xs font-medium text-slate-700">
              Nueva ranura
            </label>
            <input
              id="new-slot-name"
              name="name"
              required
              maxLength={60}
              placeholder="Por ejemplo: Artefacto"
              className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <CreateSlotButton />
          <FieldError message={createState.fieldErrors?.name} />
        </form>
      )}
      {!createState.ok && createState.error && <ErrorMessage>{createState.error}</ErrorMessage>}
      {createState.ok && <SuccessMessage>Ranura guardada correctamente.</SuccessMessage>}
      {!locked && orderedSlots.length >= maxSlots && (
        <p className="text-xs text-slate-500">Limite tecnico de {maxSlots} ranuras por split alcanzado.</p>
      )}
    </div>
  );
}
