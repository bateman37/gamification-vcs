"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useRef } from "react";
import { createPersonAction } from "@/server/actions/person.actions";
import { initialActionState } from "@/server/actions/action-result";
import { ErrorMessage, FieldError, SubmitButton, SuccessMessage } from "@/components/ui";

function SubmitPersonButton() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending}>Crear persona</SubmitButton>;
}

export function PersonCreateForm() {
  const [state, formAction] = useFormState(createPersonAction, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasSubmitted = useRef(false);

  useEffect(() => {
    if (state.ok && wasSubmitted.current) {
      formRef.current?.reset();
    }
    if (state.ok || state.error) {
      wasSubmitted.current = false;
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={() => {
        wasSubmitted.current = true;
      }}
      className="space-y-3 rounded-card border border-border bg-surface p-4"
    >
      <h2 className="text-base font-semibold">Nueva persona</h2>
      <div>
        <label htmlFor="fullName" className="block text-sm font-medium text-ink">
          Nombre completo
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
        />
        <FieldError message={state.fieldErrors?.fullName} />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink">
          Correo (opcional)
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
        />
        <FieldError message={state.fieldErrors?.email} />
      </div>
      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {state.ok && <SuccessMessage>Persona creada correctamente.</SuccessMessage>}
      <SubmitPersonButton />
    </form>
  );
}
