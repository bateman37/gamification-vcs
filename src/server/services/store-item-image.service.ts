import { createHash } from "node:crypto";
import sharp from "sharp";
import type { Prisma, PrismaClient } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { formatMegabytes } from "@/domain/avatar-constraints";
import {
  STORE_ITEM_IMAGE_FIELD,
  STORE_ITEM_IMAGE_MAX_DIMENSION,
  STORE_ITEM_IMAGE_MAX_INPUT_BYTES,
  STORE_ITEM_IMAGE_MAX_STORED_BYTES,
  STORE_ITEM_IMAGE_OUTPUT_MIME,
} from "@/domain/store-item-image-constraints";
import { getEconomySettings } from "@/server/services/economy.service";

/**
 * Imagen opcional de un objeto del catalogo (`1.2.0`, seccion 7 del
 * encargo). Mismo tratamiento seguro que el avatar
 * (`src/server/services/avatar-image.ts`): toda la validacion real ocurre en
 * servidor decodificando el contenido con `sharp`, nunca a partir de la
 * extension ni del `File.type` declarado por el navegador.
 *
 * Reglas:
 * - entrada aceptada: JPEG, PNG y WebP (nunca SVG, GIF animado, HTML ni nada mas);
 * - tamano maximo de entrada: 5 MB;
 * - se corrige la orientacion EXIF y se eliminan los metadatos del original;
 * - ningun lado supera 512 px y las imagenes pequeñas nunca se amplian;
 * - la salida es siempre WebP, con su propio tope de bytes almacenados.
 *
 * **Excepcion cosmetica documentada:** la imagen es la unica propiedad de un
 * objeto que puede añadirse, reemplazarse o eliminarse despues de su primera
 * compra. No forma parte de la formula, del precio ni de la auditoria
 * numerica: los snapshots publicados de nombre, ranura, KPI y porcentaje
 * siguen siendo la verdad historica y no cambian. Sigue exigiendo mercado
 * cerrado, split no cerrado y sesion de administrador.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** Formatos de entrada aceptados, comprobados sobre el contenido real decodificado. */
const ACCEPTED_INPUT_FORMATS = new Set(["jpeg", "jpg", "png", "webp"]);

export interface ProcessedStoreItemImage {
  data: Buffer;
  mimeType: string;
  byteSize: number;
  sha256: string;
}

/**
 * Decodifica, valida y normaliza la imagen subida. Se ejecuta siempre
 * **antes** de abrir la transaccion: una imagen invalida nunca deja un objeto
 * creado a medias ni borra una imagen anterior valida.
 */
