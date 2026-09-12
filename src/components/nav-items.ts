export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

/**
 * Navegacion por rol (seccion 13 del encargo). Unica fuente para la barra
 * lateral de escritorio y el drawer movil, para que ambas ensenen siempre
 * los mismos enlaces.
 */
export function buildNavItems(input: { isAuthenticated: boolean; isAdmin: boolean; hasPersonId: boolean }): NavItem[] {
  if (!input.isAuthenticated) return [];

  const items: NavItem[] = [];
  if (input.isAdmin) {
    items.push({ href: "/noticias", label: "Noticias", icon: "Newspaper" });
    items.push({ href: "/personas", label: "Personas", icon: "Users" });
    items.push({ href: "/splits", label: "Splits", icon: "Layers" });
    items.push({ href: "/resultados", label: "Resultados", icon: "Trophy" });
    items.push({ href: "/analitica", label: "Analítica avanzada", icon: "BarChart3" });
    if (input.hasPersonId) {
      items.push({ href: "/fichas", label: "Fichas", icon: "IdCard" });
    }
    return items;
  }

  items.push({ href: "/noticias", label: "Noticias", icon: "Newspaper" });
  items.push({ href: "/resultados", label: "Resultados", icon: "Trophy" });
  items.push({ href: "/fichas", label: "Fichas", icon: "IdCard" });
  return items;
}
