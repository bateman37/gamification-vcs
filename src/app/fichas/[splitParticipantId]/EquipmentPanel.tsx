"use client";

import { useFormState, useFormStatus } from "react-dom";
import { equipOwnedItemAction, unequipSlotAction } from "@/server/actions/equipment.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage, SubmitButton } from "@/components/ui";
import type { EquippedSlotView } from "@/server/services/equipment.service";
import type { OwnedItemView } from "@/server/services/inventory.service";

function EquipButton() {
  const { pending } = useFormStatus();
  return (
    <SubmitButton pending={pending} className="px-3 py-1 text-xs">
      Equipar
    </SubmitButton>
  );
}

function UnequipButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-control border border-danger/30 px-3 py-1 text-xs font-medium text-danger-ink hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Desequipando..." : "Desequipar"}
    </button>
  );
}

function SlotRow({
  splitParticipantId,
  slot,
  compatibleItems,
}: {
  splitParticipantId: string;
  slot: EquippedSlotView;
  compatibleItems: OwnedItemView[];
}) {
  const equipWithIds = equipOwnedItemAction.bind(null, splitParticipantId);
  const [equipState, equipAction] = useFormState(equipWithIds, initialActionState);
  const unequipWithIds = unequipSlotAction.bind(null, splitParticipantId, slot.equipmentSlotId);
  const [unequipState, unequipAction] = useFormState(unequipWithIds, initialActionState);

  return (
    <li className="space-y-2 rounded-md border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-ink">{slot.equipmentSlotName}</span>
        {slot.equippedItem ? (
          <form action={unequipAction}>
            <UnequipButton />
          </form>
        ) : (
          <span className="text-sm text-text-muted">Ranura vacia</span>
        )}
      </div>
      {slot.equippedItem && (
        <p className="text-sm text-text-muted">
          {slot.equippedItem.itemName} · {slot.equippedItem.kpiName} · +{slot.equippedItem.bonusPercent} %
        </p>
      )}
      {!unequipState.ok && unequipState.error && <ErrorMessage>{unequipState.error}</ErrorMessage>}

      {compatibleItems.length > 0 && (
        <form action={equipAction} className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
          <select name="ownedItemId" defaultValue={compatibleItems[0]!.ownedItemId} className="rounded-control border border-border-strong px-2 py-1 text-xs">
            {compatibleItems.map((item) => (
              <option key={item.ownedItemId} value={item.ownedItemId}>
                {item.name} (+{item.bonusPercent} % {item.kpiName})
              </option>
            ))}
          </select>
          <EquipButton />
        </form>
      )}
      {!equipState.ok && equipState.error && <ErrorMessage>{equipState.error}</ErrorMessage>}
    </li>
  );
}

/**
 * Equipo actual del participante (`0.9.0` / MVP-2D, secciones 19-22 del
 * encargo): el objeto que cuenta es siempre el equipado en el instante en
 * que se publique la semana, nunca lo que muestre esta previsualizacion.
 */
export function EquipmentPanel({
  splitParticipantId,
  slots,
  inventory,
  editable,
}: {
  splitParticipantId: string;
  slots: EquippedSlotView[];
  inventory: OwnedItemView[];
  editable: boolean;
}) {
  if (slots.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-border-strong px-4 py-6 text-center text-sm text-text-muted">
        Este split todavía no tiene ninguna ranura de equipo configurada.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">
        El equipo que cuenta para tus resultados es siempre el que tengas puesto en el instante en que el
        administrador publique la semana: cambiarlo ahora afecta a la previsualizacion de la proxima semana no
        publicada, nunca a una ya publicada.
      </p>
      <ul className="space-y-2">
        {slots.map((slot) => (
          <SlotRow
            key={slot.equipmentSlotId}
            splitParticipantId={splitParticipantId}
            slot={slot}
            compatibleItems={editable ? inventory.filter((item) => item.equipmentSlotId === slot.equipmentSlotId) : []}
          />
        ))}
      </ul>
      {!editable && <p className="text-sm text-text-muted">El split no esta activo: el equipo es de solo lectura.</p>}
    </div>
  );
}
