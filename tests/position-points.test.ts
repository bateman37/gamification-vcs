import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { createSplitWithWeeks } from "@/server/services/split.service";
import {
  listPositionPointRules,
  updatePositionPointRules,
} from "@/server/services/position-points.service";
import { parsePositionPointsForm, PositionPointsValidationError } from "@/server/validation/position-points";
import { DEFAULT_POSITION_POINTS, TOTAL_POSITION_COUNT } from "@/domain/position-points";
import { DomainError } from "@/lib/errors";

function positionPointsForm(values: Record<number, string>): FormData {
  const formData = new FormData();
  for (let position = 1; position <= TOTAL_POSITION_COUNT; position += 1) {
    formData.set(`points__${position}`, values[position] ?? String(DEFAULT_POSITION_POINTS[position - 1]!.points));
  }
  return formData;
}

async function createDraftSplit(name: string) {
  return createSplitWithWeeks(testDb, { name, description: undefined, startDate: "2025-10-06", numberOfWeeks: 1 });
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Puntos por posicion semanal: creacion con valores de Split 8", () => {
  it("un split nuevo recibe las quince reglas con los valores exactos de Split 8", async () => {
    const split = await createDraftSplit("Split puntos A");
    const rules = await listPositionPointRules(testDb, split.id);

    expect(rules).toHaveLength(15);
    expect(rules.map((rule) => ({ position: rule.position, points: rule.points }))).toEqual(
      DEFAULT_POSITION_POINTS.map((entry) => ({ position: entry.position, points: entry.points })),
    );
  });
});

describe("Puntos por posicion semanal: aislamiento entre splits", () => {
  it("editar los puntos de un split no modifica los de otro split", async () => {
    const splitA = await createDraftSplit("Split puntos B");
    const splitB = await createDraftSplit("Split puntos C");

    await updatePositionPointRules(testDb, splitA.id, [{ position: 1, points: 100 }]);

    const rulesA = await listPositionPointRules(testDb, splitA.id);
    const rulesB = await listPositionPointRules(testDb, splitB.id);
    expect(rulesA.find((rule) => rule.position === 1)?.points).toBe(100);
    expect(rulesB.find((rule) => rule.position === 1)?.points).toBe(15);
  });
});

describe("Puntos por posicion semanal: validacion de formulario", () => {
  it("exige las quince posiciones con puntos enteros no negativos, con todos los errores en una sola respuesta", async () => {
    const formData = positionPointsForm({ 1: "-5", 2: "no-es-un-numero", 3: "1,5" });
    try {
      parsePositionPointsForm(formData);
      throw new Error("Se esperaba que la validacion fallase.");
    } catch (error) {
      expect(error).toBeInstanceOf(PositionPointsValidationError);
      const validationError = error as PositionPointsValidationError;
      expect(validationError.fieldErrors).toHaveLength(3);
      expect(validationError.fieldErrors.map((fieldError) => fieldError.position).sort()).toEqual([1, 2, 3]);
    }
  });

  it("un formulario valido produce las quince filas listas para guardar", () => {
    const formData = positionPointsForm({ 1: "20" });
    const rows = parsePositionPointsForm(formData);
    expect(rows).toHaveLength(15);
    expect(rows.find((row) => row.position === 1)?.points).toBe(20);
  });
});

describe("Puntos por posicion semanal: guardado atomico y proteccion de split cerrado", () => {
  it("un valor invalido que llegue al servicio no deja un guardado parcial", async () => {
    const split = await createDraftSplit("Split puntos D");
    const before = await listPositionPointRules(testDb, split.id);

    await expect(
      updatePositionPointRules(testDb, split.id, [
        { position: 1, points: 999 },
        { position: 2, points: -1 },
      ]),
    ).rejects.toThrow();

    const after = await listPositionPointRules(testDb, split.id);
    expect(after).toEqual(before);
  });

  it("un split cerrado no se puede modificar desde el servicio", async () => {
    const split = await createDraftSplit("Split puntos E");
    await testDb.split.update({ where: { id: split.id }, data: { status: "CLOSED" } });

    await expect(
      updatePositionPointRules(testDb, split.id, [{ position: 1, points: 50 }]),
    ).rejects.toBeInstanceOf(DomainError);

    const rules = await listPositionPointRules(testDb, split.id);
    expect(rules.find((rule) => rule.position === 1)?.points).toBe(15);
  });
});
