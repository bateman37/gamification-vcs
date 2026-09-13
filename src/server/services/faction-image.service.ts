import { createHash } from "node:crypto";
import sharp from "sharp";
import type { Prisma, PrismaClient } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { formatMegabytes } from "@/domain/avatar-constraints";
import {
  FACTION_IMAGE_FIELD,
  FACTION_IMAGE_MAX_DIMENSION,
  FACTION_IMAGE_MAX_INPUT_BYTES,
  FACTION_IMAGE_MAX_STORED_BYTES,
  FACTION_IMAGE_OUTPUT_MIME,
} from "@/domain/faction-image-constraints";

/**
 * Emblema opcional de una faccion (`1.2.2`, ver docs/FACTIONS.md). Mismo
 * tratamiento seguro que el avatar y la imagen de objeto: toda la
 * validacion real ocurre en servidor decodificando el contenido con
 * `sharp`, nunca a partir de la extension ni del `File.type` declarado por
 * el navegador.
 *
 * Reglas:
 * - entrada aceptada: JPEG, PNG y WebP;
 * - tamano maximo de entrada: 5 MB;
 * - se corrige la orientacion EXIF y se eliminan los metadatos del original;
 * - ningun lado supera 512 px y las imagenes pequeñas nunca se amplian;
 * - la salida es siempre WebP, con su propio tope de bytes almacenados.
 *
 * La imagen es un recurso cosmetico actual (seccion 5.4 del encargo): nunca
 * se congela en un snapshot ni cambia una clasificacion o noticia
 * historica. No exige mercado cerrado (a diferencia de la imagen de
 * objeto): solo que el split no este `CLOSED`.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** Formatos de entrada aceptados, comprobados sobre el contenido real decodificado. */
const ACCEPTED_INPUT_FORMATS = new Set(["jpeg", "jpg", "png", "webp"]);

export interface ProcessedFactionImage {
  data: Buffer;
  mimeType: string;
  byteSize: number;
  sha256: string;
}

/**
 * Decodifica, valida y normaliza la imagen subida. Se ejecuta siempre
 * **antes** de abrir la transaccion: una imagen invalida nunca deja una
 * faccion a medias ni borra una imagen anterior valida.
 */
