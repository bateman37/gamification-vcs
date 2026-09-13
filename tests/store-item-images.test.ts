import { beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { resetDatabase, testDb } from "./helpers/db";
import { createSlot } from "./helpers/equipment";
import { createPerson } from "@/server/services/person.service";
import { createSplitWithWeeks, activateSplit } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { createStoreItem, listStoreItemsForSplit } from "@/server/services/store-item.service";
import {
  deleteStoreItemImage,
  processStoreItemImage,
  readStoreItemImageForViewer,
  saveStoreItemImage,
} from "@/server/services/store-item-image.service";
import { openMarket } from "@/server/services/economy.service";
import { DomainError } from "@/lib/errors";
import {
  STORE_ITEM_IMAGE_MAX_DIMENSION,
  STORE_ITEM_IMAGE_MAX_STORED_BYTES,
  STORE_ITEM_IMAGE_OUTPUT_MIME,
} from "@/domain/store-item-image-constraints";

/**
 * Imagen opcional de un objeto del catalogo (`1.2.0`, seccion 17.4 del
 * encargo). Las fixtures se generan al vuelo con `sharp`: no se añade ningun
 * binario al repositorio.
 */

/** PNG solido pequeño, con metadatos EXIF que el procesado debe descartar. */
async function makePng(width = 900, height = 400): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 40, g: 90, b: 200 } } })
    .withMetadata({ exif: { IFD0: { Copyright: "Prueba" } } })
    .png()
    .toBuffer();
}

async function buildSplitWithItem() {
  const split = await createSplitWithWeeks(testDb, {
    name: "Split Imagenes",
    description: undefined,
    startDate: "2025-10-06",
    numberOfWeeks: 2,
  });
  const person = await createPerson(testDb, { fullName: "Persona Imagenes", email: undefined });
  const participant = await addParticipant(testDb, split.id, {
    personId: person.id,
    alias: "Imagenes",
    level: "N2",
    startWeekSequenceNumber: 1,
  });
  await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", {
    isActive: true,
    baseMax: 100,
    multiplierN2: 1,
    parameters: { pointsPerResult: 10 },
  });
  await activateSplit(testDb, split.id);

  const slot = await createSlot(split.id, "HEAD");
  const item = await createStoreItem(testDb, split.id, {
    name: "Yelmo ilustrado",
    description: null,
    priceCredits: 10,
    equipmentSlotId: slot.id,
    kpiCode: "STABILITY_GUARDIAN",
    bonusPercent: 20,
  });
  return { split, person, participant, slot, item };
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Procesado de la imagen de objeto", () => {
  it("convierte a WebP, limita la dimension y no amplia una imagen pequeña", async () => {
    const processed = await processStoreItemImage(await makePng(900, 400));
    expect(processed.mimeType).toBe(STORE_ITEM_IMAGE_OUTPUT_MIME);
    expect(processed.byteSize).toBe(processed.data.byteLength);
    expect(processed.byteSize).toBeLessThanOrEqual(STORE_ITEM_IMAGE_MAX_STORED_BYTES);
    expect(processed.sha256).toMatch(/^[0-9a-f]{64}$/);

    const metadata = await sharp(processed.data).metadata();
    expect(metadata.format).toBe("webp");
    expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBeLessThanOrEqual(STORE_ITEM_IMAGE_MAX_DIMENSION);
    // Los metadatos del original (EXIF) no se copian a la imagen guardada.
    expect(metadata.exif).toBeUndefined();

    const small = await processStoreItemImage(await makePng(64, 64));
    const smallMetadata = await sharp(small.data).metadata();
    expect(smallMetadata.width).toBe(64);
    expect(smallMetadata.height).toBe(64);
  });

  it("rechaza un archivo vacio, un SVG y un archivo que solo finge ser imagen", async () => {
    await expect(processStoreItemImage(Buffer.alloc(0))).rejects.toBeInstanceOf(DomainError);
    await expect(
      processStoreItemImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>')),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(processStoreItemImage(Buffer.from("<html><body>no soy una imagen</body></html>"))).rejects.toBeInstanceOf(DomainError);
  });
});

