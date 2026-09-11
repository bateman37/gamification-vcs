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

export async function buildWorkbookBuffer(rows: XlsxCellInput[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Datos");
  for (const row of rows) sheet.addRow(row);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
