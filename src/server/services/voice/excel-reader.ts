import { Prisma } from "@prisma/client";
import {
  cellToPlainText,
  findDuplicateNormalizedNameErrors,
  loadXlsxWithRequiredColumns,
  parseNonNegativeDecimalCell,
  parseNonNegativeIntegerCell,
  requireColumnIndex,
  type XlsxRowError,
} from "@/server/services/shared/xlsx";

/**
 * Lector y validador del Excel semanal de Llamadas (ver
 * docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md). Alimenta el KPI Embajador de
 * voz con cuatro conteos; conserva ademas cinco metricas de tiempo para
 * trazabilidad, sin que intervengan en el calculo. Procesa el archivo
 * unicamente en memoria.
 */

type VoiceColumnKey =
  | "sourceAgentName"
  | "acceptedCallSegments"
  | "rejectedCallSegments"
  | "unattendedCallSegments"
  | "outboundCalls"
  | "segmentDurationHours"
  | "segmentTalkTimeHours"
  | "segmentWrapUpTimeHours"
  | "segmentTalkTimeMinutes"
  | "segmentWrapUpTimeMinutes";

const VOICE_REQUIRED_COLUMNS: { key: VoiceColumnKey; label: string }[] = [
  { key: "sourceAgentName", label: "Agente del segmento - Nombre" },
  { key: "acceptedCallSegments", label: "Segmentos de llamada aceptados" },
  { key: "rejectedCallSegments", label: "Segmentos de llamada rechazados" },
  { key: "unattendedCallSegments", label: "Segmentos de llamada no atendidos" },
  { key: "outboundCalls", label: "Llamadas salientes" },
  { key: "segmentDurationHours", label: "Duración de segmento (h)" },
  { key: "segmentTalkTimeHours", label: "Tiempo de conversación de segmento (h)" },
  { key: "segmentWrapUpTimeHours", label: "Tiempo de conclusión de segmento (h)" },
  { key: "segmentTalkTimeMinutes", label: "Segmento - Tiempo de conversación (min)" },
  { key: "segmentWrapUpTimeMinutes", label: "Segmento - Tiempo de conclusión (min)" },
];

export interface VoiceSourceRow {
  rowNumber: number;
  sourceAgentName: string;
  acceptedCallSegments: number;
  rejectedCallSegments: number;
  unattendedCallSegments: number;
  outboundCalls: number;
  segmentDurationHours: Prisma.Decimal;
  segmentTalkTimeHours: Prisma.Decimal;
  segmentWrapUpTimeHours: Prisma.Decimal;
  segmentTalkTimeMinutes: Prisma.Decimal;
  segmentWrapUpTimeMinutes: Prisma.Decimal;
}

export interface VoiceReadOutcome {
  rows: VoiceSourceRow[];
  errors: XlsxRowError[];
  sourceRowCount: number;
}

export async function readVoiceWorkbook(buffer: Buffer): Promise<VoiceReadOutcome> {
  const loadResult = await loadXlsxWithRequiredColumns<VoiceColumnKey>(buffer, VOICE_REQUIRED_COLUMNS);
  if (!loadResult.ok) {
    return { rows: [], sourceRowCount: loadResult.sourceRowCount, errors: loadResult.errors };
  }

  const { worksheet, columnIndexByKey, lastDataRowNumber, sourceRowCount } = loadResult.resolved;
  const nameColumnIndex = requireColumnIndex(columnIndexByKey, "sourceAgentName");
  const intColumns: { key: VoiceColumnKey; label: string }[] = [
    { key: "acceptedCallSegments", label: "Segmentos de llamada aceptados" },
    { key: "rejectedCallSegments", label: "Segmentos de llamada rechazados" },
    { key: "unattendedCallSegments", label: "Segmentos de llamada no atendidos" },
    { key: "outboundCalls", label: "Llamadas salientes" },
  ];
  const decimalColumns: { key: VoiceColumnKey; label: string }[] = [
    { key: "segmentDurationHours", label: "Duración de segmento (h)" },
    { key: "segmentTalkTimeHours", label: "Tiempo de conversación de segmento (h)" },
    { key: "segmentWrapUpTimeHours", label: "Tiempo de conclusión de segmento (h)" },
    { key: "segmentTalkTimeMinutes", label: "Segmento - Tiempo de conversación (min)" },
    { key: "segmentWrapUpTimeMinutes", label: "Segmento - Tiempo de conclusión (min)" },
  ];

  const rows: VoiceSourceRow[] = [];
  const errors: XlsxRowError[] = [];

  for (let rowNumber = 2; rowNumber <= lastDataRowNumber; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const rowErrors: XlsxRowError[] = [];

    const sourceAgentName = cellToPlainText(row.getCell(nameColumnIndex).value);
    if (sourceAgentName === null) {
      rowErrors.push({ rowNumber, column: "Agente del segmento - Nombre", message: "El nombre del agente es obligatorio." });
    }

    const intValues: Partial<Record<VoiceColumnKey, number>> = {};
    for (const column of intColumns) {
      const columnIndex = requireColumnIndex(columnIndexByKey, column.key);
      const parsed = parseNonNegativeIntegerCell(row.getCell(columnIndex).value);
      if (parsed.ok) {
        intValues[column.key] = parsed.value;
      } else {
        rowErrors.push({
          rowNumber,
          column: column.label,
          message: parsed.reason === "missing" ? `Falta el valor de "${column.label}".` : `"${column.label}" debe ser un numero entero mayor o igual que cero.`,
        });
      }
    }

    const decimalValues: Partial<Record<VoiceColumnKey, Prisma.Decimal>> = {};
    for (const column of decimalColumns) {
      const columnIndex = requireColumnIndex(columnIndexByKey, column.key);
      const parsed = parseNonNegativeDecimalCell(row.getCell(columnIndex).value);
      if (parsed.ok) {
        decimalValues[column.key] = parsed.value;
      } else {
        rowErrors.push({
          rowNumber,
          column: column.label,
          message: parsed.reason === "missing" ? `Falta el valor de "${column.label}".` : `"${column.label}" debe ser un numero decimal mayor o igual que cero.`,
        });
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    if (
      sourceAgentName !== null &&
      intValues.acceptedCallSegments !== undefined &&
      intValues.rejectedCallSegments !== undefined &&
      intValues.unattendedCallSegments !== undefined &&
      intValues.outboundCalls !== undefined &&
      decimalValues.segmentDurationHours !== undefined &&
      decimalValues.segmentTalkTimeHours !== undefined &&
      decimalValues.segmentWrapUpTimeHours !== undefined &&
      decimalValues.segmentTalkTimeMinutes !== undefined &&
      decimalValues.segmentWrapUpTimeMinutes !== undefined
    ) {
      rows.push({
        rowNumber,
        sourceAgentName,
        acceptedCallSegments: intValues.acceptedCallSegments,
        rejectedCallSegments: intValues.rejectedCallSegments,
        unattendedCallSegments: intValues.unattendedCallSegments,
        outboundCalls: intValues.outboundCalls,
        segmentDurationHours: decimalValues.segmentDurationHours,
        segmentTalkTimeHours: decimalValues.segmentTalkTimeHours,
        segmentWrapUpTimeHours: decimalValues.segmentWrapUpTimeHours,
        segmentTalkTimeMinutes: decimalValues.segmentTalkTimeMinutes,
        segmentWrapUpTimeMinutes: decimalValues.segmentWrapUpTimeMinutes,
      });
    }
  }

  errors.push(...findDuplicateNormalizedNameErrors(rows, "Agente del segmento - Nombre"));

  return { rows, errors, sourceRowCount };
}
