import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { buildWorkbookBuffer, PRODUCTIVITY_HEADERS } from "./helpers/xlsx";
import { createPerson } from "@/server/services/person.service";
import { activateSplit, createSplitWithWeeks, listSplitWeeks } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import {
  confirmProductivityImport,
  getProductivityLoadStatus,
} from "@/server/services/productivity-import.service";
import { DomainError } from "@/lib/errors";

async function createDraftSplit(numberOfWeeks = 2) {
  return createSplitWithWeeks(testDb, {
    name: "Split de productividad",
    description: undefined,
    startDate: "2025-10-06",
    numberOfWeeks,
  });
}

async function activateWithSolutionHunter(splitId: string) {
  await updateKpiConfig(testDb, splitId, "SOLUTION_HUNTER", {
    isActive: true,
    baseMax: 70,
    multiplierN0: 2.5,
    multiplierN1: 1,
    multiplierN2: 1.85,
    parameters: { pointsPerResolvedTicket: 1 },
  });
  return activateSplit(testDb, splitId);
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Confirmar una carga de productividad", () => {
  it("persiste una sola cabecera y solo las filas encontradas; el estado pasa de Pendiente a Cargado con n VAC si faltan participantes", async () => {
    const split = await createDraftSplit();
    const personFound = await createPerson(testDb, { fullName: "Marta Ruiz Soler", email: undefined });
    const personMissing = await createPerson(testDb, { fullName: "Pedro Gomez Diaz", email: undefined });
    const participantFound = await addParticipant(testDb, split.id, {
      personId: personFound.id,
      alias: "Marta",
      level: "N1",
      startWeekSequenceNumber: 1,
    });
    await addParticipant(testDb, split.id, {
      personId: personMissing.id,
      alias: "Pedro",
      level: "N2",
      startWeekSequenceNumber: 1,
    });
    await activateWithSolutionHunter(split.id);
    const weeks = await listSplitWeeks(testDb, split.id);
    const week = weeks[0]!;

    expect(await getProductivityLoadStatus(testDb, split.id, week.id, week.sequenceNumber)).toEqual({
      status: "PENDING",
      vacCount: 0,
    });

    const buffer = await buildWorkbookBuffer([
      PRODUCTIVITY_HEADERS,
      ["Marta Ruiz Soler", 1, 1, 1, 1, 1, 23, 1],
      ["Persona ajena al split", 1, 1, 1, 1, 1, 1, 1],
    ]);

    await confirmProductivityImport(testDb, split.id, week.id, { buffer, originalFilename: "productividad.xlsx" });

    const imports = await testDb.productivityImport.findMany({
      where: { splitWeekId: week.id },
      include: { rows: true },
    });
    expect(imports).toHaveLength(1);
    expect(imports[0]!.rows).toHaveLength(1);
    expect(imports[0]!.rows[0]!.splitParticipantId).toBe(participantFound.id);
    expect(imports[0]!.sourceRowCount).toBe(2);
    expect(imports[0]!.importedRowCount).toBe(1);

    // Corregido en MVP-1C.2 / IMPORT-1B: una carga confirmada es verde
    // (LOADED) aunque falten participantes; la ausencia se expresa con
    // "n VAC", nunca con el amarillo (PARTIAL, ver docs/DECISIONS.md).
    expect(await getProductivityLoadStatus(testDb, split.id, week.id, week.sequenceNumber)).toEqual({
      status: "LOADED",
      vacCount: 1,
    });
  });
});

