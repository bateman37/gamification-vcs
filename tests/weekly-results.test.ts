import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { buildWorkbookBuffer, PRODUCTIVITY_HEADERS, ESCALATION_HEADERS } from "./helpers/xlsx";
import { createPerson } from "@/server/services/person.service";
import { createSplitWithWeeks, activateSplit, listSplitWeeks } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { confirmProductivityImport } from "@/server/services/productivity-import.service";
import { confirmEscalationImport } from "@/server/services/escalation-import.service";
import { saveWriterEntries } from "@/server/services/writer-entry.service";
import { computeWeeklyResults } from "@/server/services/weekly-results.service";
import { KPI_CATALOG_LIST } from "@/domain/kpis/catalog";
import { markAllPresent } from "./helpers/attendance";

async function createDraftSplit(numberOfWeeks = 1) {
  return createSplitWithWeeks(testDb, {
    name: "Split resultados semanales",
    description: undefined,
    startDate: "2025-10-06",
    numberOfWeeks,
  });
}

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

beforeEach(async () => {
  await resetDatabase();
});

describe("computeWeeklyResults: semana incompleta", () => {
  it("no calcula participantes y expone la completitud pendiente", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Incompleta", email: undefined });
    await addParticipant(testDb, split.id, { personId: person.id, alias: "Incompleto", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "SOLUTION_HUNTER", {
      isActive: true, baseMax: 70, multiplierN1: 1, parameters: { pointsPerResolvedTicket: 1 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    expect(results.isComplete).toBe(false);
    expect(results.participants).toEqual([]);
    expect(results.completeness).toEqual({ loadedCount: 0, totalActiveCount: 1 });
  });
});

describe("computeWeeklyResults: agregado completo con VAC, negativos, ranking y puntos por posicion", () => {
  it("suma sin perder negativos, excluye VAC del maximo aplicable, ordena por catalogo y aplica ranking 1,2,2,4", async () => {
    const split = await createDraftSplit();

    const personNames = ["P1", "P2", "P3", "P4"];
    const persons = await Promise.all(personNames.map((name) => createPerson(testDb, { fullName: `Persona ${name}`, email: undefined })));
    const participants = await Promise.all(
      persons.map((person, index) => addParticipant(testDb, split.id, { personId: person.id, alias: personNames[index]!, level: "N1", startWeekSequenceNumber: 1 })),
    );
    const [p1, p2, p3, p4] = participants;

    // SOLUTION_HUNTER (baseMax 70, multiplicador N1 x1, 1 punto por ticket resuelto).
    await updateKpiConfig(testDb, split.id, "SOLUTION_HUNTER", {
      isActive: true, baseMax: 70, multiplierN1: 1, parameters: { pointsPerResolvedTicket: 1 },
    });
    // STAR_WRITER (baseMax 60, multiplicador N1 x2, 10 por entregado, 10 por no entregado, 5 por propuesta).
    await updateKpiConfig(testDb, split.id, "STAR_WRITER", {
      isActive: true, baseMax: 60, multiplierN1: 2, parameters: { approvedArticlePoints: 10, negativeArticlePoints: 10, proposalPoints: 5 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    // Productividad: P1 y P2 resuelven 10 tickets cada uno (empate); P3 y P4 no aparecen en el fichero (VAC).
    const productivityBuffer = await buildWorkbookBuffer([
      PRODUCTIVITY_HEADERS,
      ["Persona P1", 5, 0, 0, 0, 0, 10, 0],
      ["Persona P2", 5, 0, 0, 0, 0, 10, 0],
    ]);
    await confirmProductivityImport(testDb, split.id, week.id, { buffer: productivityBuffer, originalFilename: "productividad.xlsx" });

    // Redactor estrella: P1 negativo, P2 capado al maximo, P3 y P4 con el mismo resultado (empate en su KPI).
    await saveWriterEntries(
      testDb,
      split.id,
      week.id,
      form({
        [`deliveredArticles__${p1!.id}`]: "0",
        [`undeliveredArticles__${p1!.id}`]: "5",
        [`proposedArticles__${p1!.id}`]: "0",
        [`deliveredArticles__${p2!.id}`]: "3",
        [`undeliveredArticles__${p2!.id}`]: "0",
        [`proposedArticles__${p2!.id}`]: "0",
        [`deliveredArticles__${p3!.id}`]: "1",
        [`undeliveredArticles__${p3!.id}`]: "0",
        [`proposedArticles__${p3!.id}`]: "0",
        [`deliveredArticles__${p4!.id}`]: "1",
        [`undeliveredArticles__${p4!.id}`]: "0",
        [`proposedArticles__${p4!.id}`]: "0",
      }),
    );
    await markAllPresent(testDb, split.id, week.id);

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    expect(results.isComplete).toBe(true);
    expect(results.blockingIssues).toEqual([]);
    expect(results.totalParticipantCount).toBe(4);

    // Orden de KPI activos segun el catalogo, no el orden de insercion en la base de datos.
    const activeOrderInCatalog = KPI_CATALOG_LIST.filter((entry) => results.activeKpiCodes.includes(entry.code)).map((entry) => entry.code);
    expect(results.activeKpiCodes).toEqual(activeOrderInCatalog);
    expect(results.activeKpiCodes).toEqual(["SOLUTION_HUNTER", "STAR_WRITER"]);

    const byAlias = new Map(results.participants.map((participant) => [participant.alias, participant]));
    const p1Result = byAlias.get("P1")!;
    const p2Result = byAlias.get("P2")!;
    const p3Result = byAlias.get("P3")!;
    const p4Result = byAlias.get("P4")!;

    // P1: 10 (Cazador) - 50 (Redactor, negativo sin suelo de cero) = -40.
    expect(p1Result.totalKpiPoints).toBe(-40);
    expect(p1Result.applicableMaxPoints).toBe(130); // 70 + 60, ambos COMPUTED.

    // P2: 10 + 60 (justo en el maximo) = 70.
    expect(p2Result.totalKpiPoints).toBe(70);
    const p2Writer = p2Result.kpiResults.find((entry) => entry.kpiCode === "STAR_WRITER")!;
    // 60 iguala exactamente el maximo: no cuenta como "capado" (el tope solo actua al superarlo).
    expect(p2Writer).toMatchObject({ status: "COMPUTED", rawPoints: 60, finalPoints: 60, capped: false });

    // P3 y P4: VAC en Cazador (0, sin maximo en el denominador) + 20 en Redactor = 20 cada uno (empate).
    expect(p3Result.totalKpiPoints).toBe(20);
    expect(p4Result.totalKpiPoints).toBe(20);
    expect(p3Result.applicableMaxPoints).toBe(60); // solo el maximo de Redactor: Cazador esta VAC.
    const p3Hunter = p3Result.kpiResults.find((entry) => entry.kpiCode === "SOLUTION_HUNTER")!;
    // El estado VAC conserva el maximo configurado a modo informativo (solo "No aplica" lo deja en null), pero no entra en applicableMaxPoints.
    expect(p3Hunter).toMatchObject({ status: "VAC", finalPoints: null, baseMax: 70 });

    // Ranking semanal 1, 2, 2, 4 (P2=70 -> 1; P3 y P4=20 -> 2; P1=-40 -> 4, salta el 3).
    expect(p2Result.weeklyRank).toBe(1);
    expect(p3Result.weeklyRank).toBe(2);
    expect(p4Result.weeklyRank).toBe(2);
    expect(p1Result.weeklyRank).toBe(4);

    // Puntos por posicion de Split 8 por defecto: 1->15, 2->11, 4->5.
    expect(p2Result.positionPoints).toBe(15);
    expect(p3Result.positionPoints).toBe(11);
    expect(p4Result.positionPoints).toBe(11);
    expect(p1Result.positionPoints).toBe(5);

    // Ranking por KPI excluye VAC: en Cazador solo compiten P1 y P2 (empatados en 1 de 2).
    const p1Hunter = p1Result.kpiResults.find((entry) => entry.kpiCode === "SOLUTION_HUNTER")!;
    const p2Hunter = p2Result.kpiResults.find((entry) => entry.kpiCode === "SOLUTION_HUNTER")!;
    expect(p1Hunter.kpiRank).toBe(1);
    expect(p2Hunter.kpiRank).toBe(1);
    expect(p1Hunter.rankedParticipantCount).toBe(2);
    const p4Hunter = p4Result.kpiResults.find((entry) => entry.kpiCode === "SOLUTION_HUNTER")!;
    expect(p4Hunter.kpiRank).toBeNull();

    // vacCount por KPI y total.
    expect(results.vacCountsByKpi.SOLUTION_HUNTER).toBe(2);
    expect(results.vacCountsByKpi.STAR_WRITER).toBe(0);
    expect(results.totalVacCount).toBe(2);
  });

  it("bloquea con un mensaje claro si falta la regla de puntos para una posicion producida", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Sin Regla", email: undefined });
    await addParticipant(testDb, split.id, { personId: person.id, alias: "SinRegla", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "SOLUTION_HUNTER", {
      isActive: true, baseMax: 70, multiplierN1: 1, parameters: { pointsPerResolvedTicket: 1 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    const buffer = await buildWorkbookBuffer([PRODUCTIVITY_HEADERS, ["Persona Sin Regla", 5, 0, 0, 0, 0, 10, 0]]);
    await confirmProductivityImport(testDb, split.id, week.id, { buffer, originalFilename: "productividad.xlsx" });

    await testDb.splitPositionPointRule.delete({ where: { splitId_position: { splitId: split.id, position: 1 } } });
    await markAllPresent(testDb, split.id, week.id);

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    expect(results.isComplete).toBe(true);
    expect(results.blockingIssues.some((issue) => issue.includes("posicion 1"))).toBe(true);
    expect(results.participants[0]?.positionPoints).toBeNull();
  });
});

describe("computeWeeklyResults: Domador de Escaladas, actualizaciones en cero y falta de Productividad", () => {
  it("trata actualizaciones en cero como ratio 0 (computado) y senala como bloqueante la falta de Productividad", async () => {
    const split = await createDraftSplit();
    const personZero = await createPerson(testDb, { fullName: "Persona Cero Actualizaciones", email: undefined });
    const personSinProductividad = await createPerson(testDb, { fullName: "Persona Sin Productividad", email: undefined });
    const participantZero = await addParticipant(testDb, split.id, { personId: personZero.id, alias: "CeroActualizaciones", level: "N1", startWeekSequenceNumber: 1 });
    const participantSinProductividad = await addParticipant(testDb, split.id, { personId: personSinProductividad.id, alias: "SinProductividad", level: "N1", startWeekSequenceNumber: 1 });

    await updateKpiConfig(testDb, split.id, "ESCALATION_TAMER", {
      isActive: true, baseMax: 30, multiplierN1: 1, parameters: { basePoints: 30, ratioPenaltyFactor: 200 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    // Productividad solo tiene fila (con 0 actualizaciones) para "personZero"; "personSinProductividad" no aparece.
    const productivityBuffer = await buildWorkbookBuffer([
      PRODUCTIVITY_HEADERS,
      ["Persona Cero Actualizaciones", 0, 0, 0, 0, 0, 0, 0],
    ]);
    await confirmProductivityImport(testDb, split.id, week.id, { buffer: productivityBuffer, originalFilename: "productividad.xlsx" });

    // Escalados tiene fila para ambos.
    const escalationBuffer = await buildWorkbookBuffer([
      ESCALATION_HEADERS,
      ["Persona Cero Actualizaciones", 0],
      ["Persona Sin Productividad", 1],
    ]);
    await confirmEscalationImport(testDb, split.id, week.id, { buffer: escalationBuffer, originalFilename: "escalados.xlsx" });
    await markAllPresent(testDb, split.id, week.id);

    const results = await computeWeeklyResults(testDb, split.id, week.id);
    expect(results.isComplete).toBe(true);

    const zeroResult = results.participants.find((participant) => participant.splitParticipantId === participantZero.id)!;
    const tamerZero = zeroResult.kpiResults.find((entry) => entry.kpiCode === "ESCALATION_TAMER")!;
    // basePoints (30) x multiplicador (1), sin penalizacion porque el ratio se interpreta como 0 con actualizaciones en 0.
    expect(tamerZero).toMatchObject({ status: "COMPUTED", finalPoints: 30 });

    const missingResult = results.participants.find((participant) => participant.splitParticipantId === participantSinProductividad.id)!;
    const tamerMissing = missingResult.kpiResults.find((entry) => entry.kpiCode === "ESCALATION_TAMER")!;
    expect(tamerMissing.status).toBe("VAC");
    expect(results.blockingIssues.some((issue) => issue.includes("Sin Productividad".replace(" ", "")) || issue.includes("SinProductividad"))).toBe(true);
  });
});
