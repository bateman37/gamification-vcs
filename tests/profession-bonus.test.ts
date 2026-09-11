import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  applyProfessionBonus,
  isProfessionAvailableForLevel,
  professionPowersKpi,
  PROFESSION_BONUS_PERCENT,
  PROFESSION_BONUS_RATE,
  type ApplicableProfession,
} from "@/domain/profession-bonus";

/**
 * Regla de bonus de profesion (`0.8.0` / MVP-2B, seccion 32.3 del encargo).
 * Funcion pura: no necesita base de datos.
 */

const MECANICO: ApplicableProfession = {
  id: "prof-1",
  name: "Mecanico",
  kpiCodeA: "SOLUTION_HUNTER",
  kpiCodeB: "DATA_EXPLORER",
  availableN0: true,
  availableN1: true,
  availableN2: false,
};

function decimal(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

describe("Constante del bonus", () => {
  it("es siempre 20 % y su factor decimal equivalente es 0,2", () => {
    expect(PROFESSION_BONUS_PERCENT).toBe(20);
    expect(PROFESSION_BONUS_RATE.equals(decimal("0.2"))).toBe(true);
  });
});

describe("Aplicacion del bonus", () => {
  it("50 puntos con maximo 70 producen 60 (50 + 10)", () => {
    // El maximo base ya se aplico antes: 50 esta por debajo de 70, asi que entra tal cual.
    const outcome = applyProfessionBonus(decimal(50), "SOLUTION_HUNTER", MECANICO, "N0");
    expect(outcome.applied).toBe(true);
    expect(outcome.basePoints.toNumber()).toBe(50);
    expect(outcome.bonusPoints.toNumber()).toBe(10);
    expect(outcome.finalPoints.toNumber()).toBe(60);
    expect(outcome.professionName).toBe("Mecanico");
    expect(outcome.bonusPercent).toBe(20);
  });

  it("80 puntos limitados a un maximo de 70 producen 84 (70 + 14): el resultado supera el maximo base", () => {
    const outcome = applyProfessionBonus(decimal(70), "DATA_EXPLORER", MECANICO, "N1");
    expect(outcome.finalPoints.toNumber()).toBe(84);
    expect(outcome.finalPoints.greaterThan(70)).toBe(true);
  });

  it("no vuelve a aplicar el maximo despues del bonus", () => {
    const outcome = applyProfessionBonus(decimal(70), "SOLUTION_HUNTER", MECANICO, "N0");
    // Si el maximo se reaplicase, el resultado volveria a 70.
    expect(outcome.finalPoints.toNumber()).not.toBe(70);
    expect(outcome.finalPoints.toNumber()).toBe(84);
  });

  it("solo afecta a los dos KPI configurados", () => {
    const affectedA = applyProfessionBonus(decimal(10), "SOLUTION_HUNTER", MECANICO, "N0");
    const affectedB = applyProfessionBonus(decimal(10), "DATA_EXPLORER", MECANICO, "N0");
    const other = applyProfessionBonus(decimal(10), "MASTER_CRAFTSMAN", MECANICO, "N0");

    expect(affectedA.applied).toBe(true);
    expect(affectedB.applied).toBe(true);
    expect(other.applied).toBe(false);
    expect(other.finalPoints.toNumber()).toBe(10);
    expect(other.bonusPoints.toNumber()).toBe(0);
  });

  it("no aplica bonus a un resultado igual a cero", () => {
    const outcome = applyProfessionBonus(decimal(0), "SOLUTION_HUNTER", MECANICO, "N0");
    expect(outcome.applied).toBe(false);
    expect(outcome.finalPoints.toNumber()).toBe(0);
    expect(outcome.bonusPoints.toNumber()).toBe(0);
  });

  it("no aplica bonus a un resultado negativo (nunca lo empeora)", () => {
    const outcome = applyProfessionBonus(decimal(-10), "SOLUTION_HUNTER", MECANICO, "N0");
    expect(outcome.applied).toBe(false);
    expect(outcome.finalPoints.toNumber()).toBe(-10);
    expect(outcome.bonusPoints.toNumber()).toBe(0);
  });

  it("no aplica bonus cuando el participante no tiene profesion (split sin profesiones incluido)", () => {
    const outcome = applyProfessionBonus(decimal(50), "SOLUTION_HUNTER", null, "N0");
    expect(outcome.applied).toBe(false);
    expect(outcome.finalPoints.toNumber()).toBe(50);
  });

  it("no aplica bonus cuando la profesion no esta disponible para el nivel del participante", () => {
    const outcome = applyProfessionBonus(decimal(50), "SOLUTION_HUNTER", MECANICO, "N2");
    expect(outcome.applied).toBe(false);
    expect(outcome.finalPoints.toNumber()).toBe(50);
  });

  it("calcula con decimales, sin redondeo prematuro", () => {
    const outcome = applyProfessionBonus(decimal("33.3333"), "SOLUTION_HUNTER", MECANICO, "N0");
    expect(outcome.bonusPoints.equals(decimal("6.66666"))).toBe(true);
    expect(outcome.finalPoints.equals(decimal("39.99996"))).toBe(true);
  });
});

describe("Helpers de disponibilidad", () => {
  it("resuelve la disponibilidad por nivel", () => {
    expect(isProfessionAvailableForLevel(MECANICO, "N0")).toBe(true);
    expect(isProfessionAvailableForLevel(MECANICO, "N1")).toBe(true);
    expect(isProfessionAvailableForLevel(MECANICO, "N2")).toBe(false);
  });

  it("reconoce los dos KPI potenciados", () => {
    expect(professionPowersKpi(MECANICO, "SOLUTION_HUNTER")).toBe(true);
    expect(professionPowersKpi(MECANICO, "DATA_EXPLORER")).toBe(true);
    expect(professionPowersKpi(MECANICO, "VOICE_AMBASSADOR")).toBe(false);
  });
});
