import { describe, expect, it } from "vitest";
import { resolveWeekLocationWindow, isWeekCurrentlyActive, findNextWeek } from "@/domain/location-window";
import { parseCalendarDate } from "@/lib/dates";

/**
 * Ventana temporal de la localizacion semanal (`0.8.5` / MVP-2C, seccion
 * 30.2 del encargo). Funciones puras que reciben siempre la fecha actual
 * como argumento: deterministas, sin depender del reloj real ni de `sleep`.
 */

const WEEK = {
  startDate: parseCalendarDate("2026-09-14"),
  endDate: parseCalendarDate("2026-09-20"),
};

describe("resolveWeekLocationWindow", () => {
  it("es editable antes del inicio de la semana (PROXIMA)", () => {
    const now = parseCalendarDate("2026-09-10");
    expect(resolveWeekLocationWindow(now, WEEK, false)).toEqual({ status: "PROXIMA", editable: true });
  });

  it("queda bloqueada desde el primer dia de la semana (ACTIVA), aunque no este publicada", () => {
    const now = parseCalendarDate("2026-09-14");
    expect(resolveWeekLocationWindow(now, WEEK, false)).toEqual({ status: "ACTIVA", editable: false });
  });

  it("sigue activa el ultimo dia de la semana", () => {
    const now = parseCalendarDate("2026-09-20");
    expect(resolveWeekLocationWindow(now, WEEK, false)).toEqual({ status: "ACTIVA", editable: false });
  });

  it("queda bloqueada tras terminar la semana (FINALIZADA) si no se publico", () => {
    const now = parseCalendarDate("2026-09-21");
    expect(resolveWeekLocationWindow(now, WEEK, false)).toEqual({ status: "FINALIZADA", editable: false });
  });

  it("una semana publicada es siempre de solo lectura, incluso antes de su inicio por error de fechas", () => {
    const now = parseCalendarDate("2026-09-10");
    expect(resolveWeekLocationWindow(now, WEEK, true)).toEqual({ status: "PUBLICADA", editable: false });
  });

  it("comprueba el ejemplo del encargo: decision el 10/09/2026 para la semana 14/09/2026-20/09/2026", () => {
    const decisionDate = parseCalendarDate("2026-09-10");
    const window = resolveWeekLocationWindow(decisionDate, WEEK, false);
    expect(window.editable).toBe(true);
    // La semana anterior (que contendria el 10/09) no debe verse afectada: se comprueba con sus propias fechas.
    const previousWeek = { startDate: parseCalendarDate("2026-09-07"), endDate: parseCalendarDate("2026-09-13") };
    expect(resolveWeekLocationWindow(decisionDate, previousWeek, false).status).toBe("ACTIVA");
  });
});

describe("isWeekCurrentlyActive", () => {
  it("es true en cualquier dia entre startDate y endDate, ambos incluidos", () => {
    expect(isWeekCurrentlyActive(parseCalendarDate("2026-09-14"), WEEK)).toBe(true);
    expect(isWeekCurrentlyActive(parseCalendarDate("2026-09-17"), WEEK)).toBe(true);
    expect(isWeekCurrentlyActive(parseCalendarDate("2026-09-20"), WEEK)).toBe(true);
  });

  it("es false un dia antes o un dia despues", () => {
    expect(isWeekCurrentlyActive(parseCalendarDate("2026-09-13"), WEEK)).toBe(false);
    expect(isWeekCurrentlyActive(parseCalendarDate("2026-09-21"), WEEK)).toBe(false);
  });
});

describe("findNextWeek", () => {
  const weeks = [
    { id: "w1", startDate: parseCalendarDate("2026-08-31") },
    { id: "w2", startDate: parseCalendarDate("2026-09-07") },
    { id: "w3", startDate: parseCalendarDate("2026-09-14") },
    { id: "w4", startDate: parseCalendarDate("2026-09-21") },
  ];

  it("identifica la primera semana cuya fecha de inicio es posterior a la actual", () => {
    const now = parseCalendarDate("2026-09-10");
    expect(findNextWeek(weeks, now)?.id).toBe("w3");
  });

  it("no devuelve la semana actual como proxima", () => {
    const now = parseCalendarDate("2026-09-14");
    expect(findNextWeek(weeks, now)?.id).toBe("w4");
  });

  it("devuelve null si no queda ninguna semana futura", () => {
    const now = parseCalendarDate("2026-12-31");
    expect(findNextWeek(weeks, now)).toBeNull();
  });
});
