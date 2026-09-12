import type { NewsCategory } from "@prisma/client";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { listNewsDeliveries, listNewsSplitsForRecipient, type NewsStatusFilter } from "@/server/services/news-inbox.service";
import { NEWS_CATEGORY_OPTIONS } from "@/domain/news-category-display";
import { PageHeader, EmptyState, LinkButton } from "@/components/ui";
import { NewsFilters } from "./NewsFilters";
import { NewsListItemCard } from "./NewsListItemCard";
import { MarkAllReadForm } from "./MarkAllReadForm";

const TABS: { value: NewsStatusFilter; label: string; param: string }[] = [
  { value: "all", label: "Todas", param: "todas" },
  { value: "unread", label: "No leidas", param: "no-leidas" },
  { value: "archived", label: "Archivadas", param: "archivadas" },
];

function statusFromParam(param: string | undefined): NewsStatusFilter {
  if (param === "no-leidas") return "unread";
  if (param === "archivadas") return "archived";
  return "all";
}

function emptyMessageFor(status: NewsStatusFilter): string {
  if (status === "unread") return "No tienes noticias sin leer.";
  if (status === "archived") return "No tienes noticias archivadas.";
  return "Todavía no tienes noticias.";
}

export default async function NoticiasPage({
  searchParams,
}: {
  searchParams: { estado?: string; split?: string; categoria?: string; cursor?: string };
}) {
  const session = await requireSession();
  const identity = { userId: session.user.id, personId: session.user.personId };
  const status = statusFromParam(searchParams.estado);
  const category = NEWS_CATEGORY_OPTIONS.some((option) => option.value === searchParams.categoria)
    ? (searchParams.categoria as NewsCategory)
    : null;

  const [page, splits] = await Promise.all([
    listNewsDeliveries(prisma, identity, { status, splitId: searchParams.split ?? null, category }, searchParams.cursor ?? null),
    listNewsSplitsForRecipient(prisma, identity),
  ]);

  function buildHref(param: string, cursor?: string) {
    const params = new URLSearchParams();
    if (param !== "todas") params.set("estado", param);
    if (searchParams.split) params.set("split", searchParams.split);
    if (searchParams.categoria) params.set("categoria", searchParams.categoria);
    if (cursor) params.set("cursor", cursor);
    const qs = params.toString();
    return `/noticias${qs ? `?${qs}` : ""}`;
  }
  const currentTabParam = TABS.find((tab) => tab.value === status)!.param;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Noticias"
        description="Novedades de tus splits: publicaciones, mercado, facciones, profesiones y avisos de administracion."
        actions={
          session.user.role === "ADMIN" ? (
            <LinkButton href="/noticias/administrar" variant="primary">
              Enviar noticia
            </LinkButton>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <nav className="flex gap-1 rounded-control bg-surface-muted p-1 text-sm font-medium">
          {TABS.map((tab) => (
            <Link
              key={tab.value}
              href={buildHref(tab.param)}
              aria-current={status === tab.value ? "page" : undefined}
              className={`rounded-control px-3 py-1.5 transition-colors duration-150 ${
                status === tab.value ? "bg-surface text-ink shadow-soft" : "text-text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <NewsFilters splits={splits} />
          {status === "unread" && page.items.length > 0 && <MarkAllReadForm />}
        </div>
      </div>

      {page.items.length === 0 ? (
        <EmptyState>{emptyMessageFor(status)}</EmptyState>
      ) : (
        <ul className="space-y-2">
          {page.items.map((item) => (
            <NewsListItemCard key={item.deliveryId} item={item} />
          ))}
        </ul>
      )}

      {page.nextCursor && (
        <div className="pt-2 text-center">
          <Link href={buildHref(currentTabParam, page.nextCursor)} className="text-sm font-medium text-primary hover:text-primary-hover">
            Cargar mas
          </Link>
        </div>
      )}
    </div>
  );
}
