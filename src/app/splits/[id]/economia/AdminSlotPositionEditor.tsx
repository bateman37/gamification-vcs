"use client";

import { useState } from "react";
import type { EquipmentVisualPosition } from "@prisma/client";
import { useFormState, useFormStatus } from "react-dom";
import {
  activateVisualPositionAction,
  assignVisualPositionAction,
  deleteEquipmentSlotAction,
  renameEquipmentSlotAction,
  setEquipmentSlotActiveAction,
} from "@/server/actions/equipment-slot.actions";
import { initialActionState } from "@/server/actions/action-result";
import { Alert, Badge, ErrorMessage, FieldError, SubmitButton } from "@/components/ui";
import { EquipmentSilhouette } from "@/components/equipment/EquipmentSilhouette";
import { EquipmentPositionBoard } from "@/components/equipment/EquipmentPositionBoard";
import { EQUIPMENT_VISUAL_POSITIONS } from "@/domain/equipment-visual-positions";

/**
 * Editor visual administrativo de ranuras (`1.2.0`, seccion 6 del encargo).
 *
 * Muestra las diez posiciones del catalogo en la misma composicion que ve el
 * jugador, con el estado real de cada una y sus contadores de uso. No es un
 * panel decorativo: cada posicion tiene sus acciones reales (activar,
 * desactivar, renombrar) y las ranuras historicas pendientes de ubicar
 * aparecen en su propio bloque, como un aviso, nunca como un error global.
 *
 * Toda la autorizacion y todas las reglas viven en el servidor: aqui solo se
 * habilitan o deshabilitan controles para explicar por que algo no se puede
 * hacer todavia.
 */

export interface AdminSlotRow {
  id: string;
  name: string;
  visualPosition: EquipmentVisualPosition | null;
  isActive: boolean;
  storeItemCount: number;
  itemsForSaleCount: number;
  ownerCount: number;
  equippedCount: number;
}

export interface AdminPositionRow {
  position: EquipmentVisualPosition;
  baseName: string;
  slot: AdminSlotRow | null;
}

function ActivateForm({ splitId, position, label }: { splitId: string; position: EquipmentVisualPosition; label: string }) {
  const [state, action] = useFormState(activateVisualPositionAction.bind(null, splitId), initialActionState);
  const { pending } = useFormStatus();
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="visualPosition" value={position} />
      <SubmitButton pending={pending} className="w-full px-2 py-1 text-xs">
        {label}
      </SubmitButton>
      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    </form>
  );
}

function RenameForm({ splitId, slot, onDone }: { splitId: string; slot: AdminSlotRow; onDone: () => void }) {
  const [state, action] = useFormState(renameEquipmentSlotAction.bind(null, splitId, slot.id), initialActionState);
  return (
    <form action={action} className="space-y-1">
      <label htmlFor={`rename-${slot.id}`} className="block text-xs font-medium text-ink">
        Nombre visible
      </label>
      <input
        id={`rename-${slot.id}`}
        name="name"
        defaultValue={slot.name}
        required
        maxLength={60}
        className="w-full rounded-control border border-border-strong px-2 py-1 text-xs"
      />
      <div className="flex flex-wrap gap-1">
        <SubmitButton pending={false} className="px-2 py-1 text-xs">
          Guardar
        </SubmitButton>
        <button type="button" onClick={onDone} className="rounded-control border border-border-strong px-2 py-1 text-xs">
          Cancelar
        </button>
      </div>
      <FieldError message={state.fieldErrors?.name} />
      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    </form>
  );
}

