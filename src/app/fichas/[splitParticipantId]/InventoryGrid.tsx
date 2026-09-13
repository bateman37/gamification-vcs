"use client";

import { Badge, EmptyState } from "@/components/ui";
import { StoreItemImage } from "@/components/equipment/StoreItemImage";
import type { EditorItemView } from "./equipment-view";

/**
 * Inventario unico del participante en este split (`1.2.0`, seccion 8.6 del
 * encargo). Un objeto equipado sigue apareciendo aqui porque sigue siendo
 * suyo: la posesion no se duplica, el badge explica donde esta equipado.
 *
 * Sin botones de vender, regalar, intercambiar ni destruir: esas operaciones
 * no existen en el producto.
 */
export function InventoryGrid({
  splitId,
  items,
  selectedOwnedItemId,
  equippedSlotNameByOwnedItemId,
  readOnly,
  onSelect,
  onPointerDownItem,
}: {
  splitId: string;
  items: EditorItemView[];
  selectedOwnedItemId: string | null;
  /** Ranura del borrador en la que esta equipado cada objeto, si lo esta. */
  equippedSlotNameByOwnedItemId: Map<string, string>;
  readOnly: boolean;
  onSelect: (ownedItemId: string) => void;
  onPointerDownItem: (event: React.PointerEvent, ownedItemId: string) => void;
}) {
  if (items.length === 0) {
    return <EmptyState>Todavía no has comprado ningún objeto en este split.</EmptyState>;
  }

  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const equippedIn = equippedSlotNameByOwnedItemId.get(item.ownedItemId) ?? null;
        const selected = selectedOwnedItemId === item.ownedItemId;
        return (
          <li key={item.ownedItemId}>
            <button
              type="button"
              disabled={readOnly}
              aria-pressed={selected}
              onClick={() => onSelect(item.ownedItemId)}
              onPointerDown={(event) => {
                if (!readOnly) onPointerDownItem(event, item.ownedItemId);
              }}
              className={`flex w-full min-h-[44px] items-start gap-3 rounded-card border p-3 text-left text-xs transition-colors duration-150 ${
                selected ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-surface-muted"
              } ${readOnly ? "cursor-not-allowed opacity-70" : "touch-none"}`}
            >
              <StoreItemImage
                splitId={splitId}
                storeItemId={item.storeItemId}
                imageVersion={item.imageVersion}
                itemName={item.name}
                visualPosition={item.visualPosition}
                decorative
              />
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="block truncate text-sm font-medium text-ink">{item.name}</span>
                <span className="block text-text-muted">Ranura: {item.equipmentSlotName}</span>
                <span className="block text-text-muted">
                  {item.kpiName} · <span className="tabular">+{item.bonusPercent} %</span>
                </span>
                <span className="block text-text-muted">
                  Comprado el {item.acquiredAtLabel} por <span className="tabular">{item.priceCredits}</span> créditos.
                </span>
                <span className="flex flex-wrap gap-1 pt-1">
                  {equippedIn && <Badge tone="success">Equipado en {equippedIn}</Badge>}
                  {!item.slotIsActive && <Badge tone="gray">Ranura desactivada</Badge>}
                  {selected && <Badge tone="primary">Seleccionado</Badge>}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
