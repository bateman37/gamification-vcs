"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormState } from "react-dom";
import type { EquipmentVisualPosition } from "@prisma/client";
import { saveEquipmentLoadoutAction } from "@/server/actions/equipment.actions";
import { initialActionState } from "@/server/actions/action-result";
import { Alert, Badge, Button, ErrorMessage, SuccessMessage } from "@/components/ui";
import { EquipmentSilhouette } from "@/components/equipment/EquipmentSilhouette";
import { EquipmentPositionBoard } from "@/components/equipment/EquipmentPositionBoard";
import { EQUIPMENT_VISUAL_POSITIONS } from "@/domain/equipment-visual-positions";
import { areLoadoutsEqual, computeLoadoutRevision, type LoadoutAssignment } from "@/domain/equipment-loadout";
import { EquipmentSlotCard } from "./EquipmentSlotCard";
import { InventoryGrid } from "./InventoryGrid";
import { EquipmentBonusSummary } from "./EquipmentBonusSummary";
import type { EditorItemView, EditorLocationView, EditorProfessionView, EditorSlotView } from "./equipment-view";

/**
 * Editor de equipo de la ficha (`1.2.0`, secciones 8-10 del encargo).
 *
 * Todo ocurre en un **borrador local**: arrastrar, seleccionar, sustituir o
 * quitar no persiste nada. Solo "Confirmar equipo" envia el conjunto completo
 * a `saveEquipmentLoadout`, que lo sustituye de forma atomica en servidor.
 *
 * Paridad de interaccion (seccion 9.3): todo lo que se puede hacer
 * arrastrando se puede hacer con clic, teclado y tactil. El camino accesible
 * (seleccionar objeto -> "Equipar aquí" / "Quitar") son botones HTML reales y
 * es el camino principal; el arrastre se implementa con **Pointer Events**
 * (no con la API HTML5 de drag and drop, que no funciona bien en tactil ni
 * con teclado) como mejora progresiva sobre esos mismos botones.
 *
 * El borrador nunca se envia a resultados, creditos ni previsualizaciones
 * administrativas: el equipo que cuenta para una semana sigue siendo el
 * confirmado que `publishWeek` relee dentro de su propia transaccion.
 */

type DraftMap = Map<string, string>;

function toDraftMap(assignments: readonly LoadoutAssignment[]): DraftMap {
  return new Map(assignments.map((assignment) => [assignment.equipmentSlotId, assignment.ownedItemId]));
}

function toAssignments(draft: DraftMap): LoadoutAssignment[] {
  return [...draft.entries()].map(([equipmentSlotId, ownedItemId]) => ({ equipmentSlotId, ownedItemId }));
}

/** Distancia en px a partir de la cual un gesto se considera arrastre y no un clic. */
const DRAG_THRESHOLD_PX = 6;

