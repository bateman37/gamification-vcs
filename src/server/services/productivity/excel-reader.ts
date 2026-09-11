import ExcelJS from "exceljs";
import { normalizeForMatching } from "@/lib/normalize";

/**
 * Lector y validador del Excel semanal de Productividad (ver
 * docs/IMPORT_PRODUCTIVITY.md). Procesa el archivo unicamente en memoria:
 * nunca lo escribe en disco. Reune todos los errores detectables en una
 * sola pasada en vez de detenerse en el primero, para que la
 * previsualizacion pueda mostrarlos juntos.
 */

export const PRODUCTIVITY_MAX_FILE_SIZE_BYTES = 1024 * 1024;
export const PRODUCTIVITY_MAX_DATA_ROWS = 500;
export const PRODUCTIVITY_MAX_COLUMNS = 50;

type ProductivityColumnKey =
  | "sourceAgentName"
  | "updates"
  | "comments"
  | "publicComments"
  | "internalComments"
  | "ticketsUpdatedWithComment"
  | "ticketsResolved"
  | "ticketsCreated";

interface ProductivityColumnDef {
  key: ProductivityColumnKey;
  label: string;
}

/** Los ocho encabezados obligatorios del Excel real (ver auditoria en docs/DISCOVERY-1-SPLIT-8.md). */
const PRODUCTIVITY_REQUIRED_COLUMNS: ProductivityColumnDef[] = [
  { key: "sourceAgentName", label: "Nombre del actualizador" },
  { key: "updates", label: "Actualizaciones" },
  { key: "comments", label: "Comentarios" },
  { key: "publicComments", label: "Comentarios públicos" },
  { key: "internalComments", label: "Comentarios internos" },
  { key: "ticketsUpdatedWithComment", label: "Tickets actualizados con comentario" },
  { key: "ticketsResolved", label: "Tickets resueltos" },
  { key: "ticketsCreated", label: "Tickets creados" },
];

export interface ProductivitySourceRow {
  /** Numero de fila tal como aparece en el Excel (1-based, incluye la cabecera). */
  rowNumber: number;
  sourceAgentName: string;
  updates: number;
  comments: number;
  publicComments: number;
  internalComments: number;
  ticketsUpdatedWithComment: number;
  ticketsResolved: number;
  ticketsCreated: number;
}

export interface ProductivityRowError {
  /** 0 cuando el error no pertenece a una fila concreta (archivo, cabecera). */
  rowNumber: number;
  column: string;
  message: string;
}

export interface ProductivityReadOutcome {
  /** Filas leidas y validadas correctamente (sin errores). */
  rows: ProductivitySourceRow[];
  /** Todos los errores detectados, de archivo, de cabecera o de fila. */
  errors: ProductivityRowError[];
  /** Total de filas de datos consideradas (tras ignorar las vacias finales). */
  sourceRowCount: number;
}

function cellToPlainText(raw: ExcelJS.CellValue): string | null {
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

type NonNegativeIntegerParseResult =
  | { ok: true; value: number }
  | { ok: false; reason: "missing" | "invalid" };

/**
 * Acepta una celda numerica de Excel o un texto compuesto solo por digitos
 * (tras recortar espacios). Rechaza negativos, decimales, formulas,
 * booleanos, fechas y texto arbitrario. Nunca convierte un vacio en cero.
 */
function parseNonNegativeIntegerCell(raw: ExcelJS.CellValue): NonNegativeIntegerParseResult {
  if (raw === null || raw === undefined) {
    return { ok: false, reason: "missing" };
  }
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || !Number.isInteger(raw) || raw < 0) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, value: raw };
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return { ok: false, reason: "missing" };
    if (!/^\d+$/.test(trimmed)) return { ok: false, reason: "invalid" };
    return { ok: true, value: Number(trimmed) };
  }
  // Booleanos, fechas, formulas, texto enriquecido, hipervinculos, errores...
  return { ok: false, reason: "invalid" };
}

