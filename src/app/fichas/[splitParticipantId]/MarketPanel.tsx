"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { purchaseStoreItemAction } from "@/server/actions/purchase.actions";
import { initialActionState } from "@/server/actions/action-result";
import { Badge, ErrorMessage } from "@/components/ui";
import type { StoreCatalogEntryView } from "@/server/services/character-config.service";

const STATUS_LABEL: Record<StoreCatalogEntryView["status"], string> = {
  YA_LO_TIENES: "Ya lo tienes",
  SALDO_INSUFICIENTE: "Saldo insuficiente",
  DISPONIBLE: "Disponible",
  MERCADO_CERRADO: "Mercado cerrado",
};

const STATUS_TONE: Record<StoreCatalogEntryView["status"], "green" | "amber" | "gray"> = {
  YA_LO_TIENES: "gray",
  SALDO_INSUFICIENTE: "amber",
  DISPONIBLE: "green",
  MERCADO_CERRADO: "gray",
};

function BuyButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Comprando..." : "Comprar"}
    </button>
  );
}

function BuyForm({ splitParticipantId, item }: { splitParticipantId: string; item: StoreCatalogEntryView }) {
  const buyWithIds = purchaseStoreItemAction.bind(null, splitParticipantId, item.storeItemId);
  const [state, formAction] = useFormState(buyWithIds, initialActionState);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700"
      >
        Comprar
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-1">
      <div className="flex items-center gap-2">
        <BuyButton />
        <button type="button" onClick={() => setConfirming(false)} className="text-xs text-slate-500 underline">
          Cancelar
        </button>
      </div>
      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    </form>
  );
}

/** Catalogo de objetos a la venta (`0.9.0` / MVP-2D, parte E del encargo). */
export function MarketPanel({
  splitParticipantId,
  marketStatus,
  balance,
  catalog,
}: {
  splitParticipantId: string;
  marketStatus: "OPEN" | "CLOSED";
  balance: number;
  catalog: StoreCatalogEntryView[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={marketStatus === "OPEN" ? "green" : "gray"}>{marketStatus === "OPEN" ? "Mercado abierto" : "Mercado cerrado"}</Badge>
        <span className="text-sm font-medium text-slate-800">Saldo disponible: {balance} creditos</span>
      </div>
      {marketStatus === "CLOSED" && (
        <p className="text-sm text-slate-500">El mercado esta cerrado: puedes ver el catalogo, pero no comprar.</p>
      )}

      {catalog.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          Este split todavia no tiene ningun objeto a la venta.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {catalog.map((item) => (
            <li key={item.storeItemId} className="space-y-1 rounded-md border border-slate-200 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="font-medium text-slate-800">{item.name}</span>
                <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
              </div>
              <p className="text-slate-600">Ranura: {item.equipmentSlotName}</p>
              <p className="text-slate-600">
                {item.kpiName} · +{item.bonusPercent} %
              </p>
              {item.description && <p className="text-slate-500">{item.description}</p>}
              <p className="font-medium text-slate-800">{item.priceCredits} creditos</p>
              {item.status === "DISPONIBLE" && <BuyForm splitParticipantId={splitParticipantId} item={item} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