function ToggleActiveForm({ splitId, slot }: { splitId: string; slot: AdminSlotRow }) {
  const [state, action] = useFormState(
    setEquipmentSlotActiveAction.bind(null, splitId, slot.id, !slot.isActive),
    initialActionState,
  );
  const blockedByEquipment = slot.isActive && slot.equippedCount > 0;
  const blockedByForSale = slot.isActive && slot.itemsForSaleCount > 0;

  return (
    <form
      action={action}
      onSubmit={(event) => {
        // Confirmacion explicita solo al desactivar una ranura con objetos ya comprados:
        // se conservan, pero no podran equiparse mientras este inactiva.
        if (slot.isActive && slot.ownerCount > 0 && !window.confirm(
          `Los ${slot.ownerCount} objetos ya comprados de "${slot.name}" se conservan, pero no podrán equiparse mientras la ranura esté desactivada. ¿Continuar?`,
        )) {
          event.preventDefault();
        }
      }}
      className="space-y-1"
    >
      <button
        type="submit"
        disabled={blockedByEquipment || blockedByForSale}
        title={
          blockedByEquipment
            ? "No se puede desactivar: hay participantes con un objeto equipado en esta ranura."
            : blockedByForSale
              ? "No se puede desactivar: todavía tiene objetos a la venta."
              : undefined
        }
        className="w-full rounded-control border border-border-strong px-2 py-1 text-xs font-medium text-ink transition-colors duration-150 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        {slot.isActive ? "Desactivar" : "Activar"}
      </button>
      {blockedByEquipment && (
        <p className="text-xs text-danger-ink">
          {slot.equippedCount} participante{slot.equippedCount === 1 ? "" : "s"} con equipo aquí.
        </p>
      )}
      {!blockedByEquipment && blockedByForSale && (
        <p className="text-xs text-danger-ink">
          {slot.itemsForSaleCount} objeto{slot.itemsForSaleCount === 1 ? "" : "s"} todavía a la venta.
        </p>
      )}
      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    </form>
  );
}

function DeleteForm({ splitId, slot }: { splitId: string; slot: AdminSlotRow }) {
  const [state, action] = useFormState(deleteEquipmentSlotAction.bind(null, splitId, slot.id), initialActionState);
  const hasReferences = slot.storeItemCount > 0 || slot.equippedCount > 0 || slot.ownerCount > 0;
  if (hasReferences) return null;
  return (
    <form action={action}>
      <button
        type="submit"
        className="w-full rounded-control border border-danger/30 px-2 py-1 text-xs font-medium text-danger-ink transition-colors duration-150 hover:bg-danger-soft"
      >
        Eliminar
      </button>
      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    </form>
  );
}

function SlotUsage({ slot }: { slot: AdminSlotRow }) {
  return (
    <p className="text-xs text-text-muted">
      {slot.storeItemCount} objeto{slot.storeItemCount === 1 ? "" : "s"} · {slot.ownerCount} propietario
      {slot.ownerCount === 1 ? "" : "s"} · {slot.equippedCount} equipado{slot.equippedCount === 1 ? "" : "s"}
    </p>
  );
}

function PositionCell({ splitId, entry, locked }: { splitId: string; entry: AdminPositionRow; locked: boolean }) {
  const [editing, setEditing] = useState(false);
  const slot = entry.slot;

  return (
    <div
      className={`flex min-h-[7.5rem] flex-col gap-1 rounded-card border p-2 text-xs ${
        slot === null
          ? "border-dashed border-border-strong bg-surface"
          : slot.isActive
            ? "border-primary/40 bg-primary-soft/40"
            : "border-border bg-surface-muted"
      }`}
    >
      <p className="text-[0.7rem] uppercase tracking-wide text-text-muted">{entry.baseName}</p>
      {slot === null ? (
        <>
          <p className="font-medium text-text-muted">Posición libre</p>
          {!locked && <ActivateForm splitId={splitId} position={entry.position} label="Activar" />}
        </>
      ) : (
        <>
          <p className="font-medium text-ink">{slot.name}</p>
          <Badge tone={slot.isActive ? "success" : "gray"}>{slot.isActive ? "Activa" : "Inactiva"}</Badge>
          <SlotUsage slot={slot} />
          {!locked &&
            (editing ? (
              <RenameForm splitId={splitId} slot={slot} onDone={() => setEditing(false)} />
            ) : (
              <div className="mt-auto space-y-1">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="w-full rounded-control border border-border-strong px-2 py-1 text-xs font-medium text-ink transition-colors duration-150 hover:bg-surface-muted"
                >
                  Renombrar
                </button>
                <ToggleActiveForm splitId={splitId} slot={slot} />
                <DeleteForm splitId={splitId} slot={slot} />
              </div>
            ))}
        </>
      )}
    </div>
  );
}