export function EquipmentEditor({
  splitParticipantId,
  splitId,
  slots,
  inventory,
  confirmedAssignments,
  confirmedRevision,
  profession,
  location,
  readOnly,
  readOnlyReason,
}: {
  splitParticipantId: string;
  splitId: string;
  slots: EditorSlotView[];
  inventory: EditorItemView[];
  confirmedAssignments: LoadoutAssignment[];
  confirmedRevision: string;
  profession: EditorProfessionView | null;
  location: EditorLocationView | null;
  readOnly: boolean;
  readOnlyReason: string | null;
}) {
  const [draft, setDraft] = useState<DraftMap>(() => toDraftMap(confirmedAssignments));
  const [selectedOwnedItemId, setSelectedOwnedItemId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [dragOwnedItemId, setDragOwnedItemId] = useState<string | null>(null);
  const [hoverSlotId, setHoverSlotId] = useState<string | null>(null);

  const [state, formAction] = useFormState(
    saveEquipmentLoadoutAction.bind(null, splitParticipantId),
    initialActionState,
  );

  const dropTargets = useRef(new Map<string, HTMLElement>());
  const dragOrigin = useRef<{ x: number; y: number; ownedItemId: string } | null>(null);

  // El servidor es la fuente de verdad: tras `revalidatePath` llegan props nuevas y el
  // borrador vuelve a partir del conjunto confirmado.
  useEffect(() => {
    setDraft(toDraftMap(confirmedAssignments));
    setSelectedOwnedItemId(null);
  }, [confirmedRevision, confirmedAssignments]);

  const itemsByOwnedId = useMemo(() => new Map(inventory.map((item) => [item.ownedItemId, item])), [inventory]);
  const slotsById = useMemo(() => new Map(slots.map((slot) => [slot.equipmentSlotId, slot])), [slots]);

  const draftAssignments = useMemo(() => toAssignments(draft), [draft]);
  const isDirty = !areLoadoutsEqual(draftAssignments, confirmedAssignments);
  const draftRevision = computeLoadoutRevision(draftAssignments);

  const draftItems = useMemo(
    () => draftAssignments.map((assignment) => itemsByOwnedId.get(assignment.ownedItemId)).filter((item): item is EditorItemView => !!item),
    [draftAssignments, itemsByOwnedId],
  );
  const confirmedItems = useMemo(
    () => confirmedAssignments.map((assignment) => itemsByOwnedId.get(assignment.ownedItemId)).filter((item): item is EditorItemView => !!item),
    [confirmedAssignments, itemsByOwnedId],
  );

  const equippedSlotNameByOwnedItemId = useMemo(() => {
    const map = new Map<string, string>();
    for (const [slotId, ownedItemId] of draft.entries()) {
      const slot = slotsById.get(slotId);
      if (slot) map.set(ownedItemId, slot.name);
    }
    return map;
  }, [draft, slotsById]);

  const selectedItem = selectedOwnedItemId ? itemsByOwnedId.get(selectedOwnedItemId) ?? null : null;

  const assign = useCallback(
    (equipmentSlotId: string, ownedItemId: string) => {
      const item = itemsByOwnedId.get(ownedItemId);
      const slot = slotsById.get(equipmentSlotId);
      if (!item || !slot) return;
      // Reglas del borrador, tambien comprobadas en servidor: objeto en su propia ranura
      // y ranura activa. Nunca se permite soltar en otra ranura manipulando el DOM.
      if (item.equipmentSlotId !== equipmentSlotId) {
        setAnnouncement(`${item.name} no puede equiparse en ${slot.name}: pertenece a ${item.equipmentSlotName}.`);
        return;
      }
      if (!slot.isActive) {
        setAnnouncement(`${slot.name} está desactivada: no admite equipo nuevo.`);
        return;
      }
      setDraft((current) => {
        const next = new Map(current);
        // Un mismo objeto nunca puede ocupar dos ranuras.
        for (const [slotId, existing] of next.entries()) {
          if (existing === ownedItemId) next.delete(slotId);
        }
        next.set(equipmentSlotId, ownedItemId);
        return next;
      });
      setSelectedOwnedItemId(null);
      setAnnouncement(`${item.name} equipado en ${slot.name}. Cambio sin confirmar.`);
    },
    [itemsByOwnedId, slotsById],
  );

  const removeFromSlot = useCallback(
    (equipmentSlotId: string) => {
      const slot = slotsById.get(equipmentSlotId);
      setDraft((current) => {
        const next = new Map(current);
        next.delete(equipmentSlotId);
        return next;
      });
      setAnnouncement(`${slot?.name ?? "Ranura"} vaciada. Cambio sin confirmar.`);
    },
    [slotsById],
  );

  const resetDraft = useCallback(() => {
    setDraft(toDraftMap(confirmedAssignments));
    setSelectedOwnedItemId(null);
    setAnnouncement("Se ha restablecido tu último equipo confirmado.");
  }, [confirmedAssignments]);

  // --- Arrastre con Pointer Events (mouse, tactil y lapiz) --------------------

  const endDrag = useCallback(() => {
    dragOrigin.current = null;
    setDragOwnedItemId(null);
    setHoverSlotId(null);
  }, []);

  const handlePointerDownItem = useCallback((event: React.PointerEvent, ownedItemId: string) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    dragOrigin.current = { x: event.clientX, y: event.clientY, ownedItemId };
  }, []);

  useEffect(() => {
    if (readOnly) return undefined;

    function slotIdAt(x: number, y: number): string | null {
      for (const [slotId, element] of dropTargets.current.entries()) {
        const rect = element.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return slotId;
      }
      return null;
    }

    function onMove(event: PointerEvent) {
      const origin = dragOrigin.current;
      if (!origin) return;
      const moved = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
      if (moved < DRAG_THRESHOLD_PX) return;
      setDragOwnedItemId(origin.ownedItemId);
      setHoverSlotId(slotIdAt(event.clientX, event.clientY));
    }

    function onUp(event: PointerEvent) {
      const origin = dragOrigin.current;
      if (!origin) return;
      const moved = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
      if (moved >= DRAG_THRESHOLD_PX) {
        const slotId = slotIdAt(event.clientX, event.clientY);
        if (slotId) {
          assign(slotId, origin.ownedItemId);
        } else {
          // Soltar fuera de cualquier ranura devuelve el objeto al inventario del borrador.
          setDraft((current) => {
            const next = new Map(current);
            let removed = false;
            for (const [candidate, existing] of next.entries()) {
              if (existing === origin.ownedItemId) {
                next.delete(candidate);
                removed = true;
              }
            }
            if (removed) setAnnouncement("Objeto devuelto al inventario. Cambio sin confirmar.");
            return next;
          });
        }
      }
      endDrag();
    }

    // Listeners globales solo mientras el editor esta montado; siempre se retiran al desmontar.
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [assign, endDrag, readOnly]);

  // Aviso al abandonar la pagina con cambios sin confirmar (seccion 9.8). El listener
  // se retira siempre al desmontar o al dejar de haber cambios.
  useEffect(() => {
    if (!isDirty || readOnly) return undefined;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, readOnly]);

  // --- Composicion -----------------------------------------------------------

  const slotsByPosition = useMemo(() => {
    const map = new Map<EquipmentVisualPosition, EditorSlotView>();
    for (const slot of slots) {
      if (slot.visualPosition) map.set(slot.visualPosition, slot);
    }
    return map;
  }, [slots]);

  const unplacedSlots = useMemo(() => slots.filter((slot) => slot.visualPosition === null), [slots]);

  const registerDropTarget = useCallback(
    (slotId: string) => (element: HTMLElement | null) => {
      if (element) dropTargets.current.set(slotId, element);
      else dropTargets.current.delete(slotId);
    },
    [],
  );

  function renderSlot(slot: EditorSlotView) {
    const ownedItemId = draft.get(slot.equipmentSlotId) ?? null;
    const item = ownedItemId ? itemsByOwnedId.get(ownedItemId) ?? null : null;
    const confirmedItemId = confirmedAssignments.find((a) => a.equipmentSlotId === slot.equipmentSlotId)?.ownedItemId ?? null;
    const changed = ownedItemId !== confirmedItemId;

    const dragItem = dragOwnedItemId ? itemsByOwnedId.get(dragOwnedItemId) ?? null : null;
    const dropState =
      dragItem === null
        ? null
        : hoverSlotId !== slot.equipmentSlotId
          ? null
          : dragItem.equipmentSlotId === slot.equipmentSlotId && slot.isActive
            ? "VALIDO"
            : "INVALIDO";

    return (
      <EquipmentSlotCard
        key={slot.equipmentSlotId}
        splitId={splitId}
        slot={slot}
        item={item}
        state={changed ? "CAMBIO" : item ? "EQUIPADA" : "VACIA"}
        dropState={dropState}
        selectedCompatibleItemName={
          selectedItem && selectedItem.equipmentSlotId === slot.equipmentSlotId ? selectedItem.name : null
        }
        readOnly={readOnly}
        onEquipSelected={() => {
          if (selectedOwnedItemId) assign(slot.equipmentSlotId, selectedOwnedItemId);
        }}
        onRemove={() => removeFromSlot(slot.equipmentSlotId)}
        onPointerDownItem={handlePointerDownItem}
        registerDropTarget={registerDropTarget(slot.equipmentSlotId)}
      />
    );
  }

  const placedCell = (position: EquipmentVisualPosition) => {
    const slot = slotsByPosition.get(position);
    const definition = EQUIPMENT_VISUAL_POSITIONS.find((entry) => entry.position === position)!;
    if (!slot) {
      return (
        <div
          key={position}
          className="flex min-h-[8rem] flex-col justify-center rounded-card border border-dashed border-border bg-surface/60 p-2 text-center text-xs text-text-muted"
        >
          <span className="text-[0.7rem] uppercase tracking-wide">{definition.baseName}</span>
          <span>Sin ranura en este split</span>
        </div>
      );
    }
    return renderSlot(slot);
  };

  const hasAnySlot = slots.length > 0;

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6 lg:space-y-0">
      <div className="space-y-6">
        {!hasAnySlot ? (
          <Alert tone="info">Este split todavía no tiene ninguna ranura de equipo configurada.</Alert>
        ) : (
          <>
            <section aria-label="Tablero de equipo" className="relative">
              <div className="pointer-events-none absolute inset-0 hidden items-center justify-center sm:flex" aria-hidden="true">
                <EquipmentSilhouette className="h-full max-h-[30rem] opacity-[0.07]" />
              </div>
              <EquipmentPositionBoard responsive className="relative" renderCell={placedCell} />
            </section>

            {unplacedSlots.length > 0 && (
              <section aria-labelledby="otras-ranuras" className="space-y-2">
                <h3 id="otras-ranuras" className="text-sm font-semibold text-ink">
                  Otras ranuras
                </h3>
                <p className="text-xs text-text-muted">
                  Ranuras creadas antes de la versión 1.2.0 que el administrador todavía no ha ubicado en el tablero.
                  Funcionan exactamente igual: sus objetos se equipan y sus bonus cuentan con normalidad.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{unplacedSlots.map(renderSlot)}</div>
              </section>
            )}
          </>
        )}

        <section aria-labelledby="inventario-unico" className="space-y-2">
          <h3 id="inventario-unico" className="text-sm font-semibold text-ink">
            Inventario
          </h3>
          <p className="text-xs text-text-muted">
            Arrastra un objeto hasta su ranura compatible, o selecciónalo y pulsa «Equipar aquí». Un objeto equipado
            sigue apareciendo aquí porque sigue siendo tuyo.
          </p>
          <InventoryGrid
            splitId={splitId}
            items={inventory}
            selectedOwnedItemId={selectedOwnedItemId}
            equippedSlotNameByOwnedItemId={equippedSlotNameByOwnedItemId}
            readOnly={readOnly}
            onSelect={(ownedItemId) => {
              setSelectedOwnedItemId((current) => (current === ownedItemId ? null : ownedItemId));
              const item = itemsByOwnedId.get(ownedItemId);
              if (item) {
                setAnnouncement(
                  `${item.name} seleccionado. Ranura compatible: ${item.equipmentSlotName}${
                    item.slotIsActive ? "." : " (desactivada)."
                  }`,
                );
              }
            }}
            onPointerDownItem={handlePointerDownItem}
          />
        </section>
      </div>

      <div className="space-y-3 lg:sticky lg:top-4">
        <EquipmentBonusSummary
          splitId={splitId}
          draftItems={draftItems}
          confirmedItems={confirmedItems}
          profession={profession}
          location={location}
          isDirty={isDirty}
        />

        <section aria-labelledby="estado-equipo" className="space-y-2 rounded-card border border-border bg-surface p-4">
          <h3 id="estado-equipo" className="text-base font-semibold text-ink">
            Tu equipo
          </h3>
          {readOnly ? (
            <Alert tone="info">{readOnlyReason ?? "El equipo es de solo lectura."}</Alert>
          ) : (
            <>
              <p>{isDirty ? <Badge tone="primary">Cambios sin confirmar</Badge> : <Badge tone="success">Equipo confirmado</Badge>}</p>
              <form action={formAction} className="space-y-2">
                {draftAssignments.map((assignment) => (
                  <input
                    key={assignment.equipmentSlotId}
                    type="hidden"
                    name="assignment"
                    value={`${assignment.equipmentSlotId}:${assignment.ownedItemId}`}
                  />
                ))}
                <input type="hidden" name="expectedRevision" value={confirmedRevision} />
                <Button type="submit" variant="primary" disabled={!isDirty} className="w-full">
                  Confirmar equipo
                </Button>
              </form>
              <Button type="button" variant="secondary" disabled={!isDirty} onClick={resetDraft} className="w-full">
                Restablecer cambios
              </Button>
              {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
              {state.ok && !isDirty && <SuccessMessage>Equipo confirmado correctamente.</SuccessMessage>}
              <p className="text-xs text-text-muted">
                El equipo que cuenta para una semana es el confirmado en el instante en que el administrador publica esa
                semana. Un borrador sin confirmar no afecta a ningún resultado.
              </p>
            </>
          )}
        </section>
      </div>

      {/* Region discreta: anuncia el resultado de cada cambio sin interrumpir al lector de pantalla. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <span className="hidden" data-draft-revision={draftRevision} />
    </div>
  );
}
