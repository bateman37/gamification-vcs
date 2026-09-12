"use client";

import { signOut } from "next-auth/react";

export function LogoutButton({ className = "text-sm font-medium text-slate-600 hover:text-slate-900" }: { className?: string }) {
  return (
    <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className={className}>
      Cerrar sesion
    </button>
  );
}
