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
      className="rounded-control bg-ink px-3 py-1 text-xs font-medium text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
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
        className="rounded-control bg-ink px-3 py-1 text-xs font-medium text-white hover:bg-ink/90"
      >
        Comprar
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-1">
      <div className="flex items-center gap-2">
        <BuyButton />
        <button type="button" onClick={() => setConfirming(false)} className="text-xs text-text-muted underline">
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
        <span className="text-sm font-medium text-ink">Saldo disponible: {balance} creditos</span>
      </div>
      {marketStatus === "CLOSED" && (
        <p className="text-sm text-text-muted">El mercado esta cerrado: puedes ver el catalogo, pero no comprar.</p>
      )}

      {catalog.length === 0 ? (
        <p className="rounded-card border border-dashed border-border-strong px-4 py-6 text-center text-sm text-text-muted">
          Este split todavía no tiene ningún objeto a la venta.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {catalog.map((item) => (
            <li key={item.storeItemId} className="space-y-1 rounded-md border border-border bg-surface p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="font-medium text-ink">{item.name}</span>
                <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
              </div>
              <p className="text-text-muted">Ranura: {item.equipmentSlotName}</p>
              <p className="text-text-muted">
                {item.kpiName} · +{item.bonusPercent} %
              </p>
              {item.description && <p className="text-text-muted">{item.description}</p>}
              <p className="font-medium text-ink">{item.priceCredits} creditos</p>
              {item.status === "DISPONIBLE" && <BuyForm splitParticipantId={splitParticipantId} item={item} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
