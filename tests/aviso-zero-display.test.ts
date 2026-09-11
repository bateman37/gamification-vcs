import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { buildWorkbookBuffer, PRODUCTIVITY_HEADERS } from "./helpers/xlsx";
import { createPerson } from "@/server/services/person.service";
import { createSplitWithWeeks, activateSplit, listSplitWeeks } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { confirmProductivityImport } from "@/server/services/productivity-import.service";
import { saveStabilityEntries } from "@/server/services/stability-entry.service";
import { publishWeek } from "@/server/services/publish-week.service";
import { computeSplitKpiClassification } from "@/server/services/classification.service";
import { getPersonHistory } from "@/server/services/individual-results.service";
import { formatAvisoCount, AVISO_LABEL } from "@/domain/kpi-load-status-display";
import { resolveKpiResultDisplayPoints } from "@/domain/kpi-outcome-display";
import { resolveWorkChronomancyOutcome } from "@/domain/kpis/chronomancy";
import { resolveStabilityGuardianOutcome } from "@/domain/kpis/stability";
import { resolveEscalationTamerOutcome } from "@/domain/kpis/escalation";
import type { KpiConfigView } from "@/domain/kpis/mapping";

function config(overrides: Partial<KpiConfigView> = {}): KpiConfigView {
  return {
    kpiCode: "WORK_CHRONOMANCY",
    isActive: true,
    baseMax: 60,
    multiplierN0: 1,
    multiplierN1: 1,
    multiplierN2: 1,
    parameters: {},
    ...overrides,
  };
}

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

beforeEach(async () => {
  await resetDatabase();
});

describe("AVISO en pantallas de carga y comprobacion: siempre singular, nunca AVISOS", () => {
  it("formatAvisoCount usa la palabra fija AVISO para 1, 2 y 3", () => {
    expect(formatAvisoCount(1)).toBe("1 AVISO");
    expect(formatAvisoCount(2)).toBe("2 AVISO");
    expect(formatAvisoCount(3)).toBe("3 AVISO");
  });

  it("nunca aparece la palabra AVISOS, sea cual sea el contador", () => {
    for (const count of [0, 1, 2, 3, 4, 10]) {
      expect(formatAvisoCount(count)).not.toMatch(/AVISOS/);
      expect(formatAvisoCount(count)).toBe(`${count} ${AVISO_LABEL}`);
    }
  });
});

describe("resolveKpiResultDisplayPoints: VAC/ausencia justificada como 0, No aplica diferenciado", () => {
  it("un resultado VAC se muestra como el valor numerico 0", () => {
    expect(resolveKpiResultDisplayPoints("VAC", null)).toBe(0);
  });

  it("No aplica nunca se convierte visualmente en 0", () => {
    expect(resolveKpiResultDisplayPoints("NOT_APPLICABLE", null)).toBeNull();
    expect(resolveKpiResultDisplayPoints("NOT_APPLICABLE", 42)).toBeNull();
  });

  it("un resultado negativo se sigue mostrando como negativo", () => {
    expect(resolveKpiResultDisplayPoints("COMPUTED", -12.5)).toBe(-12.5);
  });

  it("nunca produce NaN/undefined: un COMPUTED sin puntos cae a 0", () => {
    expect(resolveKpiResultDisplayPoints("COMPUTED", undefined)).toBe(0);
    expect(resolveKpiResultDisplayPoints("COMPUTED", null)).toBe(0);
  });
});

describe("Cronomagia laboral con 0/0: VAC internamente, 0 puntos en resultados", () => {
  it("totalHours = 0 sigue siendo VAC a nivel interno (sin cambiar la regla)", () => {
    const outcome = resolveWorkChronomancyOutcome(config(), "N1", 0, 0);
    expect(outcome.status).toBe("vac");
  });

  it("un resultado VAC de Cronomagia se muestra como 0 puntos en resultados/historico", () => {
    expect(resolveKpiResultDisplayPoints("VAC", null)).toBe(0);
  });
});

describe("Guardian de la Estabilidad sin dato se muestra como 0 en resultados", () => {
  it("no_data sigue siendo el estado interno (sin cambiar la regla)", () => {
    const outcome = resolveStabilityGuardianOutcome(config({ kpiCode: "STABILITY_GUARDIAN", multiplierN2: 1 }), "N2", undefined);
    expect(outcome.status).toBe("no_data");
  });

  it("se muestra como 0, nunca como celda vacia", () => {
    expect(resolveKpiResultDisplayPoints("VAC", null)).toBe(0);
  });
});

describe("Domador de Escaladas: actualizaciones y reasignaciones ausentes, calculo normal (no AVISO)", () => {
  it("con updates > 0 y sin fila de Escalados, el cero implicito se calcula con normalidad", () => {
    const outcome = resolveEscalationTamerOutcome(
      config({ kpiCode: "ESCALATION_TAMER", multiplierN1: 1, baseMax: 30, parameters: { basePoints: 30, ratioPenaltyFactor: 200 } }),
      "N1",
      { hasEscalationImport: true, groupReassignments: undefined, updates: 192 },
    );
    expect(outcome.status).toBe("computed");
    if (outcome.status !== "computed") throw new Error("esperaba 'computed'");
    expect(outcome.inferred).toBe(true);
    expect(resolveKpiResultDisplayPoints("COMPUTED", outcome.finalPoints.toNumber())).toBeCloseTo(30, 5);
  });

  it("sin fila de Escalados ni de Productividad, es VAC y se muestra como 0", () => {
    const outcome = resolveEscalationTamerOutcome(
      config({ kpiCode: "ESCALATION_TAMER", multiplierN1: 1 }),
      "N1",
      { hasEscalationImport: true, groupReassignments: undefined, updates: undefined },
    );
    expect(outcome.status).toBe("vac");
    expect(resolveKpiResultDisplayPoints("VAC", null)).toBe(0);
  });
});