export async function processStoreItemImage(input: Buffer): Promise<ProcessedStoreItemImage> {
  if (input.byteLength === 0) {
    throw new DomainError("El archivo está vacío. Selecciona una imagen válida.", STORE_ITEM_IMAGE_FIELD);
  }
  if (input.byteLength > STORE_ITEM_IMAGE_MAX_INPUT_BYTES) {
    throw new DomainError(
      `La imagen ocupa ${formatMegabytes(input.byteLength)} y el máximo permitido es ${formatMegabytes(
        STORE_ITEM_IMAGE_MAX_INPUT_BYTES,
      )}.`,
      STORE_ITEM_IMAGE_FIELD,
    );
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input, { animated: false }).metadata();
  } catch {
    throw new DomainError(
      "No se ha podido leer la imagen: puede estar dañada o no ser una imagen real.",
      STORE_ITEM_IMAGE_FIELD,
    );
  }

  if (!metadata.format || !ACCEPTED_INPUT_FORMATS.has(metadata.format)) {
    throw new DomainError("Formato no permitido. Sube una imagen JPEG, PNG o WebP.", STORE_ITEM_IMAGE_FIELD);
  }
  if (!metadata.width || !metadata.height) {
    throw new DomainError("No se han podido determinar las dimensiones de la imagen.", STORE_ITEM_IMAGE_FIELD);
  }

  async function encode(quality: number): Promise<Buffer> {
    return sharp(input, { animated: false })
      // `rotate()` sin argumentos aplica la orientacion EXIF y despues la descarta.
      .rotate()
      .resize({
        width: STORE_ITEM_IMAGE_MAX_DIMENSION,
        height: STORE_ITEM_IMAGE_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toBuffer();
  }

  let output: Buffer;
  try {
    output = await encode(80);
    if (output.byteLength > STORE_ITEM_IMAGE_MAX_STORED_BYTES) {
      output = await encode(55);
    }
  } catch {
    throw new DomainError("No se ha podido procesar la imagen. Prueba con otro archivo.", STORE_ITEM_IMAGE_FIELD);
  }

  if (output.byteLength > STORE_ITEM_IMAGE_MAX_STORED_BYTES) {
    throw new DomainError(
      `La imagen procesada sigue ocupando ${formatMegabytes(output.byteLength)}, por encima del máximo de ${formatMegabytes(
        STORE_ITEM_IMAGE_MAX_STORED_BYTES,
      )}. Prueba con una imagen más sencilla.`,
      STORE_ITEM_IMAGE_FIELD,
    );
  }

  return {
    data: output,
    mimeType: STORE_ITEM_IMAGE_OUTPUT_MIME,
    byteSize: output.byteLength,
    sha256: createHash("sha256").update(output).digest("hex"),
  };
}

async function assertImageIsEditable(db: Db, splitId: string): Promise<void> {
  const split = await db.split.findUnique({ where: { id: splitId } });
  if (!split) throw new DomainError("El split indicado no existe.");
  if (split.status === "CLOSED") {
    throw new DomainError("No se pueden modificar las imágenes de los objetos de un split cerrado.");
  }
  const settings = await getEconomySettings(db, splitId);
  if (settings.marketStatus === "OPEN") {
    throw new DomainError("Cierra el mercado antes de cambiar la imagen de un objeto.");
  }
}

/**
 * Guarda (o reemplaza) la imagen de un objeto. La imagen ya viene procesada:
 * esta funcion solo persiste, de forma que una subida fallida nunca llega a
 * tocar la imagen anterior.
 */
export async function saveStoreItemImage(
  db: Db,
  splitId: string,
  storeItemId: string,
  processed: ProcessedStoreItemImage,
): Promise<void> {
  await assertImageIsEditable(db, splitId);
  const item = await db.splitStoreItem.findUnique({ where: { id: storeItemId }, select: { splitId: true } });
  if (!item || item.splitId !== splitId) {
    throw new DomainError("El objeto indicado no existe en este split.");
  }

  await db.splitStoreItemImage.upsert({
    where: { splitStoreItemId: storeItemId },
    create: {
      splitStoreItemId: storeItemId,
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

/** Elimina la imagen de un objeto y vuelve al icono de reserva. Idempotente. */
export async function deleteStoreItemImage(db: PrismaClient, splitId: string, storeItemId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await assertImageIsEditable(tx, splitId);
    const item = await tx.splitStoreItem.findUnique({ where: { id: storeItemId }, select: { splitId: true } });
    if (!item || item.splitId !== splitId) {
      throw new DomainError("El objeto indicado no existe en este split.");
    }
    await tx.splitStoreItemImage.deleteMany({ where: { splitStoreItemId: storeItemId } });
  });
}

export interface StoredStoreItemImage {
  data: Buffer;
  mimeType: string;
  sha256: string;
}

/**
 * Autorizacion de lectura de la imagen (seccion 7.4 del encargo). Es la unica
 * funcion que decide el acceso, resuelta siempre en servidor:
 *
 * - `ADMIN`: cualquier objeto;
 * - participante: solo objetos de un split en el que participa.
 *
 * Un objeto inexistente y un acceso cruzado devuelven ambos `null`, para que
 * la ruta responda `404` sin revelar si el objeto existe.
 */
export async function readStoreItemImageForViewer(
  db: Db,
  splitId: string,
  storeItemId: string,
  viewer: { isAdmin: boolean; personId: string | null },
): Promise<StoredStoreItemImage | null> {
  const item = await db.splitStoreItem.findUnique({
    where: { id: storeItemId },
    select: { splitId: true, image: { select: { imageData: true, mimeType: true, sha256: true } } },
  });
  if (!item || item.splitId !== splitId) return null;

  if (!viewer.isAdmin) {
    if (!viewer.personId) return null;
    const participation = await db.splitParticipant.findFirst({
      where: { splitId, personId: viewer.personId },
      select: { id: true },
    });
    if (!participation) return null;
  }

  if (!item.image) return null;
  return {
    data: Buffer.from(item.image.imageData),
    mimeType: item.image.mimeType,
    sha256: item.image.sha256,
  };
}
