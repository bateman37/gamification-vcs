import { formatCalendarDateEs } from "@/lib/dates";
import { formatRelativeTimeEs } from "@/lib/relative-time";
import { NEWS_CATEGORY_DISPLAY } from "@/domain/news-category-display";
import { NewsCategoryIcon } from "@/components/NewsCategoryIcon";
import { Badge } from "@/components/ui";
import type { NewsListItem } from "@/server/services/news-inbox.service";
import { archiveNewsAction, markNewsReadAction, markNewsUnreadAction, openNewsAction, restoreNewsAction } from "@/server/actions/news.actions";

/**
 * Tarjeta de una entrega en la bandeja `/noticias` (seccion 23 del
 * encargo). Las acciones son formularios ligados directamente a Server
 * Actions: funcionan sin JavaScript en el cliente.
 */
export function NewsListItemCard({ item }: { item: NewsListItem }) {
  const category = NEWS_CATEGORY_DISPLAY[item.category];

  return (
    <li
      className={`rounded-card border p-4 ${
        item.isArchived ? "border-border bg-surface-muted/60 opacity-80" : item.isUnread ? "border-primary/30 bg-primary-soft" : "border-border bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 shrink-0 text-text-muted" title={category.label}>
            <NewsCategoryIcon icon={category.icon} />
            <span className="sr-only">{category.label}</span>
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {item.isUnread && !item.isArchived && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
              <span className={`text-sm ${item.isUnread ? "font-semibold text-ink" : "text-ink"}`}>{item.title}</span>
              {item.priority === "IMPORTANT" && <Badge tone="reward">Importante</Badge>}
            </div>
            <p className="text-sm text-text-muted">{item.body}</p>
            <p className="text-xs text-text-muted">
              {item.splitName && <span>{item.splitName} · </span>}
              <span title={item.createdAt.toLocaleString("es-ES")}>{formatRelativeTimeEs(item.createdAt)}</span>
              <span className="hidden sm:inline"> · {formatCalendarDateEs(item.createdAt)}</span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {item.actionPath && (
            <form action={openNewsAction.bind(null, item.deliveryId, item.actionPath)}>
              <button type="submit" className="text-sm font-medium text-primary hover:text-primary-hover">
                Ver detalle
              </button>
            </form>
          )}
          {item.isUnread ? (
            <form action={markNewsReadAction.bind(null, item.deliveryId)}>
              <button type="submit" className="rounded-control border border-border-strong px-2 py-1 text-xs font-medium text-ink hover:bg-surface-muted">
                Marcar como leida
              </button>
            </form>
          ) : (
            <form action={markNewsUnreadAction.bind(null, item.deliveryId)}>
              <button type="submit" className="rounded-control border border-border-strong px-2 py-1 text-xs font-medium text-ink hover:bg-surface-muted">
                Marcar como no leida
              </button>
            </form>
          )}
          {item.isArchived ? (
            <form action={restoreNewsAction.bind(null, item.deliveryId)}>
              <button type="submit" className="rounded-control border border-border-strong px-2 py-1 text-xs font-medium text-ink hover:bg-surface-muted">
                Restaurar
              </button>
            </form>
          ) : (
            <form action={archiveNewsAction.bind(null, item.deliveryId)}>
              <button type="submit" className="rounded-control border border-border-strong px-2 py-1 text-xs font-medium text-ink hover:bg-surface-muted">
                Archivar
              </button>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}