describe("Persistencia y listados", () => {
  it("guarda, reemplaza y elimina la imagen sin tocar el objeto", async () => {
    const { split, item } = await buildSplitWithItem();

    const first = await processStoreItemImage(await makePng(300, 300));
    await saveStoreItemImage(testDb, split.id, item.id, first);
    const stored = await testDb.splitStoreItemImage.findUniqueOrThrow({ where: { splitStoreItemId: item.id } });
    expect(stored.sha256).toBe(first.sha256);

    const second = await processStoreItemImage(await makePng(200, 120));
    await saveStoreItemImage(testDb, split.id, item.id, second);
    const replaced = await testDb.splitStoreItemImage.findUniqueOrThrow({ where: { splitStoreItemId: item.id } });
    expect(replaced.sha256).toBe(second.sha256);
    expect(await testDb.splitStoreItemImage.count({ where: { splitStoreItemId: item.id } })).toBe(1);

    await deleteStoreItemImage(testDb, split.id, item.id);
    expect(await testDb.splitStoreItemImage.findUnique({ where: { splitStoreItemId: item.id } })).toBeNull();

    // El objeto en si nunca cambia por gestionar su imagen.
    const reloaded = await testDb.splitStoreItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(reloaded.name).toBe(item.name);
    expect(reloaded.priceCredits).toBe(item.priceCredits);
    expect(reloaded.bonusPercent).toBe(item.bonusPercent);
  });

  it("el listado del catalogo solo lleva `imageVersion`, nunca los bytes", async () => {
    const { split, item } = await buildSplitWithItem();
    const processed = await processStoreItemImage(await makePng(300, 300));
    await saveStoreItemImage(testDb, split.id, item.id, processed);

    const [listed] = await listStoreItemsForSplit(testDb, split.id);
    expect(listed!.imageVersion).toBe(processed.sha256);
    expect(Object.keys(listed!)).not.toContain("imageData");
    expect(Object.keys(listed!)).not.toContain("image");
  });

  it("el objeto y su imagen se crean de forma atomica", async () => {
    const { split, slot } = await buildSplitWithItem();
    const processed = await processStoreItemImage(await makePng(300, 300));
    const created = await createStoreItem(
      testDb,
      split.id,
      {
        name: "Yelmo con imagen",
        description: null,
        priceCredits: 12,
        equipmentSlotId: slot.id,
        kpiCode: "STABILITY_GUARDIAN",
        bonusPercent: 10,
      },
      processed,
    );
    const stored = await testDb.splitStoreItemImage.findUniqueOrThrow({ where: { splitStoreItemId: created.id } });
    expect(stored.sha256).toBe(processed.sha256);
  });

  it("no se cambia la imagen con el mercado abierto ni en un objeto de otro split", async () => {
    const { split, item } = await buildSplitWithItem();
    const other = await buildSplitWithItem();
    const processed = await processStoreItemImage(await makePng(300, 300));

    await expect(saveStoreItemImage(testDb, split.id, other.item.id, processed)).rejects.toBeInstanceOf(DomainError);

    await openMarket(testDb, split.id);
    await expect(saveStoreItemImage(testDb, split.id, item.id, processed)).rejects.toBeInstanceOf(DomainError);
  });
});

describe("Autorizacion de lectura de la imagen", () => {
  it("el administrador la ve, el participante del split tambien y cualquier otro recibe `null`", async () => {
    const { split, person, item } = await buildSplitWithItem();
    const processed = await processStoreItemImage(await makePng(300, 300));
    await saveStoreItemImage(testDb, split.id, item.id, processed);

    const asAdmin = await readStoreItemImageForViewer(testDb, split.id, item.id, { isAdmin: true, personId: null });
    expect(asAdmin?.sha256).toBe(processed.sha256);
    expect(asAdmin?.mimeType).toBe(STORE_ITEM_IMAGE_OUTPUT_MIME);

    const asOwnParticipant = await readStoreItemImageForViewer(testDb, split.id, item.id, { isAdmin: false, personId: person.id });
    expect(asOwnParticipant?.sha256).toBe(processed.sha256);

    const outsider = await createPerson(testDb, { fullName: "Persona Ajena", email: undefined });
    expect(await readStoreItemImageForViewer(testDb, split.id, item.id, { isAdmin: false, personId: outsider.id })).toBeNull();
    expect(await readStoreItemImageForViewer(testDb, split.id, item.id, { isAdmin: false, personId: null })).toBeNull();
  });

  it("un objeto de otro split y un objeto inexistente son indistinguibles: ambos devuelven `null`", async () => {
    const { split, person } = await buildSplitWithItem();
    const other = await buildSplitWithItem();
    const processed = await processStoreItemImage(await makePng(300, 300));
    await saveStoreItemImage(testDb, other.split.id, other.item.id, processed);

    // Acceso cruzado: el objeto existe, pero no en este split.
    expect(await readStoreItemImageForViewer(testDb, split.id, other.item.id, { isAdmin: true, personId: null })).toBeNull();
    // Objeto inexistente.
    expect(
      await readStoreItemImageForViewer(testDb, split.id, "00000000-0000-0000-0000-000000000000", { isAdmin: false, personId: person.id }),
    ).toBeNull();
  });

  it("un objeto sin imagen devuelve `null` sin fallar", async () => {
    const { split, item } = await buildSplitWithItem();
    expect(await readStoreItemImageForViewer(testDb, split.id, item.id, { isAdmin: true, personId: null })).toBeNull();
  });
});
