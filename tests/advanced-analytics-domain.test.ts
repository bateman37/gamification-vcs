import { describe, expect, it } from "vitest";
import {
  bucketForPercentage,
  buildDistribution,
  collapseSimultaneousSplits,
  collapseWeeksToPersonPeriod,
  computeCommonPopulationComparison,
  computeDispersionStats,
  computeHierarchicalAverage,
  computeObservationTotals,
  computePeriodAverageReference,
  computeClosingBalance,
  detectStreaks,
  findPreviousWeekReference,
  isSmallSample,
  periodKeyFor,
  ppDifference,
  relativeVariation,
  resolveCellBase,
  resolveCellValue,
  resolveObservation,
  resolveSignal,
  sumCreditsIssued,
  sumCreditsSpent,
  type KpiCellObservation,
  type ParticipantWeekObservation,
} from "@/domain/analytics";

function cell(overrides: Partial<KpiCellObservation> = {}): KpiCellObservation {
  return {
    kpiCode: "SOLUTION_HUNTER",
    kpiName: "Cazador de soluciones",
    status: "COMPUTED",
    finalPoints: 70,
    basePointsBeforeProfession: 70,
    baseMax: 70,
    professionBonusPoints: 0,
    locationBonusPoints: 0,
    equipmentBonusPoints: 0,
    ...overrides,
  };
}

describe("K1 - base y bonus no encadenados", () => {
  it("70 base + 14 profesion + 21 localizacion + 35 objetos = 140 con gamificacion, 100%/200%", () => {
    const c = cell({
      finalPoints: 140,
      basePointsBeforeProfession: 70,
      baseMax: 70,
      professionBonusPoints: 14,
      locationBonusPoints: 21,
      equipmentBonusPoints: 35,
    });
    const sin = resolveCellValue(c, "sin", false);
    const con = resolveCellValue(c, "con", false);
    expect(sin.x).toBe(70);
    expect(sin.q).toBe(100);
    expect(con.x).toBe(140);
    expect(con.q).toBe(200);
  });

  it("publicacion antigua sin bonus usa finalPoints como fallback documentado", () => {
    const c = cell({ finalPoints: 42, basePointsBeforeProfession: null, baseMax: 70 });
    const resolved = resolveCellBase(c);
    expect(resolved.available).toBe(true);
    expect(resolved.usedLegacyFallback).toBe(true);
    expect(resolved.base).toBe(42);
  });

  it("inconsistencia moderna (bonus sin base) queda como dato base no disponible", () => {
    const c = cell({ finalPoints: 84, basePointsBeforeProfession: null, professionBonusPoints: 14, baseMax: 70 });
    const resolved = resolveCellBase(c);
    expect(resolved.available).toBe(false);
    const sinValue = resolveCellValue(c, "sin", false);
    expect(sinValue.included).toBe(false);
    expect(sinValue.reason).toBe("base_unavailable");
  });
});

describe("K2 - un peso por persona en el periodo", () => {
  it("A con 3 semanas al 80% y B con 1 semana al 40% dan equipo 60%, no 70%", () => {
    const cells = [
      { personId: "A", splitId: "s1", weekKey: "w1", value: 80 },
      { personId: "A", splitId: "s1", weekKey: "w2", value: 80 },
      { personId: "A", splitId: "s1", weekKey: "w3", value: 80 },
      { personId: "B", splitId: "s1", weekKey: "w1", value: 40 },
    ];
    const result = computeHierarchicalAverage(cells);
    expect(result.personPeriodValues.get("A")).toBe(80);
    expect(result.personPeriodValues.get("B")).toBe(40);
    expect(result.teamAverage).toBe(60);
    expect(result.analyzablePersonCount).toBe(2);
  });
});

describe("K3 - dos splits el mismo lunes", () => {
  it("A consolida 60% y 80% en 70%; equipo con B=50% da 60%, no 3 personas", () => {
    const cells = [
      { personId: "A", splitId: "s1", weekKey: "w1", value: 60 },
      { personId: "A", splitId: "s2", weekKey: "w1", value: 80 },
      { personId: "B", splitId: "s1", weekKey: "w1", value: 50 },
    ];
    const perPersonWeek = collapseSimultaneousSplits(cells);
    expect(perPersonWeek.get("A__w1")).toBe(70);
    expect(perPersonWeek.get("B__w1")).toBe(50);
    const perPeriod = collapseWeeksToPersonPeriod(perPersonWeek);
    expect(perPeriod.size).toBe(2);
    const result = computeHierarchicalAverage(cells);
    expect(result.teamAverage).toBe(60);
    expect(result.analyzablePersonCount).toBe(2);
  });
});

