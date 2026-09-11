import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { normalizeForMatching } from "@/lib/normalize";

/**
 * Utilidades compartidas de lectura segura de Excel `.xlsx` en memoria,
 * usadas por los lectores de Escalados, Calidad y Llamadas (ver
 * docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md). Resuelven el recorrido comun
 * a los tres origenes -- limite de tamano, primera hoja, encabezados en la
 * fila 1 en cualquier orden, filas vacias finales -- confirmado identico
 * en la auditoria de los tres Excel. No imponen ninguna regla de
 * validacion propia de un origen concreto: cada lector sigue construyendo
 * sus propias filas y mensajes de error a partir de esto. El lector de
 * Productividad (`src/server/services/productivity/excel-reader.ts`), ya
 * validado manualmente, no se ha tocado para no arriesgar una
 * refactorizacion de codigo que ya funciona.
 */

export const XLSX_MAX_FILE_SIZE_BYTES = 1024 * 1024;
export const XLSX_MAX_DATA_ROWS = 500;
export const XLSX_MAX_COLUMNS = 50;

export interface XlsxRowError {
  /** 0 cuando el error no pertenece a una fila concreta (archivo, cabecera). */
  rowNumber: number;
  column: string;
  message: string;
}

export interface XlsxRequiredColumn<TKey extends string> {
  key: TKey;
  label: string;
}

export interface ResolvedXlsxWorkbook<TKey extends string> {
  worksheet: ExcelJS.Worksheet;
  columnIndexByKey: Map<TKey, number>;
  lastDataRowNumber: number;
  sourceRowCount: number;
}

export type XlsxLoadOutcome<TKey extends string> =
  | { ok: true; resolved: ResolvedXlsxWorkbook<TKey> }
  | { ok: false; errors: XlsxRowError[]; sourceRowCount: number };

export function cellToPlainText(raw: ExcelJS.CellValue): string | null {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (raw !== null && typeof raw === "object" && "richText" in raw) {
    const text = raw.richText
      .map((fragment) => fragment.text)
      .join("")
      .trim();
    return text === "" ? null : text;
  }
  return null;
}

export function isRequiredCellEmpty(raw: ExcelJS.CellValue): boolean {
  if (raw === null || raw === undefined) return true;
  if (typeof raw === "string") return raw.trim() === "";
  return false;
}

export type NonNegativeIntegerParseResult = { ok: true; value: number } | { ok: false; reason: "missing" | "invalid" };

/**
 * Acepta una celda numerica de Excel o un texto compuesto solo por digitos
 * (tras recortar espacios). Rechaza negativos, decimales, formulas,
 * booleanos, fechas y texto arbitrario. Nunca convierte un vacio en cero.
 */
export function parseNonNegativeIntegerCell(raw: ExcelJS.CellValue): NonNegativeIntegerParseResult {
  if (raw === null || raw === undefined) return { ok: false, reason: "missing" };
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || !Number.isInteger(raw) || raw < 0) return { ok: false, reason: "invalid" };
    return { ok: true, value: raw };
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return { ok: false, reason: "missing" };
    if (!/^\d+$/.test(trimmed)) return { ok: false, reason: "invalid" };
    return { ok: true, value: Number(trimmed) };
  }
  return { ok: false, reason: "invalid" };
}

export type NonNegativeDecimalParseResult = { ok: true; value: Prisma.Decimal } | { ok: false; reason: "missing" | "invalid" };

/**
 * Decimal no negativo para las metricas de tiempo de Llamadas: celda
 * numerica finita >= 0, o texto con un unico separador `.` o `,` (nunca
 * ambos) y sin separadores de miles. Devuelve `Prisma.Decimal` construido
 * directamente desde el texto de origen (nunca desde `Number`), para no
 * depender del redondeo binario de JavaScript. Rechaza formulas,
 * negativos, infinitos, fechas, booleanos y vacios.
 */
export function parseNonNegativeDecimalCell(raw: ExcelJS.CellValue): NonNegativeDecimalParseResult {
  if (raw === null || raw === undefined) return { ok: false, reason: "missing" };
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) return { ok: false, reason: "invalid" };
    return { ok: true, value: new Prisma.Decimal(raw) };
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return { ok: false, reason: "missing" };
    if (!/^\d+([.,]\d+)?$/.test(trimmed)) return { ok: false, reason: "invalid" };
    try {
      const value = new Prisma.Decimal(trimmed.replace(",", "."));
      if (value.isNegative()) return { ok: false, reason: "invalid" };
      return { ok: true, value };
    } catch {
      return { ok: false, reason: "invalid" };
    }
  }
  return { ok: false, reason: "invalid" };
}

function isDataRowEmpty<TKey extends string>(row: ExcelJS.Row, columnIndexByKey: Map<TKey, number>): boolean {
  for (const index of columnIndexByKey.values()) {
    if (!isRequiredCellEmpty(row.getCell(index).value)) return false;
  }
  return true;
}

