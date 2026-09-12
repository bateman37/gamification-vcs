"use client";

import { signOut } from "next-auth/react";

export function LogoutButton({ className = "text-sm font-medium text-text-muted hover:text-ink" }: { className?: string }) {
  return (
    <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className={className}>
      Cerrar sesion
    </button>
  );
}