function observation(overrides: Partial<ParticipantWeekObservation> = {}): ParticipantWeekObservation {
  return {
    personId: "p1",
    personFullName: "Persona Uno",
    splitId: "s1",
    splitName: "Split 1",
    splitParticipantId: "sp1",
    participantWeeklyResultId: "r1",
    publicationId: "pub1",
    splitWeekId: "w1",
    weekSequenceNumber: 1,
    weekStartDate: new Date(Date.UTC(2026, 8, 7)),
    publishedAt: new Date(),
    levelSnapshot: "N1",
    creditsEarned: 10,
    attendanceStatus: "PRESENT",
    totalHours: 40,
    cells: [cell()],
    ...overrides,
  };
}

describe("K4 - asistencia real sustituye la politica de ceros (1.1.1)", () => {
  it("una persona presente con todos sus KPI a cero permanece dentro del rendimiento", () => {
    const resolved = resolveObservation(
      observation({ cells: [cell({ finalPoints: 0, basePointsBeforeProfession: 0 }), cell({ kpiCode: "DATA_EXPLORER", finalPoints: 0, basePointsBeforeProfession: 0 })] }),
      { mode: "sin" },
    );
    expect(resolved.excluded).toBe(false);
    expect(resolved.totals.totalPointsValid).toBe(0);
  });

  it("una ausencia confirmada queda siempre fuera de rendimiento, aunque tenga KPI positivos residuales", () => {
    const resolved = resolveObservation(
      observation({ attendanceStatus: "ABSENT", totalHours: 0, cells: [cell({ status: "ABSENT", finalPoints: null, basePointsBeforeProfession: null })] }),
      { mode: "sin" },
    );
    expect(resolved.excluded).toBe(true);
    expect(resolved.attendance).toBe("ABSENT");
    expect(resolved.hours).toBeNull();
    expect(resolved.totals.totalPointsValid).toBeNull();
  });

  it("una publicacion anterior a 1.1.1 (attendanceStatus null) queda excluida como cobertura legacy desconocida, no como ausencia", () => {
    const resolved = resolveObservation(observation({ attendanceStatus: null, totalHours: null }), { mode: "sin" });
    expect(resolved.excluded).toBe(true);
    expect(resolved.attendance).toBe("UNKNOWN_LEGACY");
  });

  it("VAC de una persona presente sigue contando como cero real, nunca excluido", () => {
    const vacCell = cell({ status: "VAC", finalPoints: null, basePointsBeforeProfession: null });
    const resolved = resolveCellValue(vacCell, "sin", false);
    expect(resolved.included).toBe(true);
    expect(resolved.x).toBe(0);
  });

  it("una celda ABSENT nunca aporta puntos, incluso si observationExcluded no se propagase", () => {
    const absentCell = cell({ status: "ABSENT", finalPoints: null, basePointsBeforeProfession: null });
    const resolved = resolveCellValue(absentCell, "sin", true);
    expect(resolved.included).toBe(false);
    expect(resolved.reason).toBe("observation_excluded");
  });
});

describe("K5 - composicion del equipo y muestra pequeña", () => {
  it("solo A es comun: +10pp sobre 1 persona, nunca +30pp del equipo completo", () => {
    const current = [
      { personId: "A", level: "N1" as const, value: 70 },
      { personId: "C", level: "N1" as const, value: 90 },
    ];
    const reference = [
      { personId: "A", level: "N1" as const, value: 60 },
      { personId: "B", level: "N1" as const, value: 40 },
    ];
    const comparison = computeCommonPopulationComparison(current, reference);
    expect(comparison.commonPersonIds).toEqual(["A"]);
    expect(comparison.diffPp).toBe(10);
    expect(isSmallSample(comparison.commonPersonIds.length)).toBe(true);
  });
});

describe("K6 - nivel y composicion KPI", () => {
  it("el indice normalizado usa solo KPI con maximo y puntos validos a la vez", () => {
    const totals = computeObservationTotals([
      { included: true, x: 70, max: 70 },
      { included: true, x: 30, max: null },
      { included: false, x: null, max: 50 },
    ]);
    expect(totals.totalPointsValid).toBe(100);
    expect(totals.indexEligibleKpiCount).toBe(1);
    expect(totals.indexNormalized).toBe(100);
  });
});

