"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createProfessionAction } from "@/server/actions/profession.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage, SubmitButton, SuccessMessage } from "@/components/ui";
import { ProfessionFormFields } from "./ProfessionFormFields";

function CreateProfessionButton() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending}>Crear profesion</SubmitButton>;
}

export function ProfessionCreateForm({ splitId }: { splitId: string }) {
  const createWithId = createProfessionAction.bind(null, splitId);
  const [state, formAction] = useFormState(createWithId, initialActionState);

  return (
    <form action={formAction} className="space-y-3 rounded-card border border-dashed border-border-strong bg-surface p-4">
      <h3 className="text-sm font-semibold text-ink">Nueva profesion</h3>
      <ProfessionFormFields idPrefix="profession-new" fieldErrors={state.fieldErrors} />
      <CreateProfessionButton />
      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {state.ok && <SuccessMessage>Profesion creada correctamente.</SuccessMessage>}
    </form>
  );
}
