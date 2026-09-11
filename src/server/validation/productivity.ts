import { DomainError } from "@/lib/errors";

export interface UploadedXlsxFile {
  buffer: Buffer;
  originalFilename: string;
}

/**
 * Extrae y valida el archivo `.xlsx` subido en el formulario de carga de
 * Productividad: presencia, extension y que no este vacio. El contenido
 * del archivo se valida aparte, en el lector (ver
 * src/server/services/productivity/excel-reader.ts).
 */
export async function extractUploadedXlsxFile(formData: FormData): Promise<UploadedXlsxFile> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new DomainError("Selecciona un archivo .xlsx.", "file");
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new DomainError("El archivo debe tener extension .xlsx.", "file");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return { buffer, originalFilename: file.name };
}
