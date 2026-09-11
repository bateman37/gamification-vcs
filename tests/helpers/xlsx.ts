import ExcelJS from "exceljs";

export type XlsxCellInput = string | number | { formula: string; result?: number };

export const PRODUCTIVITY_HEADERS: XlsxCellInput[] = [
  "Nombre del actualizador",
  "Actualizaciones",
  "Comentarios",
  "Comentarios públicos",
  "Comentarios internos",
  "Tickets actualizados con comentario",
  "Tickets resueltos",
  "Tickets creados",
];

export const ESCALATION_HEADERS: XlsxCellInput[] = ["Nombre del actualizador", "Reasignaciones de grupo"];

export const QUALITY_HEADERS: XlsxCellInput[] = [
  "Nombre del agente asignado",
  "Tickets con satisfacción buena",
  "Tickets con satisfacción mala",
];

export const VOICE_HEADERS: XlsxCellInput[] = [
  "Agente del segmento - Nombre",
  "Segmentos de llamada aceptados",
  "Segmentos de llamada rechazados",
  "Segmentos de llamada no atendidos",
  "Llamadas salientes",
  "Duración de segmento (h)",
  "Tiempo de conversación de segmento (h)",
  "Tiempo de conclusión de segmento (h)",
  "Segmento - Tiempo de conversación (min)",
  "Segmento - Tiempo de conclusión (min)",
];

export async function buildWorkbookBuffer(rows: XlsxCellInput[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Datos");
  for (const row of rows) sheet.addRow(row);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
