import type { NewsCategory } from "@prisma/client";

/**
 * Icono (nombre `lucide-react`) y etiqueta accesible de cada categoria de
 * noticia (seccion 23 del encargo): un unico lugar del que dependen tanto
 * la campana como la bandeja `/noticias`.
 */
export const NEWS_CATEGORY_DISPLAY: Record<NewsCategory, { label: string; icon: string }> = {
  SPLIT: { label: "Split", icon: "Layers" },
  PROFILE: { label: "Ficha", icon: "IdCard" },
  RESULTS: { label: "Resultados", icon: "Trophy" },
  FACTION: { label: "Faccion", icon: "Flag" },
  PROFESSION: { label: "Profesion", icon: "Briefcase" },
  LOCATION: { label: "Localizacion", icon: "MapPin" },
  MARKET: { label: "Mercado", icon: "Store" },
  PURCHASE: { label: "Compra", icon: "ShoppingBag" },
  ANNOUNCEMENT: { label: "Anuncio", icon: "Megaphone" },
  ADMIN: { label: "Administracion", icon: "ShieldCheck" },
};

export const NEWS_CATEGORY_OPTIONS: { value: NewsCategory; label: string }[] = (
  Object.keys(NEWS_CATEGORY_DISPLAY) as NewsCategory[]
).map((value) => ({ value, label: NEWS_CATEGORY_DISPLAY[value].label }));
