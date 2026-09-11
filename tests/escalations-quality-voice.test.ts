import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import {
  buildWorkbookBuffer,
  ESCALATION_HEADERS,
  QUALITY_HEADERS,
  VOICE_HEADERS,
  type XlsxCellInput,
} from "./helpers/xlsx";
import { createPerson } from "@/server/services/person.service";
import { activateSplit, createSplitWithWeeks, listSplitWeeks } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { confirmProductivityImport } from "@/server/services/productivity-import.service";
import { readEscalationWorkbook } from "@/server/services/escalation/excel-reader";
import { readQualityWorkbook } from "@/server/services/quality/excel-reader";
import { readVoiceWorkbook } from "@/server/services/voice/excel-reader";
import {
  confirmEscalationImport,
  getEscalationCheckView,
  getEscalationLoadStatus,
  previewEscalationImport,
} from "@/server/services/escalation-import.service";
import {
  confirmQualityImport,
  getQualityCheckView,
  getQualityLoadStatus,
  previewQualityImport,
} from "@/server/services/quality-import.service";
import { confirmVoiceImport, getVoiceLoadStatus, previewVoiceImport } from "@/server/services/voice-import.service";
import { calculateEscalationTamerPoints, resolveEscalationTamerOutcome } from "@/domain/kpis/escalation";
import { calculateMasterCraftsmanPoints } from "@/domain/kpis/quality";
import { calculateVoiceAmbassadorPoints } from "@/domain/kpis/voice";
import type { KpiConfigView } from "@/domain/kpis/mapping";
import { DomainError } from "@/lib/errors";

async function createDraftSplit(numberOfWeeks = 2) {
  return createSplitWithWeeks(testDb, {
    name: "Split de escalados, calidad y voz",
    description: undefined,
    startDate: "2025-10-06",
    numberOfWeeks,
  });
}

async function activateWithAllThree(splitId: string) {
  await updateKpiConfig(testDb, splitId, "ESCALATION_TAMER", {
    isActive: true,
    baseMax: 30,
    multiplierN0: 1,
    multiplierN1: 1,
    multiplierN2: 1,
    parameters: { basePoints: 30, ratioPenaltyFactor: 200 },
  });
  await updateKpiConfig(testDb, splitId, "MASTER_CRAFTSMAN", {
    isActive: true,
    baseMax: 100,
    multiplierN0: 3,
    multiplierN1: 2,
    multiplierN2: 2,
    parameters: { positiveWeight: 1, negativePenalty: 4, scale: 10 },
  });
  await updateKpiConfig(testDb, splitId, "VOICE_AMBASSADOR", {
    isActive: true,
    baseMax: 50,
    multiplierN0: 1.25,
    multiplierN1: 1.5,
    multiplierN2: 2,
    parameters: { acceptedWeight: 1, rejectedPenalty: 1, unattendedPenalty: 1, outboundPoints: 1 },
  });
  return activateSplit(testDb, splitId);
}

async function setupActiveSplitWithParticipant(fullName = "Ana Torres Vidal") {
  const split = await createDraftSplit();
  const person = await createPerson(testDb, { fullName, email: undefined });
  const participant = await addParticipant(testDb, split.id, {
    personId: person.id,
    alias: "Ana",
    level: "N1",
    startWeekSequenceNumber: 1,
  });
  await activateWithAllThree(split.id);
  const week = (await listSplitWeeks(testDb, split.id))[0]!;
  return { split, person, participant, week };
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Lectura de los tres Excel (Escalados, Calidad, Llamadas)", () => {
  const scenarios = [
    {
      name: "Escalados: columnas reordenadas y una columna extra",
      run: async () => {
        const headers: XlsxCellInput[] = ["Columna extra sin uso", "Reasignaciones de grupo", "Nombre del actualizador"];
        const buffer = await buildWorkbookBuffer([headers, ["ignorar", 3, "Marta Ruiz Soler"]]);
        const result = await readEscalationWorkbook(buffer);
        expect(result.errors).toHaveLength(0);
        expect(result.rows).toEqual([{ rowNumber: 2, sourceAgentName: "Marta Ruiz Soler", groupReassignments: 3 }]);
      },
    },
    {
      name: "Calidad: columnas reordenadas y una columna extra",
      run: async () => {
        const headers: XlsxCellInput[] = [
          "Tickets con satisfacción mala",
          "Columna extra sin uso",
          "Nombre del agente asignado",
          "Tickets con satisfacción buena",
        ];
        const buffer = await buildWorkbookBuffer([headers, [1, "ignorar", "Pedro Gomez Diaz", 5]]);
        const result = await readQualityWorkbook(buffer);
        expect(result.errors).toHaveLength(0);
        expect(result.rows).toEqual([
          { rowNumber: 2, sourceAgentName: "Pedro Gomez Diaz", goodSatisfactionTickets: 5, badSatisfactionTickets: 1 },
        ]);
      },
    },
    {
      name: "Llamadas: columnas reordenadas y una columna extra",
      run: async () => {
        const headers: XlsxCellInput[] = [...VOICE_HEADERS.slice(1), "Columna extra sin uso", VOICE_HEADERS[0]!];
        const buffer = await buildWorkbookBuffer([headers, [14, 0, 6, 10, 1.5, 1.2, 0.3, 90, 18, "ignorar", "Ana Lopez"]]);
        const result = await readVoiceWorkbook(buffer);
        expect(result.errors).toHaveLength(0);
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]?.sourceAgentName).toBe("Ana Lopez");
        expect(result.rows[0]?.acceptedCallSegments).toBe(14);
        expect(result.rows[0]?.outboundCalls).toBe(10);
        expect(result.rows[0]?.segmentDurationHours.toNumber()).toBe(1.5);
      },
    },
  ];

  it.each(scenarios)("$name", async ({ run }) => {
    await run();
  });
});