function AssignForm({
  splitId,
  slot,
  freePositions,
}: {
  splitId: string;
  slot: AdminSlotRow;
  freePositions: { position: EquipmentVisualPosition; baseName: string }[];
}) {
  const [state, action] = useFormState(assignVisualPositionAction.bind(null, splitId, slot.id), initialActionState);
  const [selected, setSelected] = useState(freePositions[0]?.position ?? "");
  const selectedName = freePositions.find((entry) => entry.position === selected)?.baseName ?? "";

  if (freePositions.length === 0) {
    return <p className="text-xs text-text-muted">No queda ninguna posición libre del tablero para ubicarla.</p>;
  }

  return (
    <form action={action} className="space-y-1">
      <label htmlFor={`assign-${slot.id}`} className="block text-xs font-medium text-ink">
        Ubicar en
      </label>
      <select
        id={`assign-${slot.id}`}
        name="visualPosition"
        value={selected}
        onChange={(event) => setSelected(event.target.value as EquipmentVisualPosition)}
        className="w-full rounded-control border border-border-strong px-2 py-1 text-xs"
      >
        {freePositions.map((entry) => (
          <option key={entry.position} value={entry.position}>
            {entry.baseName}
          </option>
        ))}
      </select>
      <p className="text-xs text-text-muted">
        Se ubicará la ranura «{slot.name}» en «{selectedName}». Sus objetos, inventarios y equipos actuales se
        conservarán.
      </p>
      <SubmitButton pending={false} className="px-2 py-1 text-xs">
        Ubicar
      </SubmitButton>
      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    </form>
  );
}

export function AdminSlotPositionEditor({
  splitId,
  positions,
  unplacedSlots,
  locked,
}: {
  splitId: string;
  positions: AdminPositionRow[];
  unplacedSlots: AdminSlotRow[];
  locked: boolean;
}) {
  const freePositions = EQUIPMENT_VISUAL_POSITIONS.filter(
    (definition) => !positions.some((entry) => entry.position === definition.position && entry.slot !== null),
  ).map((definition) => ({ position: definition.position, baseName: definition.baseName }));

  const byPosition = new Map(positions.map((entry) => [entry.position, entry]));
  const cell = (position: EquipmentVisualPosition) => {
    const entry = byPosition.get(position);
    if (!entry) return <div />;
    return <PositionCell splitId={splitId} entry={entry} locked={locked} />;
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Ranuras de equipo</h3>
        <p className="mt-1 text-sm text-text-muted">
          El tablero tiene diez posiciones fijas. Tú decides cuáles se activan en este split y cómo se llaman: renombrar
          una ranura («Cabeza» → «Casco», «Mano izquierda» → «Arma») nunca cambia su posición ni rompe objetos, compras,
          inventarios, equipos ni semanas publicadas.
        </p>
      </div>

      {locked && (
        <Alert tone="warning">
          Cierra el mercado (y comprueba que el split no esté cerrado) para activar, ubicar, renombrar, desactivar o
          eliminar ranuras.
        </Alert>
      )}

      <div className="relative mx-auto max-w-3xl">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <EquipmentSilhouette className="h-full max-h-[26rem] opacity-[0.06]" />
        </div>
        <EquipmentPositionBoard responsive={false} className="relative" renderCell={cell} />
      </div>

      {unplacedSlots.length > 0 && (
        <section className="space-y-3 rounded-card border border-reward/30 bg-reward-soft p-4">
          <div>
            <h4 className="text-sm font-semibold text-ink">Ranuras pendientes de ubicar</h4>
            <p className="mt-1 text-xs text-reward-ink">
              Estas ranuras se crearon antes de la versión 1.2.0 y siguen funcionando con normalidad: conservan sus
              objetos y el equipo actual de cada participante. No se ha deducido ninguna posición a partir de su nombre.
              Asígnales una posición del tablero cuando quieras; su identidad no cambia.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {unplacedSlots.map((slot) => (
              <li key={slot.id} className="space-y-2 rounded-card border border-border bg-surface p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{slot.name}</span>
                  <Badge tone={slot.isActive ? "success" : "gray"}>{slot.isActive ? "Activa" : "Inactiva"}</Badge>
                </div>
                <SlotUsage slot={slot} />
                {!locked && (
                  <>
                    <AssignForm splitId={splitId} slot={slot} freePositions={freePositions} />
                    <ToggleActiveForm splitId={splitId} slot={slot} />
                    <DeleteForm splitId={splitId} slot={slot} />
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
