"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import type { SplitDetailNavItem } from "./SplitDetailNav";

/**
 * Version movil/tablet del submenu del split (`1.0.1`, parte G del
 * encargo): un control "Secciones del split" que despliega un panel con las
 * mismas opciones, icono y orden que la columna de escritorio, en vez de
 * la antigua nube de enlaces subrayados. Se cierra al elegir una seccion.
 */
export function SplitDetailMobileNav({ items }: { items: SplitDetailNavItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative mb-4 lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="split-detail-secciones-panel"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 rounded-control border border-border bg-surface-muted px-3 py-2 text-sm font-medium text-ink"
      >
        <span className="flex items-center gap-2">
          <Icon name="ListOrdered" className="h-4 w-4" />
          Secciones del split
        </span>
        <Icon name={open ? "X" : "Menu"} className="h-4 w-4" />
      </button>

      {open && (
        <ul
          id="split-detail-secciones-panel"
          className="absolute z-10 mt-1 max-h-[70vh] w-full overflow-y-auto rounded-card border border-border bg-surface shadow-floating"
        >
          {items.map((item) => (
            <li key={item.href} className="border-b border-border last:border-b-0">
              {item.type === "route" ? (
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface-muted"
                >
                  <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              ) : (
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface-muted"
                >
                  <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                  {item.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
