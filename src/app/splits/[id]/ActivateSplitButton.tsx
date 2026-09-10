"use client";

import { useFormState, useFormStatus } from "react-dom";
import { activateSplitAction } from "@/server/actions/split.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage } from "@/components/ui";

function ActivateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Activando..." : "Activar split"}
    </button>
  );
}

export function ActivateSplitButton({ splitId }: { splitId: string }) {
  const activateWithId = activateSplitAction.bind(null, splitId);
  const [state, formAction] = useFormState(activateWithId, initialActionState);

  return (
    <form action={formAction} className="space-y-2">
      <ActivateButton />
      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    </form>
  );
}
