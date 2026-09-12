import { describe, expect, it } from "vitest";
import { buildNavItems } from "@/components/nav-items";
import { formatRelativeTimeEs } from "@/lib/relative-time";
import { isManualNewsDestination } from "@/domain/news-links";

/**
 * Pruebas acotadas del sistema visual (seccion 61 del encargo): solo la
 * logica pura de navegacion y utilidades, sin snapshots de HTML ni
 * renderizado de componentes (no se instala Testing Library/jsdom para
 * esta entrega).
 */
describe("Navegacion por rol", () => {
  it("un administrador ve Personas, Splits, Resultados y Noticias, y Fichas solo si esta vinculado", () => {
    const withoutPerson = buildNavItems({ isAuthenticated: true, isAdmin: true, hasPersonId: false });
    expect(withoutPerson.map((item) => item.href)).toEqual(["/personas", "/splits", "/resultados", "/noticias"]);

    const withPerson = buildNavItems({ isAuthenticated: true, isAdmin: true, hasPersonId: true });
    expect(withPerson.map((item) => item.href)).toEqual(["/personas", "/splits", "/resultados", "/noticias", "/fichas"]);
  });

  it("un participante ve Noticias, Resultados y Fichas, nunca Personas ni Splits", () => {
    const items = buildNavItems({ isAuthenticated: true, isAdmin: false, hasPersonId: true });
    expect(items.map((item) => item.href)).toEqual(["/noticias", "/resultados", "/fichas"]);
    expect(items.some((item) => item.href === "/personas" || item.href === "/splits")).toBe(false);
  });

  it("sin sesion no se muestra ningun enlace de navegacion", () => {
    expect(buildNavItems({ isAuthenticated: false, isAdmin: false, hasPersonId: false })).toEqual([]);
  });
});

describe("Fecha relativa de noticias", () => {
  it("formatea minutos, horas y dias en castellano", () => {
    const now = new Date("2026-01-10T12:00:00Z");
    expect(formatRelativeTimeEs(new Date("2026-01-10T11:59:30Z"), now)).toBe("hace un momento");
    expect(formatRelativeTimeEs(new Date("2026-01-10T11:50:00Z"), now)).toBe("hace 10 minutos");
    expect(formatRelativeTimeEs(new Date("2026-01-10T09:00:00Z"), now)).toBe("hace 3 horas");
    expect(formatRelativeTimeEs(new Date("2026-01-08T12:00:00Z"), now)).toBe("hace 2 dias");
  });
});

describe("Destinos permitidos del envio manual", () => {
  it("solo acepta el conjunto cerrado de destinos", () => {
    expect(isManualNewsDestination("NONE")).toBe(true);
    expect(isManualNewsDestination("RESULTS")).toBe(true);
    expect(isManualNewsDestination("PROFILE")).toBe(true);
    expect(isManualNewsDestination("MARKET")).toBe(true);
    expect(isManualNewsDestination("SPLIT_ADMIN")).toBe(false);
    expect(isManualNewsDestination("https://example.com")).toBe(false);
  });
});
