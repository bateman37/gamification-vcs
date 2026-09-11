"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { publishWeekAction } from "@/server/actions/publish.actions";
import { initialSimpleActionState } from "@/server/actions/action-state";
import { ErrorMessage } from "@/components/ui";

function ConfirmedSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Publicando..." : "Confirmar publicacion"}
    </button>
  );
}

export function PublishWeekButton({ splitId, weekId }: { splitId: string; weekId: string }) {
  const publishWithIds = publishWeekAction.bind(null, splitId, weekId);
  const [state, formAction] = useFormState(publishWithIds, initialSimpleActionState);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Publicar semana
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">
        Vas a publicar esta semana. Una vez publicada no podra modificarse ni despublicarse en esta version.
      </p>
      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      <div className="flex gap-2">
        <ConfirmedSubmitButton />
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
