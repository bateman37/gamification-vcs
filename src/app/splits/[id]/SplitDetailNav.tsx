"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";

/**
 * Un item de tipo `section` es un ancla a la misma pagina (`href` empieza
 * por `#`): participa en el resaltado por hash/scroll. Un item de tipo
 * `route` navega a otra ruta real (por ejemplo "Presentar resultados",
 * `1.0.2`): nunca participa en el `IntersectionObserver` ni en el
 * resaltado por hash, y nunca lo altera al pulsarlo.
 */
export type SplitDetailNavItem =
  | { type: "section"; href: string; label: string; icon: string }
  | { type: "route"; href: string; label: string; icon: string };

/**
 * Submenu lateral del detalle del split (`1.0.1`, parte G del encargo):
 * columna compacta a la izquierda del contenido del split (a la derecha de
 * la barra global), `sticky` bajo la cabecera superior, con icono y estado
 * activo marcado por color (nunca solo un subrayado). Los enlaces de
 * seccion son anclas HTML normales: funcionan sin JavaScript; el resaltado
 * de la seccion activa (por hash al cargar y por scroll con
 * `IntersectionObserver`) es una mejora progresiva encima de eso. Los
 * enlaces de ruta (`1.0.2`) navegan con `Link` y nunca tocan el hash.
 */
export function SplitDetailNav({ items }: { items: SplitDetailNavItem[] }) {
  const [activeHref, setActiveHref] = useState<string | null>(null);
  const sectionItems = items.filter((item): item is Extract<SplitDetailNavItem, { type: "section" }> => item.type === "section");

  useEffect(() => {
    const targets = sectionItems
      .map((item) => document.getElementById(item.href.slice(1)))
      .filter((element): element is HTMLElement => element !== null);
    if (targets.length === 0) return;

    setActiveHref(window.location.hash || sectionItems[0]?.href || null);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const first = visible[0];
        if (first) {
          setActiveHref(`#${first.target.id}`);
        }
      },
      { rootMargin: "-100px 0px -70% 0px", threshold: 0 },
    );
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `items` es estable (calculado una vez en la pagina servidor).
  }, []);

  return (
    <nav
      aria-label="Secciones del split"
      className="hidden lg:sticky lg:top-20 lg:block lg:w-56 lg:shrink-0 lg:self-start lg:rounded-card lg:border lg:border-border lg:bg-surface-muted lg:p-2"
    >
      <ul className="space-y-0.5">
        {items.map((item) => {
          if (item.type === "route") {
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2 rounded-control px-3 py-2 text-sm text-text-muted transition-colors duration-150 hover:bg-surface hover:text-ink"
                >
                  <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          }
          const active = activeHref === item.href;
          return (
            <li key={item.href}>
              <a
                href={item.href}
                onClick={() => setActiveHref(item.href)}
                aria-current={active ? "true" : undefined}
                className={`flex items-center gap-2 rounded-control px-3 py-2 text-sm transition-colors duration-150 ${
                  active ? "bg-primary-soft font-medium text-primary" : "text-text-muted hover:bg-surface hover:text-ink"
                }`}
              >
                <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
