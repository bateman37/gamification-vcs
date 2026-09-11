import { createHash } from "node:crypto";
import sharp from "sharp";
import { DomainError } from "@/lib/errors";
import {
  AVATAR_MAX_DIMENSION,
  AVATAR_MAX_INPUT_BYTES,
  AVATAR_MAX_STORED_BYTES,
  AVATAR_OUTPUT_MIME,
  formatMegabytes,
} from "@/domain/avatar-constraints";

/**
 * Validacion y normalizacion de la imagen de avatar (`0.8.0` / MVP-2B, ver
 * docs/PROFESSIONS_AND_PROFILES.md, seccion 22 del encargo). Todo ocurre en
 * servidor: el formato real se comprueba decodificando el contenido con
 * `sharp`, nunca a partir de la extension ni del `File.type` declarado por
 * el navegador.
 *
 * Reglas:
 * - entrada aceptada: JPEG, PNG y WebP (nunca SVG, GIF, HTML ni nada mas);
 * - tamano maximo de entrada: 5 MB;
 * - se corrige la orientacion EXIF y se elimina cualquier metadato del
 *   original (`sharp` no copia metadatos salvo que se pida explicitamente);
 * - se redimensiona conservando proporcion para que ningun lado supere
 *   512 px, sin ampliar imagenes mas pequenas;
 * - la salida es siempre WebP, con un limite propio de tamano almacenado.
 */

/** Formatos de entrada aceptados, comprobados sobre el contenido real decodificado. */
const ACCEPTED_INPUT_FORMATS = new Set(["jpeg", "jpg", "png", "webp"]);

export interface ProcessedAvatar {
  data: Buffer;
  mimeType: string;
  byteSize: number;
  sha256: string;
}

/**
 * Decodifica, valida y normaliza la imagen subida. Lanza `DomainError` con
 * un mensaje comprensible en castellano ante cualquier entrada no valida.
 */
export async function processAvatarImage(input: Buffer): Promise<ProcessedAvatar> {
  if (input.byteLength === 0) {
    throw new DomainError("El archivo esta vacio. Selecciona una imagen valida.", "avatar");
  }
  if (input.byteLength > AVATAR_MAX_INPUT_BYTES) {
    throw new DomainError(
      `La imagen ocupa ${formatMegabytes(input.byteLength)} y el maximo permitido es ${formatMegabytes(AVATAR_MAX_INPUT_BYTES)}.`,
      "avatar",
    );
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input, { animated: false }).metadata();
  } catch {
    throw new DomainError("No se ha podido leer la imagen: puede estar danada o no ser una imagen real.", "avatar");
  }

  if (!metadata.format || !ACCEPTED_INPUT_FORMATS.has(metadata.format)) {
    throw new DomainError("Formato no permitido. Sube una imagen JPEG, PNG o WebP.", "avatar");
  }
  if (!metadata.width || !metadata.height) {
    throw new DomainError("No se han podido determinar las dimensiones de la imagen.", "avatar");
  }

  async function encode(quality: number): Promise<Buffer> {
    return sharp(input, { animated: false })
      // `rotate()` sin argumentos aplica la orientacion EXIF y despues la descarta.
      .rotate()
      .resize({ width: AVATAR_MAX_DIMENSION, height: AVATAR_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
  }

  let output: Buffer;
  try {
    output = await encode(80);
    if (output.byteLength > AVATAR_MAX_STORED_BYTES) {
      output = await encode(55);
    }
  } catch {
    throw new DomainError("No se ha podido procesar la imagen. Prueba con otro archivo.", "avatar");
  }

  if (output.byteLength > AVATAR_MAX_STORED_BYTES) {
    throw new DomainError(
      `La imagen procesada sigue ocupando ${formatMegabytes(output.byteLength)}, por encima del maximo de ${formatMegabytes(
        AVATAR_MAX_STORED_BYTES,
      )}. Prueba con una imagen mas sencilla.`,
      "avatar",
    );
  }

  return {
    data: output,
    mimeType: AVATAR_OUTPUT_MIME,
    byteSize: output.byteLength,
    sha256: createHash("sha256").update(output).digest("hex"),
  };
}
