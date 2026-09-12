import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { computeCreditsEarned } from "@/domain/credits";
import {
  computeGamificationImpact,
  parseGamificationMode,
  resolveGamificationDisplayPoints,
  resolveGamificationDisplayTotal,
} from "@/domain/gamification-view";

/**
 * Equivalencia de creditos (`0.9.0` / MVP-2D, seccion 2 del encargo) y vista
 * "Con/Sin gamificacion" (parte J). Funciones puras: no necesitan base de
 * datos.
 */

describe("computeCreditsEarned", () => {
  it("248,04 genera 248 creditos", () => {
    expect(computeCreditsEarned(new Prisma.Decimal("248.04"))).toBe(248);
  });

  it("248,99 genera 248, nunca 249", () => {
    expect(computeCreditsEarned(new Prisma.Decimal("248.99"))).toBe(248);
  });

  it("un resultado exactamente entero genera ese mismo numero de creditos", () => {
    expect(computeCreditsEarned(1)).toBe(1);
    expect(computeCreditsEarned(0)).toBe(0);
  });

  it("cero y negativos generan cero creditos, nunca una deuda", () => {
    expect(computeCreditsEarned(0)).toBe(0);
    expect(computeCreditsEarned(-12.5)).toBe(0);
    expect(computeCreditsEarned(new Prisma.Decimal("-0.01"))).toBe(0);
  });

  it("acepta tanto Decimal como number", () => {
    expect(computeCreditsEarned(99.9)).toBe(99);
    expect(computeCreditsEarned(new Prisma.Decimal("99.9"))).toBe(99);
  });
});

describe("parseGamificationMode", () => {
  it("por defecto es 'con' para cualquier valor distinto de 'sin'", () => {
    expect(parseGamificationMode(undefined)).toBe("con");
    expect(parseGamificationMode("con")).toBe("con");
    expect(parseGamificationMode("cualquier-cosa")).toBe("con");
  });

  it("'sin' activa el modo sin gamificacion", () => {
    expect(parseGamificationMode("sin")).toBe("sin");
  });
});

describe("resolveGamificationDisplayPoints", () => {
  it("'No aplica' nunca cambia en ningun modo", () => {
    expect(resolveGamificationDisplayPoints("con", "NOT_APPLICABLE", null, null)).toBeNull();
    expect(resolveGamificationDisplayPoints("sin", "NOT_APPLICABLE", 84, 70)).toBeNull();
  });

  it("VAC siempre se muestra como 0 en cualquier modo", () => {
    expect(resolveGamificationDisplayPoints("con", "VAC", null, null)).toBe(0);
    expect(resolveGamificationDisplayPoints("sin", "VAC", null, null)).toBe(0);
  });

  it("'Con gamificacion' usa finalPoints (oficial, con bonus)", () => {
    expect(resolveGamificationDisplayPoints("con", "COMPUTED", 84, 70)).toBe(84);
  });

  it("'Sin gamificacion' usa basePointsBeforeProfession (real, tras maximo, antes de bonus)", () => {
    expect(resolveGamificationDisplayPoints("sin", "COMPUTED", 84, 70)).toBe(70);
  });

  it("'Sin gamificacion' recurre a finalPoints cuando basePointsBeforeProfession es null (publicacion anterior a 0.8.0)", () => {
    expect(resolveGamificationDisplayPoints("sin", "COMPUTED", 55, null)).toBe(55);
  });

  it("conserva valores negativos en ambos modos", () => {
    expect(resolveGamificationDisplayPoints("con", "COMPUTED", -10, -10)).toBe(-10);
    expect(resolveGamificationDisplayPoints("sin", "COMPUTED", -10, -10)).toBe(-10);
  });
});

describe("resolveGamificationDisplayTotal y computeGamificationImpact", () => {
  it("'Con gamificacion' devuelve el total oficial sin cambios", () => {
    expect(resolveGamificationDisplayTotal("con", 196, 56)).toBe(196);
  });

  it("'Sin gamificacion' resta el total de los tres bonus (profesion + localizacion + objetos)", () => {
    expect(resolveGamificationDisplayTotal("sin", 196, 56)).toBe(140);
  });

  it("el impacto coincide siempre con la suma de los bonus publicados", () => {
    const official = 196;
    const real = resolveGamificationDisplayTotal("sin", official, 56);
    expect(computeGamificationImpact(official, real)).toBe(56);
  });

  it("sin ningun bonus, el impacto es cero y ambos modos coinciden", () => {
    expect(resolveGamificationDisplayTotal("sin", 70, 0)).toBe(70);
    expect(computeGamificationImpact(70, 70)).toBe(0);
  });
});
