import type { ReactNode } from "react";
import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { countUnreadNews, previewRecentNews } from "@/server/services/news-inbox.service";
import { NEWS_CATEGORY_DISPLAY } from "@/domain/news-category-display";
import { formatRelativeTimeEs } from "@/lib/relative-time";
import { BrandMark } from "@/components/BrandMark";
import { SidebarNav } from "@/components/SidebarNav";
import { MobileNav } from "@/components/MobileNav";
import { NewsBell, type NewsBellPreviewItem } from "@/components/NewsBell";
import { LogoutButton } from "@/components/LogoutButton";
import { buildNavItems } from "@/components/nav-items";

/**
 * App shell del sistema visual "Prisma competitivo" (seccion 13 del
 * encargo): barra lateral tinta estable en escritorio, cabecera compacta
 * con campana en movil/tablet. Toda la navegacion condicionada por rol se
 * calcula aqui una sola vez a partir de la sesion real.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();
  const isAuthenticated = Boolean(session?.user);
  const isAdmin = session?.user.role === "ADMIN";
  const hasPersonId = Boolean(session?.user.personId);
  const items = buildNavItems({ isAuthenticated, isAdmin, hasPersonId });

  let unreadCount = 0;
  let previewItems: NewsBellPreviewItem[] = [];
  if (session?.user) {
    const identity = { userId: session.user.id, personId: session.user.personId };
    const now = new Date();
    const [count, preview] = await Promise.all([countUnreadNews(prisma, identity), previewRecentNews(prisma, identity)]);
    unreadCount = count;
    previewItems = preview.map((item) => ({
      deliveryId: item.deliveryId,
      title: item.title,
      body: item.body,
      categoryIcon: NEWS_CATEGORY_DISPLAY[item.category].icon,
      categoryLabel: NEWS_CATEGORY_DISPLAY[item.category].label,
      isUnread: item.isUnread,
      actionPath: item.actionPath,
      relativeTime: formatRelativeTimeEs(item.createdAt, now),
      fullDate: item.createdAt.toLocaleString("es-ES"),
    }));
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      {isAuthenticated && (
        <aside className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:shrink-0 md:flex-col md:bg-ink md:px-4 md:py-5">
          <Link href="/noticias" className="mb-6 flex shrink-0 items-center gap-2 px-1">
            <BrandMark variant="dark" />
            <span className="text-sm font-semibold text-white">Gamification VCS</span>
          </Link>
          {/* Solo esta zona (los enlaces) puede necesitar scroll propio en alturas/zoom extremos;
              el pie ("Mi cuenta"/"Cerrar sesión") sigue siempre visible, nunca se desplaza fuera
              de la pantalla (seccion 14 del encargo `1.0.1`). */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SidebarNav items={items} />
          </div>
          <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-white/10 pt-4 text-sm">
            <Link href="/cuenta/cambiar-contrasena" className="text-white/70 hover:text-white">
              Mi cuenta
            </Link>
            <LogoutButton className="text-left text-white/70 hover:text-white" />
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6 lg:px-10">
          <div className={isAuthenticated ? "flex items-center gap-2 md:hidden" : "flex items-center gap-2"}>
            <BrandMark />
            <span className="text-sm font-semibold text-ink">Gamification VCS</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isAuthenticated && <NewsBell unreadCount={unreadCount} previewItems={previewItems} />}
            {isAuthenticated ? (
              <MobileNav items={items} isAuthenticated={isAuthenticated} />
            ) : (
              <Link href="/login" className="text-sm font-medium text-text-muted hover:text-ink">
                Login
              </Link>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1920px] flex-1 px-4 py-8 sm:px-6 lg:px-10 2xl:px-16">{children}</main>
      </div>
    </div>
  );
}
