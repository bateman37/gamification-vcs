"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { SidebarNav } from "@/components/SidebarNav";
import { LogoutButton } from "@/components/LogoutButton";
import { BrandMark } from "@/components/BrandMark";
import type { NavItem } from "@/components/nav-items";

/**
 * Menu movil/tablet (seccion 13 del encargo): cabecera compacta con marca,
 * campana y boton de menu; el propio boton vive en `AppShell` para poder
 * colocar la campana entre la marca y el menu. Este componente es solo el
 * drawer: cerrable con teclado (`Escape`) y sin bloquear el scroll despues
 * de cerrarse.
 */
export function MobileNav({ items, isAuthenticated }: { items: NavItem[]; isAuthenticated: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Cerrar menu" : "Abrir menu"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-control text-text-muted hover:bg-surface-muted hover:text-ink md:hidden"
      >
        <Icon name={open ? "X" : "Menu"} className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" aria-label="Cerrar menu" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-ink px-4 py-5">
            <div className="mb-6 flex items-center gap-2">
              <BrandMark variant="dark" />
              <span className="text-sm font-semibold text-white">Gamification VCS</span>
            </div>
            <SidebarNav items={items} onNavigate={() => setOpen(false)} />
            <div className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-4 text-sm">
              {isAuthenticated ? (
                <>
                  <Link href="/cuenta/cambiar-contrasena" className="text-white/70 hover:text-white" onClick={() => setOpen(false)}>
                    Mi cuenta
                  </Link>
                  <LogoutButton className="text-left text-white/70 hover:text-white" />
                </>
              ) : (
                <Link href="/login" className="text-white/70 hover:text-white" onClick={() => setOpen(false)}>
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
