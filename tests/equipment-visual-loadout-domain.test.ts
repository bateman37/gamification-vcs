import { describe, expect, it } from "vitest";
import {
  EQUIPMENT_VISUAL_POSITIONS,
  EQUIPMENT_VISUAL_POSITION_BY_NORMALIZED_BASE_NAME,
  MAX_PLACED_EQUIPMENT_SLOTS_PER_SPLIT,
  equipmentVisualPositionBaseName,
  parseEquipmentVisualPosition,
} from "@/domain/equipment-visual-positions";
import {
  areLoadoutsEqual,
  computeLoadoutRevision,
  normalizeLoadoutAssignments,
  validateLoadoutAssignments,
} from "@/domain/equipment-loadout";
import { buildBonusSummary, computeEquipmentBonusDeltas } from "@/domain/equipment-bonus-summary";
import type { EquipmentBonusSummaryItem } from "@/domain/equipment-bonus-summary";

/**
 * Dominio de `1.2.0`: catalogo cerrado de posiciones visuales, normalizacion
 * y validacion del borrador de equipo, y agregacion de bonificadores por KPI
 * (seccion 17.3 del encargo: los porcentajes se suman, nunca se encadenan).
 * Pruebas puras, sin base de datos.
 */

describe("Catalogo cerrado de posiciones visuales", () => {
  it("tiene exactamente diez posiciones, con claves y nombres base unicos", () => {
    expect(EQUIPMENT_VISUAL_POSITIONS).toHaveLength(10);
    expect(MAX_PLACED_EQUIPMENT_SLOTS_PER_SPLIT).toBe(10);
    expect(new Set(EQUIPMENT_VISUAL_POSITIONS.map((p) => p.position)).size).toBe(10);
    expect(new Set(EQUIPMENT_VISUAL_POSITIONS.map((p) => p.baseName)).size).toBe(10);
    expect(EQUIPMENT_VISUAL_POSITION_BY_NORMALIZED_BASE_NAME.size).toBe(10);
  });

  it("coloca mano izquierda a la izquierda de la pantalla y mano derecha a la derecha", () => {
    const left = EQUIPMENT_VISUAL_POSITIONS.find((p) => p.position === "LEFT_HAND")!;
    const right = EQUIPMENT_VISUAL_POSITIONS.find((p) => p.position === "RIGHT_HAND")!;
    expect(left.column).toBe(1);
    expect(right.column).toBe(3);
    expect(left.row).toBe(right.row);
  });

  it("no acepta una clave libre enviada desde el navegador", () => {
    expect(parseEquipmentVisualPosition("HEAD")).toBe("HEAD");
    expect(parseEquipmentVisualPosition("CABEZA")).toBeNull();
    expect(parseEquipmentVisualPosition("")).toBeNull();
    expect(parseEquipmentVisualPosition(null)).toBeNull();
    expect(parseEquipmentVisualPosition({ position: "HEAD" })).toBeNull();
  });

  it("el nombre base es solo el valor inicial visible y no la clave", () => {
    expect(equipmentVisualPositionBaseName("LEFT_HAND")).toBe("Mano izquierda");
    expect(equipmentVisualPositionBaseName("RELIC")).toBe("Reliquia");
  });
});

describe("Borrador de equipo", () => {
  const context = {
    activeSlotIds: ["slot-a", "slot-b"],
    knownSlotIds: ["slot-a", "slot-b", "slot-inactiva"],
    ownedItems: [
      { ownedItemId: "own-a", equipmentSlotId: "slot-a" },
      { ownedItemId: "own-a2", equipmentSlotId: "slot-a" },
      { ownedItemId: "own-b", equipmentSlotId: "slot-b" },
      { ownedItemId: "own-inactiva", equipmentSlotId: "slot-inactiva" },
    ],
    maxAssignments: 10,
  };

  it("acepta un conjunto valido", () => {
    const issues = validateLoadoutAssignments(
      [
        { equipmentSlotId: "slot-a", ownedItemId: "own-a" },
        { equipmentSlotId: "slot-b", ownedItemId: "own-b" },
      ],
      context,
    );
    expect(issues).toEqual([]);
  });

  it("rechaza dos objetos en la misma ranura", () => {
    const issues = validateLoadoutAssignments(
      [
        { equipmentSlotId: "slot-a", ownedItemId: "own-a" },
        { equipmentSlotId: "slot-a", ownedItemId: "own-a2" },
      ],
      context,
    );
    expect(issues.map((issue) => issue.code)).toContain("SLOT_DUPLICADA");
  });

  it("rechaza el mismo objeto en dos ranuras, un objeto no poseido y una ranura ajena", () => {
    expect(
      validateLoadoutAssignments(
        [
          { equipmentSlotId: "slot-a", ownedItemId: "own-a" },
          { equipmentSlotId: "slot-b", ownedItemId: "own-a" },
        ],
        context,
      ).map((issue) => issue.code),
    ).toContain("OBJETO_DUPLICADO");

    expect(
      validateLoadoutAssignments([{ equipmentSlotId: "slot-a", ownedItemId: "own-de-otro" }], context).map((i) => i.code),
    ).toEqual(["OBJETO_NO_POSEIDO"]);

    expect(
      validateLoadoutAssignments([{ equipmentSlotId: "slot-de-otro-split", ownedItemId: "own-a" }], context).map((i) => i.code),
    ).toEqual(["RANURA_DESCONOCIDA"]);
  });

  it("rechaza un objeto en una ranura distinta a la suya y una ranura desactivada", () => {
    expect(
      validateLoadoutAssignments([{ equipmentSlotId: "slot-b", ownedItemId: "own-a" }], context).map((i) => i.code),
    ).toEqual(["RANURA_INCOMPATIBLE"]);

    expect(
      validateLoadoutAssignments([{ equipmentSlotId: "slot-inactiva", ownedItemId: "own-inactiva" }], context).map((i) => i.code),
    ).toEqual(["RANURA_INACTIVA"]);
  });

  it("normaliza y firma el conjunto de forma estable, sin depender del orden", () => {
    const a = [
      { equipmentSlotId: "slot-b", ownedItemId: "own-b" },
      { equipmentSlotId: "slot-a", ownedItemId: "own-a" },
    ];
    const b = [
      { equipmentSlotId: "slot-a", ownedItemId: "own-a" },
      { equipmentSlotId: "slot-b", ownedItemId: "own-b" },
    ];
    expect(normalizeLoadoutAssignments(a)).toEqual(normalizeLoadoutAssignments(b));
    expect(computeLoadoutRevision(a)).toBe(computeLoadoutRevision(b));
    expect(areLoadoutsEqual(a, b)).toBe(true);
    expect(computeLoadoutRevision([])).toBe("vacio");
    expect(areLoadoutsEqual(a, [{ equipmentSlotId: "slot-a", ownedItemId: "own-a" }])).toBe(false);
  });
});