describe("Clasificacion e historico: una semana VAC participa en sumas/rankings como un cero real", () => {
  async function buildSplitWithOneVacWeek() {
    const split = await createSplitWithWeeks(testDb, {
      name: "Split AVISO/0",
      description: undefined,
      startDate: "2025-10-06",
      numberOfWeeks: 2,
    });
    const person = await createPerson(testDb, { fullName: "Persona Uno", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Uno", level: "N1", startWeekSequenceNumber: 1 });
    const otherPerson = await createPerson(testDb, { fullName: "Persona Otra", email: undefined });
    await addParticipant(testDb, split.id, { personId: otherPerson.id, alias: "Otra", level: "N1", startWeekSequenceNumber: 1 });

    await updateKpiConfig(testDb, split.id, "SOLUTION_HUNTER", {
      isActive: true, baseMax: 70, multiplierN1: 1, parameters: { pointsPerResolvedTicket: 1 },
    });
    await activateSplit(testDb, split.id);
    const [week1, week2] = await listSplitWeeks(testDb, split.id);

    // Semana 1: Persona Uno resuelve 20 tickets (20 puntos); Persona Otra tambien tiene fila.
    const buffer1 = await buildWorkbookBuffer([
      PRODUCTIVITY_HEADERS,
      ["Persona Uno", 5, 0, 0, 0, 0, 20, 0],
      ["Persona Otra", 5, 0, 0, 0, 0, 5, 0],
    ]);
    await confirmProductivityImport(testDb, split.id, week1!.id, { buffer: buffer1, originalFilename: "semana1.xlsx" });

    // Semana 2: la carga existe (Cargado, no bloquea publicar) pero Persona Uno no aparece: VAC.
    const buffer2 = await buildWorkbookBuffer([PRODUCTIVITY_HEADERS, ["Persona Otra", 5, 0, 0, 0, 0, 5, 0]]);
    await confirmProductivityImport(testDb, split.id, week2!.id, { buffer: buffer2, originalFilename: "semana2.xlsx" });

    await publishWeek(testDb, split.id, week1!.id, null);
    await publishWeek(testDb, split.id, week2!.id, null);

    return { split, person, participant };
  }

  it("computeSplitKpiClassification: la semana VAC cuenta en el promedio (antes se excluia por completo)", async () => {
    const { split } = await buildSplitWithOneVacWeek();

    const entries = await computeSplitKpiClassification(testDb, split.id, "SOLUTION_HUNTER", null);
    const entryUno = entries.find((entry) => entry.alias === "Uno")!;

    expect(entryUno.sum).toBe(20); // la semana VAC aporta 0 a la suma, como cualquier otro cero.
    expect(entryUno.includedWeekCount).toBe(2); // antes del hotfix solo contaba 1 (excluia la semana VAC).
    expect(entryUno.average).toBeCloseTo(10, 5); // 20 / 2, no 20 / 1.
  });

  it("getPersonHistory: la semana VAC participa en la suma/media del periodo como un cero real", async () => {
    const { person } = await buildSplitWithOneVacWeek();

    const history = await getPersonHistory(testDb, person.id, { year: "todos", splitId: "todos", grouping: "año" });
    expect(history.groups).toHaveLength(1);
    const kpiBreakdown = history.groups[0]!.perKpi.find((kpi) => kpi.kpiCode === "SOLUTION_HUNTER")!;

    expect(kpiBreakdown.sum).toBe(20);
    expect(kpiBreakdown.includedWeekCount).toBe(2);
    expect(kpiBreakdown.average).toBeCloseTo(10, 5);
    expect(kpiBreakdown.vacCount).toBe(1); // se conserva internamente, aunque ya no se muestre como texto VAC.
  });

  it("No aplica nunca participa en la clasificacion por KPI ni se convierte en cero", async () => {
    const split = await createSplitWithWeeks(testDb, {
      name: "Split No Aplica",
      description: undefined,
      startDate: "2025-10-06",
      numberOfWeeks: 1,
    });
    const personN2 = await createPerson(testDb, { fullName: "Persona N2", email: undefined });
    const participantN2 = await addParticipant(testDb, split.id, { personId: personN2.id, alias: "N2", level: "N2", startWeekSequenceNumber: 1 });
    const personN0 = await createPerson(testDb, { fullName: "Persona N0", email: undefined });
    const participantN0 = await addParticipant(testDb, split.id, { personId: personN0.id, alias: "N0", level: "N0", startWeekSequenceNumber: 1 });

    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", {
      isActive: true, baseMax: 30, multiplierN2: 1, parameters: { pointsPerResult: 30 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participantN2.id}`]: "1" }));
    await publishWeek(testDb, split.id, week.id, null);

    const entries = await computeSplitKpiClassification(testDb, split.id, "STABILITY_GUARDIAN", null);
    expect(entries.find((entry) => entry.splitParticipantId === participantN0.id)).toBeUndefined();
    expect(entries.find((entry) => entry.splitParticipantId === participantN2.id)?.sum).toBe(30);
  });
});