describe("Sustituir una carga de productividad", () => {
  it("no duplica filas al sustituir, y una confirmacion que falla conserva intacta la carga anterior", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Marta Ruiz Soler", email: undefined });
    await addParticipant(testDb, split.id, {
      personId: person.id,
      alias: "Marta",
      level: "N1",
      startWeekSequenceNumber: 1,
    });
    await activateWithSolutionHunter(split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    const firstBuffer = await buildWorkbookBuffer([
      PRODUCTIVITY_HEADERS,
      ["Marta Ruiz Soler", 1, 1, 1, 1, 1, 10, 1],
    ]);
    await confirmProductivityImport(testDb, split.id, week.id, { buffer: firstBuffer, originalFilename: "v1.xlsx" });
    const firstImport = await testDb.productivityImport.findUniqueOrThrow({ where: { splitWeekId: week.id } });

    const replacementBuffer = await buildWorkbookBuffer([
      PRODUCTIVITY_HEADERS,
      ["Marta Ruiz Soler", 2, 2, 2, 2, 2, 20, 2],
    ]);
    await confirmProductivityImport(testDb, split.id, week.id, {
      buffer: replacementBuffer,
      originalFilename: "v2.xlsx",
    });

    const imports = await testDb.productivityImport.findMany({
      where: { splitWeekId: week.id },
      include: { rows: true },
    });
    expect(imports).toHaveLength(1);
    expect(imports[0]!.id).not.toBe(firstImport.id);
    expect(imports[0]!.rows).toHaveLength(1);
    expect(imports[0]!.rows[0]!.ticketsResolved).toBe(20);

    // Un segundo participante con el mismo nombre real crea una ambiguedad
    // que debe bloquear la confirmacion sin tocar la carga vigente.
    const twinPerson = await createPerson(testDb, { fullName: "Marta Ruiz Soler", email: "marta2@example.com" });
    await addParticipant(testDb, split.id, {
      personId: twinPerson.id,
      alias: "MartaDos",
      level: "N0",
      startWeekSequenceNumber: 1,
    });

    const ambiguousBuffer = await buildWorkbookBuffer([
      PRODUCTIVITY_HEADERS,
      ["Marta Ruiz Soler", 3, 3, 3, 3, 3, 30, 3],
    ]);
    await expect(
      confirmProductivityImport(testDb, split.id, week.id, {
        buffer: ambiguousBuffer,
        originalFilename: "v3.xlsx",
      }),
    ).rejects.toBeInstanceOf(DomainError);

    const importsAfterFailure = await testDb.productivityImport.findMany({
      where: { splitWeekId: week.id },
      include: { rows: true },
    });
    expect(importsAfterFailure).toHaveLength(1);
    expect(importsAfterFailure[0]!.rows[0]!.ticketsResolved).toBe(20);
  });
});

describe("Estado del split al confirmar una carga", () => {
  it("rechaza confirmar en DRAFT, en CLOSED y con una semana de otro split; ACTIVE si se admite", async () => {
    const draftSplit = await createDraftSplit();
    const draftPerson = await createPerson(testDb, { fullName: "Persona Borrador", email: undefined });
    await addParticipant(testDb, draftSplit.id, {
      personId: draftPerson.id,
      alias: "Borrador",
      level: "N1",
      startWeekSequenceNumber: 1,
    });
    const draftWeek = (await listSplitWeeks(testDb, draftSplit.id))[0]!;
    const buffer = await buildWorkbookBuffer([
      PRODUCTIVITY_HEADERS,
      ["Persona Borrador", 1, 1, 1, 1, 1, 5, 1],
    ]);

    await expect(
      confirmProductivityImport(testDb, draftSplit.id, draftWeek.id, { buffer, originalFilename: "x.xlsx" }),
    ).rejects.toBeInstanceOf(DomainError);

    const otherSplit = await createDraftSplit();
    const otherWeek = (await listSplitWeeks(testDb, otherSplit.id))[0]!;
    await expect(
      confirmProductivityImport(testDb, draftSplit.id, otherWeek.id, { buffer, originalFilename: "x.xlsx" }),
    ).rejects.toBeInstanceOf(DomainError);

    await activateWithSolutionHunter(draftSplit.id);
    await confirmProductivityImport(testDb, draftSplit.id, draftWeek.id, { buffer, originalFilename: "x.xlsx" });
    const persisted = await testDb.productivityImport.findUnique({ where: { splitWeekId: draftWeek.id } });
    expect(persisted).not.toBeNull();

    await testDb.split.update({ where: { id: draftSplit.id }, data: { status: "CLOSED" } });
    await expect(
      confirmProductivityImport(testDb, draftSplit.id, draftWeek.id, { buffer, originalFilename: "x.xlsx" }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
