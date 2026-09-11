import { describe, expect, it } from "vitest";
import { readProductivityWorkbook } from "@/server/services/productivity/excel-reader";
import { matchProductivityRows } from "@/server/services/productivity/matching";
import {
  calculateDataExplorerPoints,
  calculateSolutionHunterPoints,
  resolveDataExplorerOutcome,
  resolveSolutionHunterOutcome,
} from "@/domain/kpis/productivity";
import type { KpiConfigView } from "@/domain/kpis/mapping";
import type { Person, SplitParticipant } from "@prisma/client";
import type { ParticipantWithPerson } from "@/server/services/participant.service";
import { buildWorkbookBuffer, PRODUCTIVITY_HEADERS, type XlsxCellInput } from "./helpers/xlsx";

type CellInput = XlsxCellInput;

const REORDERED_HEADERS: CellInput[] = [
  "Tickets resueltos",
  "Nombre del actualizador",
  "Columna extra sin uso",
  "Tickets creados",
  "Actualizaciones",
  "Comentarios",
  "Comentarios públicos",
  "Comentarios internos",
  "Tickets actualizados con comentario",
];

const STANDARD_HEADERS: CellInput[] = PRODUCTIVITY_HEADERS;

function makeParticipant(fullName: string, id: string, alias: string): ParticipantWithPerson {
  const person: Person = {
    id: `${id}-person`,
    fullName,
    email: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const participant: SplitParticipant = {
    id,
    splitId: "split-1",
    personId: person.id,
    alias,
    aliasNormalized: alias.toLowerCase(),
    level: "N1",
    startWeekSequenceNumber: 1,
    endWeekSequenceNumber: null,
    factionId: null,
    professionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { ...participant, person };
}

describe("Lectura del Excel de Productividad", () => {
  it("reconoce un .xlsx con columnas reordenadas y una columna extra", async () => {
    const buffer = await buildWorkbookBuffer([
      REORDERED_HEADERS,
      [23, "Marta Ruiz Soler", "ignorar", 2, 5, 10, 6, 4, 49],
    ]);

    const result = await readProductivityWorkbook(buffer);

    expect(result.errors).toHaveLength(0);
    expect(result.sourceRowCount).toBe(1);
    expect(result.rows).toEqual([
      {
        rowNumber: 2,
        sourceAgentName: "Marta Ruiz Soler",
        updates: 5,
        comments: 10,
        publicComments: 6,
        internalComments: 4,
        ticketsUpdatedWithComment: 49,
        ticketsResolved: 23,
        ticketsCreated: 2,
      },
    ]);
  });

  it.each([
    {
      name: "conserva un conteo en cero como dato real",
      rows: [STANDARD_HEADERS, ["Marta Ruiz Soler", 0, 0, 0, 0, 0, 0, 0]],
      expectValid: true,
    },
    {
      name: "rechaza cuando falta un encabezado obligatorio",
      rows: [STANDARD_HEADERS.filter((header) => header !== "Tickets resueltos"), ["Marta Ruiz Soler", 1, 1, 1, 1, 1, 1]],
      expectValid: false,
    },
    {
      name: "rechaza un valor obligatorio vacio",
      rows: [STANDARD_HEADERS, ["Marta Ruiz Soler", "", 1, 1, 1, 1, 1, 1]],
      expectValid: false,
    },
    {
      name: "rechaza un numero negativo",
      rows: [STANDARD_HEADERS, ["Marta Ruiz Soler", 1, 1, 1, 1, 1, -1, 1]],
      expectValid: false,
    },
    {
      name: "rechaza un numero decimal",
      rows: [STANDARD_HEADERS, ["Marta Ruiz Soler", 1, 1, 1, 1, 1, 2.5, 1]],
      expectValid: false,
    },
    {
      name: "rechaza una formula",
      rows: [STANDARD_HEADERS, ["Marta Ruiz Soler", 1, 1, 1, 1, 1, { formula: "1+1", result: 2 }, 1]],
      expectValid: false,
    },
    {
      name: "rechaza dos nombres iguales tras normalizarlos",
      rows: [
        STANDARD_HEADERS,
        ["  MARTA   ruiz soler ", 1, 1, 1, 1, 1, 1, 1],
        ["Marta Ruiz Soler", 2, 2, 2, 2, 2, 2, 2],
      ],
      expectValid: false,
    },
  ])("$name", async ({ rows, expectValid }) => {
    const buffer = await buildWorkbookBuffer(rows as CellInput[][]);
    const result = await readProductivityWorkbook(buffer);

    if (expectValid) {
      expect(result.errors).toHaveLength(0);
      expect(result.rows[0]?.ticketsResolved).toBe(0);
    } else {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});

describe("Emparejamiento por nombre real", () => {
  it("distingue encontrados, ignorados, sin dato y ambiguedad, usando nombre real y no alias", () => {
    const found = makeParticipant("Marta Ruiz Soler", "p-found", "MartaAlias");
    const missing = makeParticipant("Pedro Gomez Diaz", "p-missing", "PedroAlias");
    const ambiguousA = makeParticipant("Ana Lopez", "p-ambiguous-a", "AnaAlias1");
    const ambiguousB = makeParticipant("Ana Lopez", "p-ambiguous-b", "AnaAlias2");

    const rows = [
      { rowNumber: 2, sourceAgentName: "marta   RUIZ soler", updates: 0, comments: 0, publicComments: 0, internalComments: 0, ticketsUpdatedWithComment: 5, ticketsResolved: 5, ticketsCreated: 0 },
      { rowNumber: 3, sourceAgentName: "AnaAlias1", updates: 0, comments: 0, publicComments: 0, internalComments: 0, ticketsUpdatedWithComment: 1, ticketsResolved: 1, ticketsCreated: 0 },
      { rowNumber: 4, sourceAgentName: "Ana Lopez", updates: 0, comments: 0, publicComments: 0, internalComments: 0, ticketsUpdatedWithComment: 2, ticketsResolved: 2, ticketsCreated: 0 },
    ];

    const result = matchProductivityRows([found, missing, ambiguousA, ambiguousB], rows);

    expect(result.matches[0]).toMatchObject({ status: "found", participant: { id: "p-found" } });
    // "AnaAlias1" es el alias, no el nombre real: no debe emparejar por alias, asi que se ignora.
    expect(result.matches[1]).toMatchObject({ status: "ignored" });
    expect(result.matches[2]?.status).toBe("ambiguous");
    expect(result.hasAmbiguity).toBe(true);
    expect(result.missingParticipants.map((p) => p.id)).toEqual(["p-missing"]);
  });
});

describe("Calculo de los KPI de Productividad", () => {
  function buildConfig(overrides: Partial<KpiConfigView>): KpiConfigView {
    return {
      kpiCode: "SOLUTION_HUNTER",
      isActive: true,
      baseMax: 70,
      multiplierN0: 2.5,
      multiplierN1: 1,
      multiplierN2: 1.85,
      parameters: { pointsPerResolvedTicket: 1 },
      ...overrides,
    };
  }

  it("aplica parametro, multiplicador y maximo, y distingue 'No aplica' y 'Sin dato' de un cero real", () => {
    const solutionHunter = calculateSolutionHunterPoints(23, 1, 1, 70);
    expect(solutionHunter.finalPoints.toNumber()).toBe(23);
    expect(solutionHunter.capped).toBe(false);

    const dataExplorer = calculateDataExplorerPoints(49, 1, 0.5, 70);
    expect(dataExplorer.finalPoints.toNumber()).toBe(24.5);
    expect(dataExplorer.capped).toBe(false);

    const cappedExplorer = calculateDataExplorerPoints(55, 1, 1.5, 70);
    expect(cappedExplorer.rawPoints.toNumber()).toBe(82.5);
    expect(cappedExplorer.finalPoints.toNumber()).toBe(70);
    expect(cappedExplorer.capped).toBe(true);

    const configWithoutN0 = buildConfig({ multiplierN0: null });
    expect(resolveSolutionHunterOutcome(configWithoutN0, "N0", 10)).toEqual({ status: "not_applicable" });
    expect(resolveSolutionHunterOutcome(configWithoutN0, "N1", undefined)).toEqual({ status: "no_data" });

    const dataExplorerConfig = buildConfig({ parameters: { pointsPerCommentedTicket: 1 } });
    const zeroOutcome = resolveDataExplorerOutcome(dataExplorerConfig, "N1", 0);
    expect(zeroOutcome.status).toBe("computed");
    if (zeroOutcome.status === "computed") {
      expect(zeroOutcome.finalPoints.toNumber()).toBe(0);
    }
  });
});
