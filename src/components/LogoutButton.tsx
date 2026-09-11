"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-sm font-medium text-slate-600 hover:text-slate-900"
    >
      Cerrar sesion
    </button>
  );
}