function isRequiredCellEmpty(raw: ExcelJS.CellValue): boolean {
  if (raw === null || raw === undefined) return true;
  if (typeof raw === "string") return raw.trim() === "";
  return false;
}

function requireColumnIndex(map: Map<ProductivityColumnKey, number>, key: ProductivityColumnKey): number {
  const index = map.get(key);
  if (index === undefined) {
    throw new Error(`Columna interna no resuelta: ${key}.`);
  }
  return index;
}

function isDataRowEmpty(row: ExcelJS.Row, columnIndexByKey: Map<ProductivityColumnKey, number>): boolean {
  for (const index of columnIndexByKey.values()) {
    if (!isRequiredCellEmpty(row.getCell(index).value)) return false;
  }
  return true;
}

function findDuplicateNormalizedNameErrors(rows: ProductivitySourceRow[]): ProductivityRowError[] {
  const rowsByNormalizedName = new Map<string, ProductivitySourceRow[]>();
  for (const row of rows) {
    const normalized = normalizeForMatching(row.sourceAgentName);
    const group = rowsByNormalizedName.get(normalized) ?? [];
    group.push(row);
    rowsByNormalizedName.set(normalized, group);
  }

  const errors: ProductivityRowError[] = [];
  for (const group of rowsByNormalizedName.values()) {
    if (group.length < 2) continue;
    const rowNumbers = group.map((row) => row.rowNumber).join(", ");
    for (const row of group) {
      errors.push({
        rowNumber: row.rowNumber,
        column: "Nombre del actualizador",
        message: `El nombre "${row.sourceAgentName}" coincide con otra fila tras normalizarlo (filas ${rowNumbers}).`,
      });
    }
  }
  return errors;
}

/**
 * Lee y valida en memoria un Excel `.xlsx` de Productividad. No lanza
 * excepciones por archivos invalidos: los errores se devuelven en
 * `errors` para que la previsualizacion los muestre en castellano.
 */