export async function processFactionImage(input: Buffer): Promise<ProcessedFactionImage> {
  if (input.byteLength === 0) {
    throw new DomainError("El archivo está vacío. Selecciona una imagen válida.", FACTION_IMAGE_FIELD);
  }
  if (input.byteLength > FACTION_IMAGE_MAX_INPUT_BYTES) {
    throw new DomainError(
      `La imagen ocupa ${formatMegabytes(input.byteLength)} y el máximo permitido es ${formatMegabytes(
        FACTION_IMAGE_MAX_INPUT_BYTES,
      )}.`,
      FACTION_IMAGE_FIELD,
    );
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input, { animated: false }).metadata();
  } catch {
    throw new DomainError(
      "No se ha podido leer la imagen: puede estar dañada o no ser una imagen real.",
      FACTION_IMAGE_FIELD,
    );
  }

  if (!metadata.format || !ACCEPTED_INPUT_FORMATS.has(metadata.format)) {
    throw new DomainError("Formato no permitido. Sube una imagen JPEG, PNG o WebP.", FACTION_IMAGE_FIELD);
  }
  if (!metadata.width || !metadata.height) {
    throw new DomainError("No se han podido determinar las dimensiones de la imagen.", FACTION_IMAGE_FIELD);
  }

  async function encode(quality: number): Promise<Buffer> {
    return sharp(input, { animated: false })
      // `rotate()` sin argumentos aplica la orientacion EXIF y despues la descarta.
      .rotate()
      .resize({
        width: FACTION_IMAGE_MAX_DIMENSION,
        height: FACTION_IMAGE_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toBuffer();
  }

  let output: Buffer;
  try {
    output = await encode(80);
    if (output.byteLength > FACTION_IMAGE_MAX_STORED_BYTES) {
      output = await encode(55);
    }
  } catch {
    throw new DomainError("No se ha podido procesar la imagen. Prueba con otro archivo.", FACTION_IMAGE_FIELD);
  }

  if (output.byteLength > FACTION_IMAGE_MAX_STORED_BYTES) {
    throw new DomainError(
      `La imagen procesada sigue ocupando ${formatMegabytes(output.byteLength)}, por encima del máximo de ${formatMegabytes(
        FACTION_IMAGE_MAX_STORED_BYTES,
      )}. Prueba con una imagen más sencilla.`,
      FACTION_IMAGE_FIELD,
    );
  }

  return {
    data: output,
    mimeType: FACTION_IMAGE_OUTPUT_MIME,
    byteSize: output.byteLength,
    sha256: createHash("sha256").update(output).digest("hex"),
  };
}

async function assertImageIsEditable(db: Db, splitId: string): Promise<void> {
  const split = await db.split.findUnique({ where: { id: splitId } });
  if (!split) throw new DomainError("El split indicado no existe.");
  if (split.status === "CLOSED") {
    throw new DomainError("No se pueden modificar las imágenes de las facciones de un split cerrado.");
  }
}

/**
 * Guarda (o reemplaza) el emblema de una faccion. La imagen ya viene
 * procesada: esta funcion solo persiste, de forma que una subida fallida
 * nunca llega a tocar la imagen anterior.
 */
export async function saveFactionImage(
  db: Db,
  splitId: string,
  factionId: string,
  processed: ProcessedFactionImage,
): Promise<void> {
  await assertImageIsEditable(db, splitId);
  const faction = await db.splitFaction.findUnique({ where: { id: factionId }, select: { splitId: true } });
  if (!faction || faction.splitId !== splitId) {
    throw new DomainError("La faccion indicada no existe en este split.");
  }

  await db.splitFactionImage.upsert({
    where: { splitFactionId: factionId },
    create: {
      splitFactionId: factionId,
      imageData: processed.data,
      mimeType: processed.mimeType,
      byteSize: processed.byteSize,
      sha256: processed.sha256,
    },
    update: {
      imageData: processed.data,
      mimeType: processed.mimeType,
      byteSize: processed.byteSize,
      sha256: processed.sha256,
    },
  });
}

/** Elimina el emblema de una faccion y vuelve al icono de reserva. Idempotente. */
export async function deleteFactionImage(db: PrismaClient, splitId: string, factionId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await assertImageIsEditable(tx, splitId);
    const faction = await tx.splitFaction.findUnique({ where: { id: factionId }, select: { splitId: true } });
    if (!faction || faction.splitId !== splitId) {
      throw new DomainError("La faccion indicada no existe en este split.");
    }
    await tx.splitFactionImage.deleteMany({ where: { splitFactionId: factionId } });
  });
}

export interface StoredFactionImage {
  data: Buffer;
  mimeType: string;
  sha256: string;
}

/**
 * Autorizacion de lectura del emblema, mismo patron que
 * `readStoreItemImageForViewer`:
 *
 * - `ADMIN`: cualquier faccion;
 * - participante: solo facciones de un split en el que participa.
 *
 * Una faccion inexistente y un acceso cruzado devuelven ambos `null`, para
 * que la ruta responda `404` sin revelar si la faccion existe.
 */
export async function readFactionImageForViewer(
  db: Db,
  splitId: string,
  factionId: string,
  viewer: { isAdmin: boolean; personId: string | null },
): Promise<StoredFactionImage | null> {
  const faction = await db.splitFaction.findUnique({
    where: { id: factionId },
    select: { splitId: true, image: { select: { imageData: true, mimeType: true, sha256: true } } },
  });
  if (!faction || faction.splitId !== splitId) return null;

  if (!viewer.isAdmin) {
    if (!viewer.personId) return null;
    const participation = await db.splitParticipant.findFirst({
      where: { splitId, personId: viewer.personId },
      select: { id: true },
    });
    if (!participation) return null;
  }

  if (!faction.image) return null;
  return {
    data: Buffer.from(faction.image.imageData),
    mimeType: faction.image.mimeType,
    sha256: faction.image.sha256,
  };
}