describe("Validaciones criticas del lector de Escalados", () => {
  it.each([
    {
      name: "rechaza cuando falta un encabezado obligatorio",
      rows: [ESCALATION_HEADERS.filter((header) => header !== "Reasignaciones de grupo"), ["Marta Ruiz Soler"]],
      expectValid: false,
    },
    {
      name: "rechaza un valor obligatorio vacio",
      rows: [ESCALATION_HEADERS, ["Marta Ruiz Soler", ""]],
      expectValid: false,
    },
    {
      name: "rechaza un numero negativo",
      rows: [ESCALATION_HEADERS, ["Marta Ruiz Soler", -1]],
      expectValid: false,
    },
    {
      name: "rechaza un decimal donde se exige un entero",
      rows: [ESCALATION_HEADERS, ["Marta Ruiz Soler", 2.5]],
      expectValid: false,
    },
    {
      name: "rechaza una formula",
      rows: [ESCALATION_HEADERS, ["Marta Ruiz Soler", { formula: "1+2", result: 3 }]],
      expectValid: false,
    },
    {
      name: "rechaza dos nombres iguales tras normalizarlos",
      rows: [ESCALATION_HEADERS, ["  MARTA   ruiz soler ", 1], ["Marta Ruiz Soler", 2]],
      expectValid: false,
    },
    {
      name: "conserva un conteo en cero como dato real",
      rows: [ESCALATION_HEADERS, ["Marta Ruiz Soler", 0]],
      expectValid: true,
    },
  ])("$name", async ({ rows, expectValid }) => {
    const buffer = await buildWorkbookBuffer(rows as XlsxCellInput[][]);
    const result = await readEscalationWorkbook(buffer);

    if (expectValid) {
      expect(result.errors).toHaveLength(0);
      expect(result.rows[0]?.groupReassignments).toBe(0);
    } else {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});

describe("Metricas de tiempo de Llamadas", () => {
  it("acepta coma o punto decimal, rechaza formatos invalidos y persiste con precision decimal", async () => {
    const validBuffer = await buildWorkbookBuffer([
      VOICE_HEADERS,
      ["Ana Lopez", 14, 0, 6, 10, "1,123456", "1.2", 0.3, "90,5", 18],
    ]);
    const validResult = await readVoiceWorkbook(validBuffer);
    expect(validResult.errors).toHaveLength(0);
    expect(validResult.rows[0]?.segmentDurationHours.toString()).toBe("1.123456");
    expect(validResult.rows[0]?.segmentTalkTimeMinutes.toString()).toBe("90.5");

    const invalidBuffer = await buildWorkbookBuffer([
      VOICE_HEADERS,
      ["Ana Lopez", 14, 0, 6, 10, "1.234,56", 1.2, 0.3, 90, 18],
    ]);
    const invalidResult = await readVoiceWorkbook(invalidBuffer);
    expect(invalidResult.errors.length).toBeGreaterThan(0);

    const { split, participant, week } = await setupActiveSplitWithParticipant("Ana Lopez");
    await confirmVoiceImport(testDb, split.id, week.id, { buffer: validBuffer, originalFilename: "llamadas.xlsx" });
    const persisted = await testDb.voiceWeeklyRow.findFirstOrThrow({ where: { splitParticipantId: participant.id } });
    expect(persisted.segmentDurationHours.toString()).toBe("1.123456");
  });
});

describe("Calculos de los tres KPI", () => {
  it("reproduce los ejemplos sinteticos de referencia, sin suelo de cero y con el maximo aplicado despues del calculo", () => {
    const escalation = calculateEscalationTamerPoints(3, 192, 30, 200, 1, 30);
    expect(escalation.finalPoints.toNumber()).toBe(26.875);
    expect(escalation.capped).toBe(false);

    const qualityPositive = calculateMasterCraftsmanPoints(2, 0, 1, 4, 10, 2, 100);
    expect(qualityPositive.finalPoints.toNumber()).toBe(40);

    const qualityNegative = calculateMasterCraftsmanPoints(0, 1, 1, 4, 10, 2, 100);
    expect(qualityNegative.finalPoints.toNumber()).toBe(-80);
    expect(qualityNegative.capped).toBe(false);

    const voice = calculateVoiceAmbassadorPoints(14, 0, 6, 10, 1, 1, 1, 1, 2, 50);
    expect(voice.finalPoints.toNumber()).toBe(26);

    const cappedQuality = calculateMasterCraftsmanPoints(50, 0, 1, 4, 10, 2, 100);
    expect(cappedQuality.rawPoints.toNumber()).toBe(1000);
    expect(cappedQuality.finalPoints.toNumber()).toBe(100);
    expect(cappedQuality.capped).toBe(true);
  });
});

describe("Domador de Escaladas: union por semana/participante", () => {
  it("distingue calculado, sin dato de Escalados, falta Productividad y denominador cero", async () => {
    const split = await createDraftSplit();
    const both = await createPerson(testDb, { fullName: "Ambos Origenes", email: undefined });
    const onlyProductivity = await createPerson(testDb, { fullName: "Solo Productividad", email: undefined });
    const onlyEscalation = await createPerson(testDb, { fullName: "Solo Escalados", email: undefined });
    const zeroUpdates = await createPerson(testDb, { fullName: "Actualizaciones Cero", email: undefined });

    const participants = await Promise.all(
      [
        { person: both, alias: "Ambos" },
        { person: onlyProductivity, alias: "SoloProd" },
        { person: onlyEscalation, alias: "SoloEsc" },
        { person: zeroUpdates, alias: "CeroAct" },
      ].map((entry) =>
        addParticipant(testDb, split.id, {
          personId: entry.person.id,
          alias: entry.alias,
          level: "N1",
          startWeekSequenceNumber: 1,
        }),
      ),
    );
    const [participantBoth, , , participantZero] = participants;

    await activateWithAllThree(split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    const productivityBuffer = await buildWorkbookBuffer([
      ["Nombre del actualizador", "Actualizaciones", "Comentarios", "Comentarios públicos", "Comentarios internos", "Tickets actualizados con comentario", "Tickets resueltos", "Tickets creados"],
      ["Ambos Origenes", 192, 0, 0, 0, 0, 0, 0],
      ["Solo Productividad", 100, 0, 0, 0, 0, 0, 0],
      ["Actualizaciones Cero", 0, 0, 0, 0, 0, 0, 0],
    ]);
    await confirmProductivityImport(testDb, split.id, week.id, { buffer: productivityBuffer, originalFilename: "productividad.xlsx" });

    const escalationBuffer = await buildWorkbookBuffer([
      ESCALATION_HEADERS,
      ["Ambos Origenes", 3],
      ["Solo Escalados", 5],
      ["Actualizaciones Cero", 2],
    ]);
    await confirmEscalationImport(testDb, split.id, week.id, { buffer: escalationBuffer, originalFilename: "escalados.xlsx" });

    const checkView = await getEscalationCheckView(testDb, split.id, week.id);
    const byAlias = new Map(checkView.rows.map((row) => [row.alias, row]));

    expect(byAlias.get("Ambos")?.escalationTamer).toMatchObject({ status: "computed", finalPoints: 26.875 });
    expect(byAlias.get("SoloProd")?.escalationTamer).toEqual({ status: "no_escalation_data" });
    expect(byAlias.get("SoloEsc")?.escalationTamer).toEqual({ status: "no_productivity_data" });
    expect(byAlias.get("CeroAct")?.escalationTamer).toEqual({ status: "zero_updates" });

    // Union directa por participante y semana, sin depender de la vista de comprobacion.
    const updatesForBoth = (await testDb.productivityWeeklyRow.findFirstOrThrow({
      where: { splitParticipantId: participantBoth!.id },
    })).updates;
    const config: KpiConfigView = {
      kpiCode: "ESCALATION_TAMER",
      isActive: true,
      baseMax: 30,
      multiplierN0: 1,
      multiplierN1: 1,
      multiplierN2: 1,
      parameters: { basePoints: 30, ratioPenaltyFactor: 200 },
    };
    const outcome = resolveEscalationTamerOutcome(config, "N1", 3, updatesForBoth);
    expect(outcome.status).toBe("computed");

    const zeroOutcome = resolveEscalationTamerOutcome(config, "N1", 2, 0);
    expect(zeroOutcome).toEqual({ status: "zero_updates" });
    expect(participantZero).toBeDefined();
  });
});

describe("Matriz de estados de Domador de Escaladas", () => {
  it("rojo sin ningun origen, amarillo con exactamente uno, verde con ambos y expone n VAC solo en verde", async () => {
    const { split, week } = await setupActiveSplitWithParticipant("Marta Ruiz Soler");
    const missingPerson = await createPerson(testDb, { fullName: "Persona Sin Datos", email: undefined });
    await addParticipant(testDb, split.id, {
      personId: missingPerson.id,
      alias: "SinDatos",
      level: "N1",
      startWeekSequenceNumber: 1,
    });

    expect(await getEscalationLoadStatus(testDb, split.id, week.id, week.sequenceNumber)).toEqual({
      status: "PENDING",
      vacCount: 0,
    });

    const productivityBuffer = await buildWorkbookBuffer([
      ["Nombre del actualizador", "Actualizaciones", "Comentarios", "Comentarios públicos", "Comentarios internos", "Tickets actualizados con comentario", "Tickets resueltos", "Tickets creados"],
      ["Marta Ruiz Soler", 100, 0, 0, 0, 0, 0, 0],
    ]);
    await confirmProductivityImport(testDb, split.id, week.id, { buffer: productivityBuffer, originalFilename: "productividad.xlsx" });

    expect((await getEscalationLoadStatus(testDb, split.id, week.id, week.sequenceNumber)).status).toBe("PARTIAL");

    const escalationBuffer = await buildWorkbookBuffer([ESCALATION_HEADERS, ["Marta Ruiz Soler", 3]]);
    await confirmEscalationImport(testDb, split.id, week.id, { buffer: escalationBuffer, originalFilename: "escalados.xlsx" });

    const loaded = await getEscalationLoadStatus(testDb, split.id, week.id, week.sequenceNumber);
    expect(loaded.status).toBe("LOADED");
    expect(loaded.vacCount).toBe(1);
  });
});

describe("Confirmacion y sustitucion independiente de Calidad, Llamadas y Escalados", () => {
  it("sustituye un origen sin tocar los demas, conserva la carga anterior si la nueva falla y expone n VAC en verde", async () => {
    const { split, week } = await setupActiveSplitWithParticipant("Marta Ruiz Soler");

    const qualityV1 = await buildWorkbookBuffer([QUALITY_HEADERS, ["Marta Ruiz Soler", 2, 0]]);
    await confirmQualityImport(testDb, split.id, week.id, { buffer: qualityV1, originalFilename: "calidad-v1.xlsx" });
    const voiceBuffer = await buildWorkbookBuffer([VOICE_HEADERS, ["Marta Ruiz Soler", 14, 0, 6, 10, 1, 1, 1, 1, 1]]);
    await confirmVoiceImport(testDb, split.id, week.id, { buffer: voiceBuffer, originalFilename: "llamadas.xlsx" });

    // Falta un participante aplicable: el grupo debe quedar verde con 1 VAC (correccion de cobertura).
    const missingPerson = await createPerson(testDb, { fullName: "Persona Sin Datos", email: undefined });
    await addParticipant(testDb, split.id, {
      personId: missingPerson.id,
      alias: "SinDatos",
      level: "N1",
      startWeekSequenceNumber: 1,
    });
    expect(await getQualityLoadStatus(testDb, split.id, week.id, week.sequenceNumber)).toEqual({ status: "LOADED", vacCount: 1 });
    expect(await getVoiceLoadStatus(testDb, split.id, week.id, week.sequenceNumber)).toEqual({ status: "LOADED", vacCount: 1 });

    const qualityV2 = await buildWorkbookBuffer([QUALITY_HEADERS, ["Marta Ruiz Soler", 9, 1]]);
    await confirmQualityImport(testDb, split.id, week.id, { buffer: qualityV2, originalFilename: "calidad-v2.xlsx" });

    const qualityRows = await testDb.qualityWeeklyRow.findMany({ where: { qualityImport: { splitWeekId: week.id } } });
    expect(qualityRows).toHaveLength(1);
    expect(qualityRows[0]?.goodSatisfactionTickets).toBe(9);

    // Voz y Escalados no deben verse afectados por la sustitucion de Calidad.
    const voiceRows = await testDb.voiceWeeklyRow.findMany({ where: { voiceImport: { splitWeekId: week.id } } });
    expect(voiceRows).toHaveLength(1);
    const escalationImports = await testDb.escalationImport.findMany({ where: { splitWeekId: week.id } });
    expect(escalationImports).toHaveLength(0);

    // Un nombre ambiguo bloquea la sustitucion y conserva intacta la carga anterior.
    const twinPerson = await createPerson(testDb, { fullName: "Marta Ruiz Soler", email: "marta2@example.com" });
    await addParticipant(testDb, split.id, {
      personId: twinPerson.id,
      alias: "MartaDos",
      level: "N0",
      startWeekSequenceNumber: 1,
    });
    const qualityV3 = await buildWorkbookBuffer([QUALITY_HEADERS, ["Marta Ruiz Soler", 1, 1]]);
    await expect(
      confirmQualityImport(testDb, split.id, week.id, { buffer: qualityV3, originalFilename: "calidad-v3.xlsx" }),
    ).rejects.toBeInstanceOf(DomainError);

    const qualityRowsAfterFailure = await testDb.qualityWeeklyRow.findMany({ where: { qualityImport: { splitWeekId: week.id } } });
    expect(qualityRowsAfterFailure).toHaveLength(1);
    expect(qualityRowsAfterFailure[0]?.goodSatisfactionTickets).toBe(9);
  });
});

describe("Restricciones de split y semana", () => {
  it.each([
    {
      name: "Escalados",
      preview: previewEscalationImport,
      confirm: confirmEscalationImport,
      headers: ESCALATION_HEADERS,
      row: ["Persona Prueba", 1],
    },
    {
      name: "Calidad",
      preview: previewQualityImport,
      confirm: confirmQualityImport,
      headers: QUALITY_HEADERS,
      row: ["Persona Prueba", 1, 0],
    },
    {
      name: "Llamadas",
      preview: previewVoiceImport,
      confirm: confirmVoiceImport,
      headers: VOICE_HEADERS,
      row: ["Persona Prueba", 1, 0, 0, 1, 1, 1, 1, 1, 1],
    },
  ])("$name rechaza en DRAFT, en CLOSED y con una semana de otro split; ACTIVE lo admite", async ({ confirm, headers, row }) => {
    const draftSplit = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Prueba", email: undefined });
    await addParticipant(testDb, draftSplit.id, {
      personId: person.id,
      alias: "Prueba",
      level: "N1",
      startWeekSequenceNumber: 1,
    });
    const draftWeek = (await listSplitWeeks(testDb, draftSplit.id))[0]!;
    const buffer = await buildWorkbookBuffer([headers, row]);

    await expect(confirm(testDb, draftSplit.id, draftWeek.id, { buffer, originalFilename: "x.xlsx" })).rejects.toBeInstanceOf(
      DomainError,
    );

    const otherSplit = await createDraftSplit();
    const otherWeek = (await listSplitWeeks(testDb, otherSplit.id))[0]!;
    await expect(confirm(testDb, draftSplit.id, otherWeek.id, { buffer, originalFilename: "x.xlsx" })).rejects.toBeInstanceOf(
      DomainError,
    );

    await activateWithAllThree(draftSplit.id);
    await confirm(testDb, draftSplit.id, draftWeek.id, { buffer, originalFilename: "x.xlsx" });

    await testDb.split.update({ where: { id: draftSplit.id }, data: { status: "CLOSED" } });
    await expect(confirm(testDb, draftSplit.id, draftWeek.id, { buffer, originalFilename: "x.xlsx" })).rejects.toBeInstanceOf(
      DomainError,
    );
  });
});
