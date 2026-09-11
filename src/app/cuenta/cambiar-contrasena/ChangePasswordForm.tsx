"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { signOut } from "next-auth/react";
import { changeOwnPasswordAction, initialSimpleActionState } from "@/server/actions/auth.actions";
import { ErrorMessage, SuccessMessage, SubmitButton } from "@/components/ui";

function SaveButton() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending}>Guardar nueva contrasena</SubmitButton>;
}

export function ChangePasswordForm() {
  const [state, formAction] = useFormState(changeOwnPasswordAction, initialSimpleActionState);

  useEffect(() => {
    if (state.ok && state.saved) {
      const timeout = setTimeout(() => signOut({ callbackUrl: "/login" }), 1500);
      return () => clearTimeout(timeout);
    }
  }, [state.ok, state.saved]);

  if (state.ok && state.saved) {
    return <SuccessMessage>Contrasena actualizada. Vas a salir para volver a iniciar sesion...</SuccessMessage>;
  }

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <div>
        <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-700">
          Contrasena actual
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700">
          Nueva contrasena
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
          Confirmar nueva contrasena
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <SaveButton />
    </form>
  );
}