describe("K7 - referencias vacias, cero y limites", () => {
  it("actual 60 ref 50: +10pp, relativo +20%", () => {
    expect(ppDifference(60, 50)).toBe(10);
    expect(relativeVariation(60, 50)).toBe(20);
  });

  it("actual 20 ref 0: +20pp, relativo no calculable", () => {
    expect(ppDifference(20, 0)).toBe(20);
    expect(relativeVariation(20, 0)).toBeNull();
  });

  it("falta la semana exactamente anterior, aunque haya otra mas antigua", () => {
    const byIsoDate = new Map([["2026-08-24", 55]]);
    const reference = findPreviousWeekReference(byIsoDate, new Date(Date.UTC(2026, 8, 7)));
    expect(reference).toBeNull();
  });

  it("solo existe la semana analizada: la media previa del periodo no existe", () => {
    const analyzed = new Date(Date.UTC(2026, 8, 7));
    const result = computePeriodAverageReference([{ weekStartDate: analyzed, value: 70 }], analyzed);
    expect(result.average).toBeNull();
  });

  it("25/50/75/90/100 pertenecen cada uno a un unico intervalo de distribucion", () => {
    expect(bucketForPercentage(25)).toBe("medio_bajo");
    expect(bucketForPercentage(50)).toBe("medio");
    expect(bucketForPercentage(75)).toBe("alto");
    expect(bucketForPercentage(90)).toBe("muy_alto");
    expect(bucketForPercentage(100)).toBe("muy_alto");
    expect(bucketForPercentage(101)).toBe("sobre_maximo");
    expect(bucketForPercentage(-1)).toBe("negativo");
    const distribution = buildDistribution([25, 50, 75, 90, 100, 101, -1]);
    expect(Object.values(distribution).reduce((a, b) => a + b, 0)).toBe(7);
  });

  it("señales: +5pp o mas es mejora, -5pp o menos es descenso, el resto estable", () => {
    expect(resolveSignal(5)).toBe("mejora");
    expect(resolveSignal(-5)).toBe("descenso");
    expect(resolveSignal(0)).toBe("estable");
    expect(resolveSignal(null)).toBe("sin_referencia");
  });

  it("una racha se interrumpe por un hueco, aunque el resto sume 3 semanas", () => {
    const w = (day: number) => new Date(Date.UTC(2026, 0, day));
    const streaks = detectStreaks(
      [
        { weekStartDate: w(5), qualifies: true },
        { weekStartDate: w(12), qualifies: true },
        { weekStartDate: w(26), qualifies: true },
        { weekStartDate: w(2), qualifies: true },
      ],
      2,
    );
    expect(streaks).toHaveLength(1);
    expect(streaks[0]?.length).toBe(2);
  });

  it("sin datos validos no se muestra cero, empate ni estabilidad", () => {
    const stats = computeDispersionStats([]);
    expect(stats.mean).toBeNull();
    expect(stats.median).toBeNull();
    expect(stats.count).toBe(0);
  });
});

describe("K8 - fechas y economia", () => {
  it("una semana que cruza de diciembre a enero pertenece al mes de su lunes inicial", () => {
    const weekStart = new Date(Date.UTC(2026, 11, 28));
    const key = periodKeyFor("mes", weekStart, "split-1");
    expect(key.label).toBe("diciembre 2026");
  });

  it("dos resultados de 10,8 puntos con 10 creditos cada uno aportan 20, nunca floor(21,6)", () => {
    const entries = [
      { type: "WEEKLY_EARNING" as const, amount: 10, createdAt: new Date() },
      { type: "WEEKLY_EARNING" as const, amount: 10, createdAt: new Date() },
    ];
    expect(sumCreditsIssued(entries)).toBe(20);
  });

  it("saldo al cierre exige historial previo: no es solo ingresos menos compras de la ventana", () => {
    const opening = 15;
    const issued = sumCreditsIssued([{ type: "WEEKLY_EARNING", amount: 10, createdAt: new Date() }]);
    const spent = sumCreditsSpent([{ type: "PURCHASE", amount: -12, createdAt: new Date() }]);
    expect(computeClosingBalance(opening, issued, spent)).toBe(13);
  });
});
