"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { closeMarketAction, openMarketAction } from "@/server/actions/economy.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage } from "@/components/ui";

function ConfirmedSubmitButton({ label, tone }: { label: string; tone: "open" | "close" }) {
  const { pending } = useFormStatus();
  const toneClasses = tone === "open" ? "bg-success hover:bg-success/90" : "bg-danger hover:bg-danger/90";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-control px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${toneClasses}`}
    >
      {pending ? "Guardando..." : label}
    </button>
  );
}

/**
 * Boton de abrir/cerrar mercado, con confirmacion explicita (seccion 8 del
 * encargo, `0.9.0` / MVP-2D). Cuando el mercado esta cerrado y hay problemas
 * de configuracion que impiden abrirlo, se muestran en vez del boton, sin
 * permitir abrir parcialmente.
 */
export function MarketToggleButton({
  splitId,
  marketStatus,
  openIssues,
}: {
  splitId: string;
  marketStatus: "OPEN" | "CLOSED";
  openIssues: string[];
}) {
  const isOpen = marketStatus === "OPEN";
  const action = isOpen ? closeMarketAction : openMarketAction;
  const actionWithId = action.bind(null, splitId);
  const [state, formAction] = useFormState(actionWithId, initialActionState);
  const [confirming, setConfirming] = useState(false);

  if (!isOpen && openIssues.length > 0) {
    return (
      <div className="space-y-2 rounded-md border border-reward/30 bg-reward-soft p-3">
        <p className="text-sm font-medium text-reward-ink">No se puede abrir el mercado todavía:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-reward-ink">
          {openIssues.map((issue, index) => (
            <li key={index}>{issue}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`rounded-control px-4 py-2 text-sm font-medium text-white ${isOpen ? "bg-danger hover:bg-danger/90" : "bg-success hover:bg-success/90"}`}
      >
        {isOpen ? "Cerrar mercado" : "Abrir mercado"}
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-border-strong bg-canvas p-4">
      <p className="text-sm font-medium text-ink">
        {isOpen
          ? "Vas a cerrar el mercado: se bloquearan las nuevas compras. El equipo ya comprado sigue funcionando con normalidad."
          : "Vas a abrir el mercado: los participantes podran comprar los objetos disponibles con su saldo."}
      </p>
      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      <div className="flex gap-2">
        <ConfirmedSubmitButton label={isOpen ? "Confirmar cierre" : "Confirmar apertura"} tone={isOpen ? "close" : "open"} />
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-control border border-border-strong px-4 py-2 text-sm font-medium text-ink hover:bg-surface"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
