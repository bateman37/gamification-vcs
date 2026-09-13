import { describe, expect, it } from "vitest";
import { resolveWeeklyAttendance } from "@/domain/attendance";
import { computeWeeklyPointsPerHour, computePeriodPointsPerHour, consolidatePphAcrossSplits } from "@/domain/points-per-hour";

/**
 * Dominio de asistencia y Puntos por hora (`1.1.1`, ver
 * docs/WEEKLY_ATTENDANCE_AND_HOURS.md). Funciones puras, sin base de datos.
 */

describe("resolveWeeklyAttendance", () => {
  it("bloque nunca guardado (sin fila): no registrado", () => {
    const resolution = resolveWeeklyAttendance(undefined);
    expect(resolution).toEqual({ recorded: false });
  });

  it("totalHours = 0 (fila guardada vacia, normalizada a 0): ausente", () => {
    const resolution = resolveWeeklyAttendance({ totalHours: 0, productiveHours: null });
    expect(resolution).toEqual({ recorded: true, status: "ABSENT", totalHours: 0, productiveHours: null });
  });

  it("totalHours > 0 (8 horas, no 40): presente", () => {
    const resolution = resolveWeeklyAttendance({ totalHours: 8, productiveHours: null });
    expect(resolution.recorded).toBe(true);
    expect(resolution).toMatchObject({ status: "PRESENT", totalHours: 8 });
  });

  it("cualquier valor positivo cuenta como presente (40 horas tambien)", () => {
    const resolution = resolveWeeklyAttendance({ totalHours: 40, productiveHours: 32 });
    expect(resolution).toMatchObject({ status: "PRESENT", totalHours: 40, productiveHours: 32 });
  });
});

describe("computeWeeklyPointsPerHour", () => {
  it("120 puntos / 24 horas = 5", () => {
    expect(computeWeeklyPointsPerHour(120, 24)).toBe(5);
  });

  it("con horas = 0 no es calculable (null, nunca infinito)", () => {
    expect(computeWeeklyPointsPerHour(50, 0)).toBeNull();
  });

  it("admite un numerador negativo", () => {
    expect(computeWeeklyPointsPerHour(-40, 8)).toBe(-5);
  });

  it("8 horas y 48 puntos dan 6, sin completar el denominador a 40", () => {
    expect(computeWeeklyPointsPerHour(48, 8)).toBe(6);
  });
});

describe("computePeriodPointsPerHour (razon de sumas, G2)", () => {
  it("semana de 8h/80pts + semana de 40h/200pts = 280/48, no la media simple (10+5)/2", () => {
    const result = computePeriodPointsPerHour([
      { points: 80, hours: 8 },
      { points: 200, hours: 40 },
    ]);
    expect(result).toBeCloseTo(280 / 48, 6);
    expect(result).not.toBeCloseTo(7.5, 6);
  });

  it("sin entradas no es calculable", () => {
    expect(computePeriodPointsPerHour([])).toBeNull();
  });

  it("suma de horas cero no es calculable", () => {
    expect(computePeriodPointsPerHour([{ points: 10, hours: 0 }])).toBeNull();
  });
});

describe("consolidatePphAcrossSplits (multi-split, G3)", () => {
  it("horas iguales entre splits simultaneos: usa esas horas una vez y la media de los puntos", () => {
    const result = consolidatePphAcrossSplits([
      { splitId: "A", points: 200, hours: 40 },
      { splitId: "B", points: 240, hours: 40 },
    ]);
    expect(result).toEqual({ status: "ok", hours: 40, points: 220 });
  });

  it("horas distintas entre splits simultaneos: incidencia, no se elige ningun valor", () => {
    const result = consolidatePphAcrossSplits([
      { splitId: "A", points: 200, hours: 40 },
      { splitId: "B", points: 240, hours: 32 },
    ]);
    expect(result).toEqual({ status: "inconsistent_hours" });
  });

  it("un unico split no genera incidencia", () => {
    const result = consolidatePphAcrossSplits([{ splitId: "A", points: 100, hours: 20 }]);
    expect(result).toEqual({ status: "ok", hours: 20, points: 100 });
  });
});
