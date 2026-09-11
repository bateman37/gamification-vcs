"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createParticipantAccountAction,
  setAccountActiveAction,
  setTemporaryPasswordAction,
} from "@/server/actions/auth.actions";
import { initialSimpleActionState } from "@/server/actions/action-state";
import { Badge, FieldError, SubmitButton } from "@/components/ui";
import type { PersonWithAccount } from "@/server/services/auth.service";

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending}>{label}</SubmitButton>;
}

function CreateAccountForm({ personId }: { personId: string }) {
  const [open, setOpen] = useState(false);
  const createWithId = createParticipantAccountAction.bind(null);
  const [state, formAction] = useFormState(createWithId, initialSimpleActionState);

  if (state.ok && state.saved) {
    return <Badge tone="green">Cuenta creada</Badge>;
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-slate-600 underline hover:text-slate-900">
        Crear cuenta
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="personId" value={personId} />
      <input
        type="email"
        name="email"
        required
        placeholder="Correo de la cuenta"
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
      />
      <input
        type="password"
        name="temporaryPassword"
        required
        minLength={8}
        placeholder="Contrasena temporal (min. 8)"
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
      />
      {!state.ok && state.error && <FieldError message={state.error} />}
      <div className="flex gap-2">
        <SaveButton label="Crear" />
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 underline">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ResetPasswordForm({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const resetWithId = setTemporaryPasswordAction.bind(null);
  const [state, formAction] = useFormState(resetWithId, initialSimpleActionState);

  if (state.ok && state.saved) {
    return <span className="text-xs text-green-700">Contrasena restablecida</span>;
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-slate-600 underline hover:text-slate-900">
        Restablecer contrasena
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <input
        type="password"
        name="temporaryPassword"
        required
        minLength={8}
        placeholder="Nueva contrasena temporal"
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
      />
      {!state.ok && state.error && <FieldError message={state.error} />}
      <div className="flex gap-2">
        <SaveButton label="Guardar" />
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 underline">
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function PersonAccountCell({ personId, account }: { personId: string; account: PersonWithAccount["account"] }) {
  if (!account) {
    return <CreateAccountForm personId={personId} />;
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-xs text-slate-600">{account.email}</span>
        <Badge tone={account.isActive ? "green" : "gray"}>{account.isActive ? "Activa" : "Inactiva"}</Badge>
        {account.mustChangePassword && <Badge tone="amber">Debe cambiar contrasena</Badge>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <form action={setAccountActiveAction.bind(null, account.id, !account.isActive)}>
          <button type="submit" className="text-xs font-medium text-slate-600 underline hover:text-slate-900">
            {account.isActive ? "Desactivar" : "Activar"}
          </button>
        </form>
        <ResetPasswordForm userId={account.id} />
      </div>
    </div>
  );
}
