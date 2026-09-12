import { describe, expect, it } from "vitest";
import { NEWS_CATEGORY_DISPLAY } from "@/domain/news-category-display";
import { PROFESSION_BONUS_LABEL } from "@/domain/profession-bonus";
import { locationBonusLabel } from "@/domain/location-bonus";
import { SPLIT_STATUS_LABELS } from "@/lib/labels";
import { buildNavItems } from "@/components/nav-items";

/**
 * Regresion ortografica de la parte D del encargo `1.0.1`: comprueba las
 * fuentes centrales de etiquetas visibles (no el texto suelto de cada
 * pantalla, fragil ante reescrituras), para que una futura reintroduccion
 * de "Faccion"/"Profesion"/"Localizacion"/"Administracion" sin tilde en
 * estos modulos compartidos falle aqui, no en produccion.
 */
describe("Etiquetas centrales en castellano correcto", () => {
  it("las categorias de noticia usan tilde en Facción, Profesión, Localización y Administración", () => {
    expect(NEWS_CATEGORY_DISPLAY.FACTION.label).toBe("Facción");
    expect(NEWS_CATEGORY_DISPLAY.PROFESSION.label).toBe("Profesión");
    expect(NEWS_CATEGORY_DISPLAY.LOCATION.label).toBe("Localización");
    expect(NEWS_CATEGORY_DISPLAY.ADMIN.label).toBe("Administración");
  });

  it("el rotulo fijo del bonus de profesion usa tilde en 'después' y 'máximo'", () => {
    expect(PROFESSION_BONUS_LABEL).toBe("+20 % después del máximo base");
  });

  it("el rotulo del bonus de localizacion usa tilde en 'después' y 'máximo'", () => {
    expect(locationBonusLabel(30)).toBe("+30 % después del máximo base");
  });

  it("las etiquetas de estado del split no contienen texto sin tildes conocido", () => {
    expect(Object.values(SPLIT_STATUS_LABELS)).toEqual(["Borrador", "Activo", "Cerrado"]);
  });

  it("la navegacion por rol nunca depende de un texto de etiqueta con errores ortograficos conocidos", () => {
    const items = buildNavItems({ isAuthenticated: true, isAdmin: true, hasPersonId: true });
    const labels = items.map((item) => item.label);
    expect(labels).not.toContain("Anadir participante");
    expect(labels.some((label) => label.includes("Configuracion"))).toBe(false);
  });
});
