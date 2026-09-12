import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { applyEquipmentBonuses, isAllowedEquipmentBonusPercent, EQUIPMENT_BONUS_PERCENTS, type EquippedItemForBonus } from "@/domain/equipment-bonus";

/**
 * Bonus de objetos de equipo (`0.9.0` / MVP-2D, seccion 26 del encargo).
 * Funcion pura: no necesita base de datos. Los efectos de varios objetos que
 * afecten al mismo KPI se acumulan de forma aditiva, nunca multiplicada.
 */

function decimal(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function item(overrides: Partial<EquippedItemForBonus> = {}): EquippedItemForBonus {
  return {
    ownedItemId: "owned-1",
    storeItemId: "item-1",
    itemName: "Cristal de datos",
    equipmentSlotId: "slot-1",
    equipmentSlotName: "Artefacto",
    kpiCode: "SOLUTION_HUNTER",
    bonusPercent: 10,
    displayOrder: 0,
    ...overrides,
  };
}

describe("Porcentajes permitidos", () => {
  it("el conjunto cerrado es exactamente 10/20/30/40/50", () => {
    expect(EQUIPMENT_BONUS_PERCENTS).toEqual([10, 20, 30, 40, 50]);
  });

  it("rechaza 0, 15, 60 y decimales", () => {
    expect(isAllowedEquipmentBonusPercent(0)).toBe(false);
    expect(isAllowedEquipmentBonusPercent(15)).toBe(false);
    expect(isAllowedEquipmentBonusPercent(60)).toBe(false);
    expect(isAllowedEquipmentBonusPercent(12.5)).toBe(false);
  });
});

describe("applyEquipmentBonuses", () => {
  it("solo un objeto de +10 % sobre base 70 produce 77", () => {
    const outcome = applyEquipmentBonuses(decimal(70), "SOLUTION_HUNTER", [item({ bonusPercent: 10 })]);
    expect(outcome.applied).toBe(true);
    expect(outcome.bonusPoints.toNumber()).toBe(7);
    expect(outcome.finalPoints.toNumber()).toBe(77);
    expect(outcome.breakdown).toHaveLength(1);
  });

  it("dos objetos (+10 % y +20 %) sobre el mismo KPI se acumulan de forma aditiva, nunca multiplicada", () => {
    const outcome = applyEquipmentBonuses(decimal(70), "SOLUTION_HUNTER", [
      item({ ownedItemId: "a", equipmentSlotId: "slot-a", bonusPercent: 10 }),
      item({ ownedItemId: "b", equipmentSlotId: "slot-b", bonusPercent: 20 }),
    ]);
    // 70 + 7 + 14 = 91, nunca 70 * 1.10 * 1.20 = 92.4
    expect(outcome.bonusPoints.toNumber()).toBe(21);
    expect(outcome.finalPoints.toNumber()).toBe(91);
    expect(outcome.breakdown).toHaveLength(2);
  });

  it("un objeto en otro KPI no aplica", () => {
    const outcome = applyEquipmentBonuses(decimal(70), "SOLUTION_HUNTER", [item({ kpiCode: "DATA_EXPLORER" })]);
    expect(outcome.applied).toBe(false);
    expect(outcome.bonusPoints.toNumber()).toBe(0);
    expect(outcome.finalPoints.toNumber()).toBe(70);
  });

  it("no aplica sobre un resultado cero o negativo", () => {
    expect(applyEquipmentBonuses(decimal(0), "SOLUTION_HUNTER", [item()]).applied).toBe(false);
    expect(applyEquipmentBonuses(decimal(-10), "SOLUTION_HUNTER", [item()]).applied).toBe(false);
  });

  it("una lista vacia de objetos nunca aplica bonus", () => {
    const outcome = applyEquipmentBonuses(decimal(70), "SOLUTION_HUNTER", []);
    expect(outcome.applied).toBe(false);
    expect(outcome.finalPoints.toNumber()).toBe(70);
  });

  it("no redondea de forma prematura (Decimal de principio a fin)", () => {
    const outcome = applyEquipmentBonuses(decimal("33.3333"), "SOLUTION_HUNTER", [item({ bonusPercent: 10 })]);
    expect(outcome.bonusPoints.toString()).toBe("3.33333");
  });
});
