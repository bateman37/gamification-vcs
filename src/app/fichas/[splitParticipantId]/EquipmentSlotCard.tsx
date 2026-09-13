"use client";

import { Badge } from "@/components/ui";
import { StoreItemImage } from "@/components/equipment/StoreItemImage";
import type { EditorItemView, EditorSlotView } from "./equipment-view";

/**
 * Tarjeta de una ranura del tablero (`1.2.0`, seccion 8.5 del encargo).
 *
 * Siempre HTML accesible: nombre configurado por el administrador,
 * miniatura o icono neutro, nombre del objeto, KPI potenciado, porcentaje,
 * estado (`Vacía`, `Equipada`, `Cambio sin confirmar`) y controles reales.
 * Ningun estado depende solo del color: todos llevan texto ademas del tono.
 */
export function EquipmentSlotCard({
  splitId,
  slot,
  item,
  state,
  dropState,
  selectedCompatibleItemName,
  readOnly,
  onEquipSelected,
  onRemove,
  onPointerDownItem,
  registerDropTarget,
}: {
  splitId: string;
  slot: EditorSlotView;
  item: EditorItemView | null;
  state: "VACIA" | "EQUIPADA" | "CAMBIO";
  /** `null` = no hay arrastre en curso. */
  dropState: "VALIDO" | "INVALIDO" | null;
  /** Nombre del objeto seleccionado por clic/teclado si es compatible con esta ranura. */
  selectedCompatibleItemName: string | null;
  readOnly: boolean;
  onEquipSelected: () => void;
  onRemove: () => void;
  onPointerDownItem: (event: React.PointerEvent, ownedItemId: string) => void;
  registerDropTarget: (element: HTMLElement | null) => void;
}) {
  const borderClass = !slot.isActive
    ? "border-border bg-surface-muted"
    : dropState === "VALIDO"
      ? "border-info bg-info-soft"
      : dropState === "INVALIDO"
        ? "border-danger bg-danger-soft"
        : state === "CAMBIO"
          ? "border-primary bg-primary-soft/50"
          : state === "EQUIPADA"
            ? "border-primary/40 bg-surface"
            : "border-dashed border-border-strong bg-surface";

  return (
    <div
      ref={registerDropTarget}
      data-slot-id={slot.equipmentSlotId}
      className={`flex min-h-[8rem] flex-col gap-1 rounded-card border p-2 text-xs transition-colors duration-150 ${borderClass}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="font-medium text-ink">{slot.name}</span>
        {!slot.isActive && <Badge tone="gray">Ranura desactivada</Badge>}
      </div>

      {item ? (
        <div
          className={`flex items-start gap-2 ${readOnly ? "" : "cursor-grab touch-none"}`}
          onPointerDown={(event) => {
            if (!readOnly) onPointerDownItem(event, item.ownedItemId);
          }}
        >
          <StoreItemImage
            splitId={splitId}
            storeItemId={item.storeItemId}
            imageVersion={item.imageVersion}
            itemName={item.name}
            visualPosition={slot.visualPosition}
            size="sm"
            decorative
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{item.name}</p>
            <p className="truncate text-text-muted">{item.kpiName}</p>
            <p className="tabular text-text-muted">+{item.bonusPercent} %</p>
          </div>
        </div>
      ) : (
        <p className="text-text-muted">Vacía</p>
      )}

      <p className="mt-auto">
        {state === "CAMBIO" ? (
          <Badge tone="primary">Cambio sin confirmar</Badge>
        ) : state === "EQUIPADA" ? (
          <Badge tone="success">Equipada</Badge>
        ) : (
          <Badge tone="slate">Vacía</Badge>
        )}
      </p>

      {!readOnly && (
        <div className="space-y-1">
          {selectedCompatibleItemName && slot.isActive && (
            <button
              type="button"
              onClick={onEquipSelected}
              className="w-full rounded-control bg-primary px-2 py-1 text-xs font-medium text-white transition-colors duration-150 hover:bg-primary-hover"
            >
              Equipar aquí
            </button>
          )}
          {item && (
            <button
              type="button"
              onClick={onRemove}
              className="w-full rounded-control border border-border-strong px-2 py-1 text-xs font-medium text-ink transition-colors duration-150 hover:bg-surface-muted"
            >
              Quitar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