describe("Panel de bonificadores", () => {
  function item(partial: Partial<EquipmentBonusSummaryItem> & { ownedItemId: string; bonusPercent: number }): EquipmentBonusSummaryItem {
    return {
      storeItemId: `store-${partial.ownedItemId}`,
      itemName: `Objeto ${partial.ownedItemId}`,
      equipmentSlotId: `slot-${partial.ownedItemId}`,
      equipmentSlotName: "Ranura",
      visualPosition: null,
      slotDisplayOrder: 0,
      kpiCode: "SOLUTION_HUNTER",
      imageVersion: null,
      ...partial,
    };
  }

  it("suma profesion, localizacion y objetos sobre el mismo KPI sin encadenarlos", () => {
    const summary = buildBonusSummary({
      equippedItems: [item({ ownedItemId: "a", bonusPercent: 40 }), item({ ownedItemId: "b", bonusPercent: 40 })],
      profession: { name: "Mecanico", kpiCodeA: "SOLUTION_HUNTER", kpiCodeB: "STABILITY_GUARDIAN" },
      location: { name: "Taller", kpiCode: "SOLUTION_HUNTER", bonusPercent: 50 },
    });

    const row = summary.rows.find((r) => r.kpiCode === "SOLUTION_HUNTER")!;
    expect(row.professionPercent).toBe(20);
    expect(row.locationPercent).toBe(50);
    // Dos objetos de +40 % se acumulan de forma aditiva: +80 %, nunca 1,4 x 1,4.
    expect(row.equipmentPercent).toBe(80);
    expect(row.equipmentEntries).toHaveLength(2);
    // 20 + 50 + 80 = 150. Un encadenamiento daria 1,2 x 1,5 x 1,4 x 1,4 = +252,8 %.
    expect(row.totalPotentialPercent).toBe(150);
    expect(summary.isEmpty).toBe(false);
  });

  it("aplica el +20 % de la profesion a sus dos KPI y nada mas", () => {
    const summary = buildBonusSummary({
      equippedItems: [],
      profession: { name: "Piloto", kpiCodeA: "SOLUTION_HUNTER", kpiCodeB: "STABILITY_GUARDIAN" },
      location: null,
    });
    expect(summary.rows).toHaveLength(2);
    expect(summary.rows.every((row) => row.totalPotentialPercent === 20)).toBe(true);
  });

  it("sin ninguna fuente aplicable devuelve el estado vacio, sin ceros repetidos por KPI", () => {
    const summary = buildBonusSummary({ equippedItems: [], profession: null, location: null });
    expect(summary.rows).toEqual([]);
    expect(summary.isEmpty).toBe(true);
  });

  it("calcula la diferencia por KPI entre el borrador y el equipo confirmado", () => {
    const confirmed = [item({ ownedItemId: "a", bonusPercent: 10 })];
    const draft = [item({ ownedItemId: "a", bonusPercent: 10 }), item({ ownedItemId: "b", bonusPercent: 30, kpiCode: "STABILITY_GUARDIAN" })];

    const deltas = computeEquipmentBonusDeltas(confirmed, draft);
    expect(deltas).toHaveLength(1);
    expect(deltas[0]!.kpiCode).toBe("STABILITY_GUARDIAN");
    expect(deltas[0]!.differencePercent).toBe(30);

    expect(computeEquipmentBonusDeltas(confirmed, confirmed)).toEqual([]);
  });
});
