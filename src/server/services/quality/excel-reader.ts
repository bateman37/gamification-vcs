import {
  cellToPlainText,
  findDuplicateNormalizedNameErrors,
  loadXlsxWithRequiredColumns,
  parseNonNegativeIntegerCell,
  requireColumnIndex,
  type XlsxRowError,
} from "@/server/services/shared/xlsx";

/**
 * Lector y validador del Excel semanal de Calidad (ver
 * docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md). Alimenta el KPI Maestro
 * Artesano. Procesa el archivo unicamente en memoria.
 */

type QualityColumnKey = "sourceAgentName" | "goodSatisfactionTickets" | "badSatisfactionTickets";

const QUALITY_REQUIRED_COLUMNS: { key: QualityColumnKey; label: string }[] = [
  { key: "sourceAgentName", label: "Nombre del agente asignado" },
  { key: "goodSatisfactionTickets", label: "Tickets con satisfacción buena" },
  { key: "badSatisfactionTickets", label: "Tickets con satisfacción mala" },
];

export interface QualitySourceRow {
  rowNumber: number;
  sourceAgentName: string;
  goodSatisfactionTickets: number;
  badSatisfactionTickets: number;
}

export interface QualityReadOutcome {
  rows: QualitySourceRow[];
  errors: XlsxRowError[];
  sourceRowCount: number;
}

export async function readQualityWorkbook(buffer: Buffer): Promise<QualityReadOutcome> {
  const loadResult = await loadXlsxWithRequiredColumns<QualityColumnKey>(buffer, QUALITY_REQUIRED_COLUMNS);
  if (!loadResult.ok) {
    return { rows: [], sourceRowCount: loadResult.sourceRowCount, errors: loadResult.errors };
  }

  const { worksheet, columnIndexByKey, lastDataRowNumber, sourceRowCount } = loadResult.resolved;
  const nameColumnIndex = requireColumnIndex(columnIndexByKey, "sourceAgentName");
  const goodColumnIndex = requireColumnIndex(columnIndexByKey, "goodSatisfactionTickets");
  const badColumnIndex = requireColumnIndex(columnIndexByKey, "badSatisfactionTickets");

  const rows: QualitySourceRow[] = [];
  const errors: XlsxRowError[] = [];

  for (let rowNumber = 2; rowNumber <= lastDataRowNumber; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const rowErrors: XlsxRowError[] = [];

    const sourceAgentName = cellToPlainText(row.getCell(nameColumnIndex).value);
    if (sourceAgentName === null) {
      rowErrors.push({ rowNumber, column: "Nombre del agente asignado", message: "El nombre del agente asignado es obligatorio." });
    }

    const parseCount = (columnIndex: number, label: string) => {
      const parsed = parseNonNegativeIntegerCell(row.getCell(columnIndex).value);
      if (!parsed.ok) {
        rowErrors.push({
          rowNumber,
          column: label,
          message: parsed.reason === "missing" ? `Falta el valor de "${label}".` : `"${label}" debe ser un numero entero mayor o igual que cero.`,
        });
      }
      return parsed;
    };

    const good = parseCount(goodColumnIndex, "Tickets con satisfacción buena");
    const bad = parseCount(badColumnIndex, "Tickets con satisfacción mala");

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    if (sourceAgentName !== null && good.ok && bad.ok) {
      rows.push({ rowNumber, sourceAgentName, goodSatisfactionTickets: good.value, badSatisfactionTickets: bad.value });
    }
  }

  errors.push(...findDuplicateNormalizedNameErrors(rows, "Nombre del agente asignado"));

  return { rows, errors, sourceRowCount };
}