/**
 * Carga el libro, comprueba tamano y primera hoja, resuelve los
 * encabezados obligatorios (normalizados, orden libre, columnas extra
 * permitidas) y recorta las filas vacias finales. No interpreta ninguna
 * columna de datos: eso es responsabilidad de cada lector concreto.
 */
export async function loadXlsxWithRequiredColumns<TKey extends string>(
  buffer: Buffer,
  requiredColumns: XlsxRequiredColumn<TKey>[],
): Promise<XlsxLoadOutcome<TKey>> {
  if (buffer.byteLength > XLSX_MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      sourceRowCount: 0,
      errors: [
        {
          rowNumber: 0,
          column: "Archivo",
          message: `El archivo supera el limite de ${Math.floor(XLSX_MAX_FILE_SIZE_BYTES / 1024)} KB.`,
        },
      ],
    };
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    return {
      ok: false,
      sourceRowCount: 0,
      errors: [{ rowNumber: 0, column: "Archivo", message: "El archivo no es un .xlsx valido o esta danado." }],
    };
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return { ok: false, sourceRowCount: 0, errors: [{ rowNumber: 0, column: "Archivo", message: "El libro no contiene ninguna hoja." }] };
  }

  const headerRow = worksheet.getRow(1);
  const headerColumnCount = Math.min(headerRow.cellCount, XLSX_MAX_COLUMNS);
  const columnIndexByNormalizedHeader = new Map<string, number>();
  for (let col = 1; col <= headerColumnCount; col += 1) {
    const text = cellToPlainText(headerRow.getCell(col).value);
    if (!text) continue;
    const normalized = normalizeForMatching(text);
    if (!columnIndexByNormalizedHeader.has(normalized)) {
      columnIndexByNormalizedHeader.set(normalized, col);
    }
  }

  const columnIndexByKey = new Map<TKey, number>();
  const missingHeaderErrors: XlsxRowError[] = [];
  for (const column of requiredColumns) {
    const index = columnIndexByNormalizedHeader.get(normalizeForMatching(column.label));
    if (index === undefined) {
      missingHeaderErrors.push({ rowNumber: 1, column: column.label, message: `Falta la columna obligatoria "${column.label}".` });
      continue;
    }
    columnIndexByKey.set(column.key, index);
  }
  if (missingHeaderErrors.length > 0) {
    return { ok: false, sourceRowCount: 0, errors: missingHeaderErrors };
  }

  let lastDataRowNumber = worksheet.lastRow?.number ?? 1;
  while (lastDataRowNumber > 1 && isDataRowEmpty(worksheet.getRow(lastDataRowNumber), columnIndexByKey)) {
    lastDataRowNumber -= 1;
  }
  const sourceRowCount = Math.max(0, lastDataRowNumber - 1);

  if (sourceRowCount > XLSX_MAX_DATA_ROWS) {
    return {
      ok: false,
      sourceRowCount,
      errors: [
        {
          rowNumber: 0,
          column: "Archivo",
          message: `El archivo supera el maximo de ${XLSX_MAX_DATA_ROWS} filas de datos.`,
        },
      ],
    };
  }

  return { ok: true, resolved: { worksheet, columnIndexByKey, lastDataRowNumber, sourceRowCount } };
}

export function requireColumnIndex<TKey extends string>(map: Map<TKey, number>, key: TKey): number {
  const index = map.get(key);
  if (index === undefined) {
    throw new Error(`Columna interna no resuelta: ${key}.`);
  }
  return index;
}

export function formatXlsxRowError(error: XlsxRowError): string {
  return error.rowNumber > 0 ? `Fila ${error.rowNumber} - ${error.column}: ${error.message}` : error.message;
}

/** Bloquea la carga si dos filas coinciden en el nombre normalizado: no se suman silenciosamente. */
export function findDuplicateNormalizedNameErrors<TRow extends { rowNumber: number; sourceAgentName: string }>(
  rows: TRow[],
  nameColumnLabel: string,
): XlsxRowError[] {
  const rowsByNormalizedName = new Map<string, TRow[]>();
  for (const row of rows) {
    const normalized = normalizeForMatching(row.sourceAgentName);
    const group = rowsByNormalizedName.get(normalized) ?? [];
    group.push(row);
    rowsByNormalizedName.set(normalized, group);
  }

  const errors: XlsxRowError[] = [];
  for (const group of rowsByNormalizedName.values()) {
    if (group.length < 2) continue;
    const rowNumbers = group.map((row) => row.rowNumber).join(", ");
    for (const row of group) {
      errors.push({
        rowNumber: row.rowNumber,
        column: nameColumnLabel,
        message: `El nombre "${row.sourceAgentName}" coincide con otra fila tras normalizarlo (filas ${rowNumbers}).`,
      });
    }
  }
  return errors;
}
