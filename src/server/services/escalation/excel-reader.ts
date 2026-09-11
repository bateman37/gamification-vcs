import {
  cellToPlainText,
  findDuplicateNormalizedNameErrors,
  loadXlsxWithRequiredColumns,
  parseNonNegativeIntegerCell,
  requireColumnIndex,
  type XlsxRowError,
} from "@/server/services/shared/xlsx";

/**
 * Lector y validador del Excel semanal de Escalados (ver
 * docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md). Alimenta, junto con
 * `ProductivityWeeklyRow.updates` de la misma semana, el KPI Domador de
 * Escaladas. Procesa el archivo unicamente en memoria.
 */

type EscalationColumnKey = "sourceAgentName" | "groupReassignments";

const ESCALATION_REQUIRED_COLUMNS: { key: EscalationColumnKey; label: string }[] = [
  { key: "sourceAgentName", label: "Nombre del actualizador" },
  { key: "groupReassignments", label: "Reasignaciones de grupo" },
];

export interface EscalationSourceRow {
  /** Numero de fila tal como aparece en el Excel (1-based, incluye la cabecera). */
  rowNumber: number;
  sourceAgentName: string;
  groupReassignments: number;
}

export interface EscalationReadOutcome {
  rows: EscalationSourceRow[];
  errors: XlsxRowError[];
  sourceRowCount: number;
}

export async function readEscalationWorkbook(buffer: Buffer): Promise<EscalationReadOutcome> {
  const loadResult = await loadXlsxWithRequiredColumns<EscalationColumnKey>(buffer, ESCALATION_REQUIRED_COLUMNS);
  if (!loadResult.ok) {
    return { rows: [], sourceRowCount: loadResult.sourceRowCount, errors: loadResult.errors };
  }

  const { worksheet, columnIndexByKey, lastDataRowNumber, sourceRowCount } = loadResult.resolved;
  const nameColumnIndex = requireColumnIndex(columnIndexByKey, "sourceAgentName");
  const groupReassignmentsColumnIndex = requireColumnIndex(columnIndexByKey, "groupReassignments");

  const rows: EscalationSourceRow[] = [];
  const errors: XlsxRowError[] = [];

  for (let rowNumber = 2; rowNumber <= lastDataRowNumber; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const rowErrors: XlsxRowError[] = [];

    const sourceAgentName = cellToPlainText(row.getCell(nameColumnIndex).value);
    if (sourceAgentName === null) {
      rowErrors.push({ rowNumber, column: "Nombre del actualizador", message: "El nombre del actualizador es obligatorio." });
    }

    const parsedReassignments = parseNonNegativeIntegerCell(row.getCell(groupReassignmentsColumnIndex).value);
    if (!parsedReassignments.ok) {
      rowErrors.push({
        rowNumber,
        column: "Reasignaciones de grupo",
        message:
          parsedReassignments.reason === "missing"
            ? `Falta el valor de "Reasignaciones de grupo".`
            : `"Reasignaciones de grupo" debe ser un numero entero mayor o igual que cero.`,
      });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    if (sourceAgentName !== null && parsedReassignments.ok) {
      rows.push({ rowNumber, sourceAgentName, groupReassignments: parsedReassignments.value });
    }
  }

  errors.push(...findDuplicateNormalizedNameErrors(rows, "Nombre del actualizador"));

  return { rows, errors, sourceRowCount };
}
