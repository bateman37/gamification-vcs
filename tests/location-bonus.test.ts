import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  applyLocationBonus,
  isAllowedLocationBonusPercent,
  locationBonusLabel,
  LOCATION_BONUS_PERCENTS,
  type ApplicableWeekLocation,
} from "@/domain/location-bonus";

/**
 * Regla de bonus de localizacion semanal (`0.8.5` / MVP-2C, seccion 30.4 del
 * encargo). Funcion pura: no necesita base de datos.
 */

const NEBULOSA: ApplicableWeekLocation = {
  id: "loc-1",
  name: "Nebulosa de Andromeda",
  kpiCode: "SOLUTION_HUNTER",
  bonusPercent: 30,
};

function decimal(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

describe("Porcentajes permitidos", () => {
  it("el conjunto cerrado es exactamente 10/20/30/40/50", () => {
    expect(LOCATION_BONUS_PERCENTS).toEqual([10, 20, 30, 40, 50]);
  });

  it("rechaza 0, 15, 60 y decimales", () => {
    expect(isAllowedLocationBonusPercent(0)).toBe(false);
    expect(isAllowedLocationBonusPercent(15)).toBe(false);
    expect(isAllowedLocationBonusPercent(60)).toBe(false);
    expect(isAllowedLocationBonusPercent(30.5)).toBe(false);
  });

  it("acepta los cinco valores cerrados", () => {
    for (const percent of LOCATION_BONUS_PERCENTS) {
      expect(isAllowedLocationBonusPercent(percent)).toBe(true);
    }
  });

  it("construye la etiqueta canonica con el porcentaje indicado", () => {
    expect(locationBonusLabel(30)).toBe("+30 % después del máximo base");
  });
});

describe("Aplicacion del bonus", () => {
  it("50 puntos con localizacion al 30 % producen 65", () => {
    const outcome = applyLocationBonus(decimal(50), "SOLUTION_HUNTER", NEBULOSA);
    expect(outcome.applied).toBe(true);
    expect(outcome.basePoints.toNumber()).toBe(50);
    expect(outcome.bonusPoints.toNumber()).toBe(15);
    expect(outcome.finalPoints.toNumber()).toBe(65);
    expect(outcome.locationName).toBe("Nebulosa de Andromeda");
    expect(outcome.bonusPercent).toBe(30);
  });

  it("70 puntos (ya limitados al maximo) con localizacion al 30 % producen 91: puede superar el maximo base", () => {
    const outcome = applyLocationBonus(decimal(70), "SOLUTION_HUNTER", NEBULOSA);
    expect(outcome.finalPoints.toNumber()).toBe(91);
    expect(outcome.finalPoints.greaterThan(70)).toBe(true);
  });

  it("no vuelve a aplicar el maximo despues del bonus", () => {
    const outcome = applyLocationBonus(decimal(70), "SOLUTION_HUNTER", NEBULOSA);
    expect(outcome.finalPoints.toNumber()).not.toBe(70);
  });

  it("solo afecta al KPI potenciado por la localizacion", () => {
    const affected = applyLocationBonus(decimal(10), "SOLUTION_HUNTER", NEBULOSA);
    const other = applyLocationBonus(decimal(10), "DATA_EXPLORER", NEBULOSA);
    expect(affected.applied).toBe(true);
    expect(other.applied).toBe(false);
    expect(other.finalPoints.toNumber()).toBe(10);
    expect(other.bonusPoints.toNumber()).toBe(0);
  });

  it("no aplica bonus a un resultado igual a cero", () => {
    const outcome = applyLocationBonus(decimal(0), "SOLUTION_HUNTER", NEBULOSA);
    expect(outcome.applied).toBe(false);
    expect(outcome.finalPoints.toNumber()).toBe(0);
  });

  it("no aplica bonus a un resultado negativo (nunca lo empeora)", () => {
    const outcome = applyLocationBonus(decimal(-10), "SOLUTION_HUNTER", NEBULOSA);
    expect(outcome.applied).toBe(false);
    expect(outcome.finalPoints.toNumber()).toBe(-10);
  });

  it("no aplica bonus cuando la semana no tiene localizacion", () => {
    const outcome = applyLocationBonus(decimal(50), "SOLUTION_HUNTER", null);
    expect(outcome.applied).toBe(false);
    expect(outcome.finalPoints.toNumber()).toBe(50);
  });

  it("no depende del nivel del participante (no recibe ese parametro)", () => {
    // A diferencia de la profesion, la funcion no toma nivel tecnico: aplica igual a todos.
    const a = applyLocationBonus(decimal(50), "SOLUTION_HUNTER", NEBULOSA);
    const b = applyLocationBonus(decimal(50), "SOLUTION_HUNTER", NEBULOSA);
    expect(a.finalPoints.toNumber()).toBe(b.finalPoints.toNumber());
  });

  it("calcula con decimales, sin redondeo prematuro", () => {
    const outcome = applyLocationBonus(decimal("33.3333"), "SOLUTION_HUNTER", NEBULOSA);
    expect(outcome.bonusPoints.equals(decimal("9.99999"))).toBe(true);
  });
});
