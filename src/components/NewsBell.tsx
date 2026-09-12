"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { NewsCategoryIcon } from "@/components/NewsCategoryIcon";
import { markAllNewsReadAction, openNewsAction } from "@/server/actions/news.actions";

export interface NewsBellPreviewItem {
  deliveryId: string;
  title: string;
  body: string;
  categoryIcon: string;
  categoryLabel: string;
  isUnread: boolean;
  actionPath: string | null;
  relativeTime: string;
  fullDate: string;
}

/**
 * Campana global (seccion 21/22 del encargo): contador de no leidas y
 * archivadas excluidas, vista previa de las cinco mas recientes, enlace a
 * `/noticias`. No hace polling: los datos llegan ya calculados en servidor
 * y se refrescan al navegar o tras una accion propia (`revalidatePath`).
 */
export function NewsBell({ unreadCount, previewItems }: { unreadCount: number; previewItems: NewsBellPreviewItem[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const counterLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Noticias, ${unreadCount} sin leer` : "Noticias"}
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-control text-text-muted transition-colors duration-150 hover:bg-surface-muted hover:text-ink"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-[18px] text-white">
            {counterLabel}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-card border border-border bg-surface shadow-floating">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-ink">Noticias</span>
            <button
              type="button"
              disabled={isPending || unreadCount === 0}
              onClick={() => startTransition(async () => { await markAllNewsReadAction(); })}
              className="text-xs font-medium text-primary hover:text-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Marcar todas como leidas
            </button>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {previewItems.length === 0 && <li className="px-4 py-6 text-center text-sm text-text-muted">No tienes noticias.</li>}
            {previewItems.map((item) => (
              <li key={item.deliveryId} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(async () => { await openNewsAction(item.deliveryId, item.actionPath); })}
                  className={`flex w-full gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-muted ${item.isUnread ? "bg-primary-soft" : ""}`}
                >
                  <span className="mt-0.5 shrink-0 text-text-muted">
                    <NewsCategoryIcon icon={item.categoryIcon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {item.isUnread && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                      <span className={`truncate text-sm ${item.isUnread ? "font-semibold text-ink" : "text-ink"}`}>{item.title}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-text-muted">{item.body}</span>
                    <span className="mt-0.5 block text-[11px] text-text-muted" title={item.fullDate}>
                      {item.relativeTime}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-4 py-2 text-center">
            <Link href="/noticias" className="text-xs font-medium text-primary hover:text-primary-hover" onClick={() => setOpen(false)}>
              Ver todas las noticias
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
