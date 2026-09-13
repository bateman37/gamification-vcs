"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { finalizeSplitAction } from "@/server/actions/finalize-split.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage } from "@/components/ui";

function ConfirmedSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-control bg-success px-4 py-2 text-sm font-medium text-white hover:bg-success/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Finalizando..." : "Confirmar finalización"}
    </button>
  );
}

/**
 * "Finalizar split" (`1.2.2`, seccion 7.2 del encargo): solo se muestra
 * cuando todas las semanas ya estan publicadas. Exige confirmacion
 * explicita, deshabilita el envio mientras se procesa y evita el doble
 * envio (mismo patron que `PublishWeekButton`).
 */
export function FinalizeSplitButton({ splitId }: { splitId: string }) {
  const finalizeWithId = finalizeSplitAction.bind(null, splitId);
  const [state, formAction] = useFormState(finalizeWithId, initialActionState);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-control bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90"
      >
        Finalizar split
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-reward/30 bg-reward-soft p-4">
      <p className="text-sm font-medium text-reward-ink">
        Vas a finalizar este split. Quedará en solo lectura, el mercado se cerrará y se enviará la
        noticia final con el podio, la facción ganadora (si aplica) y los ganadores de cada KPI. Esta
        acción no se puede deshacer en esta versión.
      </p>
      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      <div className="flex gap-2">
        <ConfirmedSubmitButton />
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
