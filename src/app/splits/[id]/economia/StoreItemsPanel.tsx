"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createStoreItemAction,
  deleteStoreItemAction,
  setStoreItemForSaleAction,
  updateStoreItemAction,
} from "@/server/actions/store-item.actions";
import { initialActionState } from "@/server/actions/action-result";
import { Badge, ErrorMessage, SubmitButton, SuccessMessage } from "@/components/ui";
import type { KpiCode } from "@/domain/kpis/catalog";
import { StoreItemFormFields } from "./StoreItemFormFields";

export interface StoreItemRow {
  id: string;
  name: string;
  description: string | null;
  priceCredits: number;
  equipmentSlotId: string;
  equipmentSlotName: string;
  kpiCode: KpiCode;
  kpiName: string;
  bonusPercent: number;
  isForSale: boolean;
  ownedCount: number;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending}>Guardar</SubmitButton>;
}

function ItemCard({
  splitId,
  item,
  locked,
  activeKpis,
  slots,
}: {
  splitId: string;
  item: StoreItemRow;
  locked: boolean;
  activeKpis: { code: KpiCode; name: string }[];
  slots: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const updateWithIds = updateStoreItemAction.bind(null, splitId, item.id);
  const [updateState, updateAction] = useFormState(updateWithIds, initialActionState);
  const forSaleWithIds = setStoreItemForSaleAction.bind(null, splitId, item.id, !item.isForSale);
  const [forSaleState, forSaleAction] = useFormState(forSaleWithIds, initialActionState);
  const deleteWithIds = deleteStoreItemAction.bind(null, splitId, item.id);
  const [deleteState, deleteAction] = useFormState(deleteWithIds, initialActionState);

  const purchased = item.ownedCount > 0;
  const canEditOrDelete = !locked && !purchased;

  if (editing && canEditOrDelete) {
    return (
      <div className="space-y-3 rounded-card border border-border bg-surface p-4">
        <form action={updateAction} className="space-y-3">
          <StoreItemFormFields
            idPrefix={`item-${item.id}`}
            defaults={{
              name: item.name,
              description: item.description ?? "",
              priceCredits: item.priceCredits,
              equipmentSlotId: item.equipmentSlotId,
              kpiCode: item.kpiCode,
              bonusPercent: item.bonusPercent,
            }}
            fieldErrors={updateState.fieldErrors}
            activeKpis={activeKpis}
            slots={slots}
          />
          <div className="flex flex-wrap gap-2">
            <SaveButton />
            <button type="button" onClick={() => setEditing(false)} className="rounded-control border border-border-strong px-3 py-2 text-sm">
              Cancelar
            </button>
          </div>
        </form>
        {!updateState.ok && updateState.error && <ErrorMessage>{updateState.error}</ErrorMessage>}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-ink">{item.name}</p>
          <p className="text-sm text-text-muted">Ranura: {item.equipmentSlotName}</p>
          <p className="text-sm text-text-muted">Potencia: {item.kpiName}</p>
          <p className="text-sm text-text-muted">Bonus: +{item.bonusPercent} % después del máximo base</p>
          <p className="text-sm text-text-muted">Precio: {item.priceCredits} créditos</p>
          {item.description && <p className="mt-1 text-sm text-text-muted">{item.description}</p>}
        </div>
        <Badge tone={item.isForSale ? "green" : "gray"}>{item.isForSale ? "A la venta" : "Retirado"}</Badge>
      </div>
      <p className="text-xs text-text-muted">
        {item.ownedCount} participante{item.ownedCount === 1 ? "" : "s"} lo posee{item.ownedCount === 1 ? "" : "n"}.
      </p>

      {!locked && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <button
            type="button"
            disabled={!canEditOrDelete}
            title={purchased ? "Ya lo ha comprado algun participante: crea un objeto nuevo para una variante distinta." : undefined}
            onClick={() => setEditing(true)}
            className="rounded-control border border-border-strong px-3 py-1 text-xs font-medium text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            Editar
          </button>
          <form action={forSaleAction}>
            <button type="submit" className="rounded-control border border-border-strong px-3 py-1 text-xs font-medium text-ink hover:bg-surface-muted">
              {item.isForSale ? "Retirar de la venta" : "Reponer a la venta"}
            </button>
          </form>
          <form action={deleteAction}>
            <button
              type="submit"
              disabled={purchased}
              title={purchased ? "No se puede eliminar: ya lo ha comprado algun participante." : undefined}
              className="rounded-control border border-danger/30 px-3 py-1 text-xs font-medium text-danger-ink hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              Eliminar
            </button>
          </form>
        </div>
      )}
      {!forSaleState.ok && forSaleState.error && <ErrorMessage>{forSaleState.error}</ErrorMessage>}
      {!deleteState.ok && deleteState.error && <ErrorMessage>{deleteState.error}</ErrorMessage>}
    </div>
  );
}

/** Catalogo de objetos del split (`0.9.0` / MVP-2D, secciones 12-15 del encargo). */
export function StoreItemsPanel({
  splitId,
  items,
  locked,
  activeKpis,
  slots,
}: {
  splitId: string;
  items: StoreItemRow[];
  locked: boolean;
  activeKpis: { code: KpiCode; name: string }[];
  slots: { id: string; name: string }[];
}) {
  const createWithId = createStoreItemAction.bind(null, splitId);
  const [createState, createAction] = useFormState(createWithId, initialActionState);

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold">Catalogo de objetos</h3>
      <p className="text-sm text-text-muted">
        Cada objeto afecta exactamente a un KPI activo con un bonus del conjunto cerrado (10/20/30/40/50 %), y
        pertenece a una unica ranura. Solo se administra con el mercado cerrado; despues de la primera compra, el
        objeto queda inmutable salvo retirarlo o reponerlo a la venta.
      </p>
      {locked && <p className="text-sm text-reward-ink">Cierra el mercado para crear, editar o eliminar objetos.</p>}
      {slots.length === 0 && (
        <p className="rounded-card border border-dashed border-border-strong px-4 py-4 text-sm text-text-muted">
          Crea al menos una ranura de equipo antes de añadir objetos.
        </p>
      )}
      {activeKpis.length === 0 && (
        <p className="rounded-card border border-dashed border-border-strong px-4 py-4 text-sm text-text-muted">
          Activa al menos un KPI en &quot;KPI del split&quot; antes de añadir objetos.
        </p>
      )}

      {items.length === 0 ? (
        <p className="rounded-card border border-dashed border-border-strong px-4 py-6 text-center text-sm text-text-muted">
          Todavía no hay ningún objeto en el catálogo.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <ItemCard key={item.id} splitId={splitId} item={item} locked={locked} activeKpis={activeKpis} slots={slots} />
          ))}
        </div>
      )}

      {!locked && slots.length > 0 && activeKpis.length > 0 && (
        <form action={createAction} className="space-y-3 rounded-card border border-dashed border-border-strong bg-surface p-4">
          <h4 className="text-sm font-semibold text-ink">Nuevo objeto</h4>
          <StoreItemFormFields idPrefix="item-new" activeKpis={activeKpis} slots={slots} />
          <SaveButton />
          {!createState.ok && createState.error && <ErrorMessage>{createState.error}</ErrorMessage>}
          {createState.ok && <SuccessMessage>Objeto creado correctamente.</SuccessMessage>}
        </form>
      )}
    </div>
  );
}
