"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

/** Contexto de sesion de NextAuth, necesario para `useSession`/`signIn`/`signOut` en componentes cliente. */
export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