export async function readProductivityWorkbook(buffer: Buffer): Promise<ProductivityReadOutcome> {
  if (buffer.byteLength > PRODUCTIVITY_MAX_FILE_SIZE_BYTES) {
    return {
      rows: [],
      sourceRowCount: 0,
      errors: [
        {
          rowNumber: 0,
          column: "Archivo",
          message: `El archivo supera el limite de ${Math.floor(PRODUCTIVITY_MAX_FILE_SIZE_BYTES / 1024)} KB.`,
        },
      ],
    };
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    return {
      rows: [],
      sourceRowCount: 0,
      errors: [{ rowNumber: 0, column: "Archivo", message: "El archivo no es un .xlsx valido o esta danado." }],
    };
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return {
      rows: [],
      sourceRowCount: 0,
      errors: [{ rowNumber: 0, column: "Archivo", message: "El libro no contiene ninguna hoja." }],
    };
  }

  const headerRow = worksheet.getRow(1);
  const headerColumnCount = Math.min(headerRow.cellCount, PRODUCTIVITY_MAX_COLUMNS);
  const columnIndexByNormalizedHeader = new Map<string, number>();
  for (let col = 1; col <= headerColumnCount; col += 1) {
    const text = cellToPlainText(headerRow.getCell(col).value);
    if (!text) continue;
    const normalized = normalizeForMatching(text);
    if (!columnIndexByNormalizedHeader.has(normalized)) {
      columnIndexByNormalizedHeader.set(normalized, col);
    }
  }

  const columnIndexByKey = new Map<ProductivityColumnKey, number>();
  const missingHeaderErrors: ProductivityRowError[] = [];
  for (const column of PRODUCTIVITY_REQUIRED_COLUMNS) {
    const index = columnIndexByNormalizedHeader.get(normalizeForMatching(column.label));
    if (index === undefined) {
      missingHeaderErrors.push({
        rowNumber: 1,
        column: column.label,
        message: `Falta la columna obligatoria "${column.label}".`,
      });
      continue;
    }
    columnIndexByKey.set(column.key, index);
  }
  if (missingHeaderErrors.length > 0) {
    return { rows: [], sourceRowCount: 0, errors: missingHeaderErrors };
  }

  let lastDataRowNumber = worksheet.lastRow?.number ?? 1;
  while (lastDataRowNumber > 1 && isDataRowEmpty(worksheet.getRow(lastDataRowNumber), columnIndexByKey)) {
    lastDataRowNumber -= 1;
  }
  const sourceRowCount = Math.max(0, lastDataRowNumber - 1);

  if (sourceRowCount > PRODUCTIVITY_MAX_DATA_ROWS) {
    return {
      rows: [],
      sourceRowCount,
      errors: [
        {
          rowNumber: 0,
          column: "Archivo",
          message: `El archivo supera el maximo de ${PRODUCTIVITY_MAX_DATA_ROWS} filas de datos.`,
        },
      ],
    };
  }

  const nameColumnIndex = requireColumnIndex(columnIndexByKey, "sourceAgentName");
  const updatesColumnIndex = requireColumnIndex(columnIndexByKey, "updates");
  const commentsColumnIndex = requireColumnIndex(columnIndexByKey, "comments");
  const publicCommentsColumnIndex = requireColumnIndex(columnIndexByKey, "publicComments");
  const internalCommentsColumnIndex = requireColumnIndex(columnIndexByKey, "internalComments");
  const ticketsUpdatedColumnIndex = requireColumnIndex(columnIndexByKey, "ticketsUpdatedWithComment");
  const ticketsResolvedColumnIndex = requireColumnIndex(columnIndexByKey, "ticketsResolved");
  const ticketsCreatedColumnIndex = requireColumnIndex(columnIndexByKey, "ticketsCreated");

  const rows: ProductivitySourceRow[] = [];
  const errors: ProductivityRowError[] = [];

  for (let rowNumber = 2; rowNumber <= lastDataRowNumber; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const rowErrors: ProductivityRowError[] = [];

    const sourceAgentName = cellToPlainText(row.getCell(nameColumnIndex).value);
    if (sourceAgentName === null) {
      rowErrors.push({
        rowNumber,
        column: "Nombre del actualizador",
        message: "El nombre del actualizador es obligatorio.",
      });
    }

    const parseRequiredCount = (columnIndex: number, label: string): number | undefined => {
      const parsed = parseNonNegativeIntegerCell(row.getCell(columnIndex).value);
      if (parsed.ok) return parsed.value;
      rowErrors.push({
        rowNumber,
        column: label,
        message:
          parsed.reason === "missing"
            ? `Falta el valor de "${label}".`
            : `"${label}" debe ser un numero entero mayor o igual que cero.`,
      });
      return undefined;
    };

    const updates = parseRequiredCount(updatesColumnIndex, "Actualizaciones");
    const comments = parseRequiredCount(commentsColumnIndex, "Comentarios");
    const publicComments = parseRequiredCount(publicCommentsColumnIndex, "Comentarios públicos");
    const internalComments = parseRequiredCount(internalCommentsColumnIndex, "Comentarios internos");
    const ticketsUpdatedWithComment = parseRequiredCount(
      ticketsUpdatedColumnIndex,
      "Tickets actualizados con comentario",
    );
    const ticketsResolved = parseRequiredCount(ticketsResolvedColumnIndex, "Tickets resueltos");
    const ticketsCreated = parseRequiredCount(ticketsCreatedColumnIndex, "Tickets creados");

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    if (
      sourceAgentName !== null &&
      updates !== undefined &&
      comments !== undefined &&
      publicComments !== undefined &&
      internalComments !== undefined &&
      ticketsUpdatedWithComment !== undefined &&
      ticketsResolved !== undefined &&
      ticketsCreated !== undefined
    ) {
      rows.push({
        rowNumber,
        sourceAgentName,
        updates,
        comments,
        publicComments,
        internalComments,
        ticketsUpdatedWithComment,
        ticketsResolved,
        ticketsCreated,
      });
    }
  }

  errors.push(...findDuplicateNormalizedNameErrors(rows));

  return { rows, errors, sourceRowCount };
}
