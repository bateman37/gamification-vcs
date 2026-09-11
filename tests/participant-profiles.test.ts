import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { createPerson } from "@/server/services/person.service";
import { createSplitWithWeeks, activateSplit, listSplitWeeks } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { saveStabilityEntries } from "@/server/services/stability-entry.service";
import { publishWeek } from "@/server/services/publish-week.service";
import { createProfession } from "@/server/services/profession.service";
import {
  chooseOwnProfession,
  deleteOwnAvatar,
  listProfileCardsForPerson,
  readAvatarForViewer,
  saveOwnAvatar,
  updateOwnAlias,
} from "@/server/services/participant-profile.service";
import { AVATAR_MAX_DIMENSION, AVATAR_MAX_INPUT_BYTES } from "@/domain/avatar-constraints";
import { DomainError } from "@/lib/errors";

/**
 * Fichas privadas y avatar (`0.8.0` / MVP-2B, seccion 32.5 del encargo).
 * Las imagenes de prueba se generan en memoria: nunca se usan datos ni
 * fotografias reales.
 */

const PROFESSION_N2 = {
  name: "Mecanico",
  kpiCodeA: "STABILITY_GUARDIAN",
  kpiCodeB: "ENTHUSIASTIC_STUDENT",
  availableN0: false,
  availableN1: false,
  availableN2: true,
} as const;

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

/** Imagen sintetica de un color plano, sin ningun dato personal. */
async function makeImage(format: "png" | "jpeg" | "webp", width = 800, height = 600): Promise<Buffer> {
  const image = sharp({ create: { width, height, channels: 3, background: { r: 20, g: 80, b: 160 } } });
  if (format === "png") return image.png().toBuffer();
  if (format === "jpeg") return image.jpeg().toBuffer();
  return image.webp().toBuffer();
}

async function createSplitWithParticipant(options: { level?: "N0" | "N1" | "N2"; alias?: string } = {}) {
  const split = await createSplitWithWeeks(testDb, {
    name: "Split de fichas",
    description: undefined,
    startDate: "2025-10-06",
    numberOfWeeks: 2,
  });
  const person = await createPerson(testDb, { fullName: "Titular Ficha", email: undefined });
  const participant = await addParticipant(testDb, split.id, {
    personId: person.id,
    alias: options.alias ?? "Titular",
    level: options.level ?? "N2",
    startWeekSequenceNumber: 1,
  });
  return { split, person, participant };
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Fichas: propiedad y alcance de las operaciones", () => {
  it("lista una ficha por participacion, ordenando ACTIVE, DRAFT y CLOSED", async () => {
    const person = await createPerson(testDb, { fullName: "Multi Split", email: undefined });
    const draft = await createSplitWithWeeks(testDb, { name: "En borrador", description: undefined, startDate: "2025-10-06", numberOfWeeks: 1 });
    const active = await createSplitWithWeeks(testDb, { name: "Activo", description: undefined, startDate: "2025-09-01", numberOfWeeks: 1 });
    const closed = await createSplitWithWeeks(testDb, { name: "Cerrado", description: undefined, startDate: "2025-08-04", numberOfWeeks: 1 });

    for (const [index, split] of [draft, active, closed].entries()) {
      await addParticipant(testDb, split.id, { personId: person.id, alias: `Alias${index}`, level: "N2", startWeekSequenceNumber: 1 });
    }
    await updateKpiConfig(testDb, active.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 70, multiplierN2: 1, parameters: { pointsPerResult: 1 } });
    await activateSplit(testDb, active.id);
    await testDb.split.update({ where: { id: closed.id }, data: { status: "CLOSED" } });

    const cards = await listProfileCardsForPerson(testDb, person.id);
    expect(cards.map((card) => card.splitName)).toEqual(["Activo", "En borrador", "Cerrado"]);
    expect(cards.find((card) => card.splitName === "Cerrado")!.editable).toBe(false);
    // Ninguna tarjeta expone bytes de avatar: solo su version (hash) o `null`.
    expect(cards.every((card) => card.avatarVersion === null)).toBe(true);
  });

  it("no deja editar una ficha que no esta vinculada al propio personId", async () => {
    const { participant } = await createSplitWithParticipant();
    const intruder = await createPerson(testDb, { fullName: "Intruso", email: undefined });

    await expect(updateOwnAlias(testDb, intruder.id, participant.id, "Robado")).rejects.toBeInstanceOf(DomainError);
    await expect(chooseOwnProfession(testDb, intruder.id, participant.id, null)).rejects.toBeInstanceOf(DomainError);
    await expect(deleteOwnAvatar(testDb, intruder.id, participant.id)).rejects.toBeInstanceOf(DomainError);
    await expect(saveOwnAvatar(testDb, intruder.id, participant.id, await makeImage("png"))).rejects.toBeInstanceOf(DomainError);
  });

  it("cambiar el alias propio no modifica nivel, faccion, persona ni semana inicial", async () => {
    const { participant, person } = await createSplitWithParticipant();
    const before = await testDb.splitParticipant.findUniqueOrThrow({ where: { id: participant.id } });

    await updateOwnAlias(testDb, person.id, participant.id, "  Nuevo Alias  ");

    const after = await testDb.splitParticipant.findUniqueOrThrow({ where: { id: participant.id } });
    expect(after.alias).toBe("Nuevo Alias");
    expect(after.aliasNormalized).toBe("nuevo alias");
    expect(after.level).toBe(before.level);
    expect(after.factionId).toBe(before.factionId);
    expect(after.personId).toBe(before.personId);
    expect(after.startWeekSequenceNumber).toBe(before.startWeekSequenceNumber);
  });

  it("el alias propio conserva la unicidad por split", async () => {
    const { split, person, participant } = await createSplitWithParticipant({ alias: "Uno" });
    const other = await createPerson(testDb, { fullName: "Otro", email: undefined });
    await addParticipant(testDb, split.id, { personId: other.id, alias: "Dos", level: "N2", startWeekSequenceNumber: 1 });

    await expect(updateOwnAlias(testDb, person.id, participant.id, "dos")).rejects.toBeInstanceOf(DomainError);
    await expect(updateOwnAlias(testDb, person.id, participant.id, "Tres")).resolves.toBeTruthy();
  });
});

describe("Fichas: eleccion de profesion por el participante", () => {
  it("permite elegir, cambiar y dejar sin elegir antes de la primera publicacion", async () => {
    const { split, person, participant } = await createSplitWithParticipant();
    const profession = await createProfession(testDb, split.id, PROFESSION_N2);

    const chosen = await chooseOwnProfession(testDb, person.id, participant.id, profession.id);
    expect(chosen.professionId).toBe(profession.id);

    const cleared = await chooseOwnProfession(testDb, person.id, participant.id, null);
    expect(cleared.professionId).toBeNull();
  });

  it("rechaza una profesion de otro split o no disponible para su nivel", async () => {
    const { split, person, participant } = await createSplitWithParticipant({ level: "N0" });
    const otherSplit = await createSplitWithWeeks(testDb, { name: "Otro", description: undefined, startDate: "2025-10-06", numberOfWeeks: 1 });
    const foreign = await createProfession(testDb, otherSplit.id, PROFESSION_N2);
    const ownButN2Only = await createProfession(testDb, split.id, PROFESSION_N2);

    await expect(chooseOwnProfession(testDb, person.id, participant.id, foreign.id)).rejects.toBeInstanceOf(DomainError);
    await expect(chooseOwnProfession(testDb, person.id, participant.id, ownButN2Only.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("rechaza elegir profesion en un split que no usa profesiones", async () => {
    const { person, participant } = await createSplitWithParticipant();
    await expect(chooseOwnProfession(testDb, person.id, participant.id, null)).rejects.toBeInstanceOf(DomainError);
  });

  it("rechaza cambiar la profesion desde la ficha despues de la primera publicacion", async () => {
    const { split, person, participant } = await createSplitWithParticipant();
    const profession = await createProfession(testDb, split.id, PROFESSION_N2);
    await chooseOwnProfession(testDb, person.id, participant.id, profession.id);
    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 70, multiplierN2: 1, parameters: { pointsPerResult: 1 } });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "50" }));
    await publishWeek(testDb, split.id, week.id, null);

    await expect(chooseOwnProfession(testDb, person.id, participant.id, null)).rejects.toBeInstanceOf(DomainError);

    const cards = await listProfileCardsForPerson(testDb, person.id);
    expect(cards[0]!.professionLocked).toBe(true);
    // El alias sigue siendo editable en un split activo, aunque ya tenga publicaciones.
    await expect(updateOwnAlias(testDb, person.id, participant.id, "Sigue Editable")).resolves.toBeTruthy();
  });
});

describe("Fichas: avatar", () => {
  it("normaliza y persiste una imagen valida: WebP, maximo 512 px y sin metadatos del original", async () => {
    const { person, participant } = await createSplitWithParticipant();
    await saveOwnAvatar(testDb, person.id, participant.id, await makeImage("jpeg", 1200, 900));

    const stored = await testDb.splitParticipantAvatar.findUniqueOrThrow({ where: { splitParticipantId: participant.id } });
    expect(stored.mimeType).toBe("image/webp");
    expect(stored.byteSize).toBe(stored.imageData.length);
    expect(stored.sha256).toMatch(/^[0-9a-f]{64}$/);

    const metadata = await sharp(Buffer.from(stored.imageData)).metadata();
    expect(metadata.format).toBe("webp");
    expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBeLessThanOrEqual(AVATAR_MAX_DIMENSION);
    expect(metadata.exif).toBeUndefined();
  });

  it("acepta PNG y WebP ademas de JPEG", async () => {
    const { person, participant } = await createSplitWithParticipant();
    for (const format of ["png", "webp", "jpeg"] as const) {
      await expect(saveOwnAvatar(testDb, person.id, participant.id, await makeImage(format, 300, 300))).resolves.toBeUndefined();
    }
  });

  it("rechaza un archivo por encima de 5 MB", async () => {
    const { person, participant } = await createSplitWithParticipant();
    const oversized = Buffer.alloc(AVATAR_MAX_INPUT_BYTES + 1, 1);
    await expect(saveOwnAvatar(testDb, person.id, participant.id, oversized)).rejects.toBeInstanceOf(DomainError);
    expect(await testDb.splitParticipantAvatar.count()).toBe(0);
  });

  it("rechaza SVG, GIF y contenido corrupto, aunque el nombre o el MIME digan otra cosa", async () => {
    const { person, participant } = await createSplitWithParticipant();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).gif().toBuffer();
    const corrupt = Buffer.from("esto no es una imagen, solo texto plano");

    for (const input of [svg, gif, corrupt]) {
      await expect(saveOwnAvatar(testDb, person.id, participant.id, input)).rejects.toBeInstanceOf(DomainError);
    }
    expect(await testDb.splitParticipantAvatar.count()).toBe(0);
  });

  it("reemplaza y elimina el avatar", async () => {
    const { person, participant } = await createSplitWithParticipant();
    await saveOwnAvatar(testDb, person.id, participant.id, await makeImage("png", 400, 400));
    const first = await testDb.splitParticipantAvatar.findUniqueOrThrow({ where: { splitParticipantId: participant.id } });

    await saveOwnAvatar(testDb, person.id, participant.id, await makeImage("png", 200, 100));
    const second = await testDb.splitParticipantAvatar.findUniqueOrThrow({ where: { splitParticipantId: participant.id } });
    expect(second.sha256).not.toBe(first.sha256);
    expect(await testDb.splitParticipantAvatar.count()).toBe(1);

    await deleteOwnAvatar(testDb, person.id, participant.id);
    expect(await testDb.splitParticipantAvatar.count()).toBe(0);
    // Borrar de nuevo es idempotente.
    await expect(deleteOwnAvatar(testDb, person.id, participant.id)).resolves.toBeUndefined();
  });

  it("un split cerrado rechaza cualquier mutacion de la ficha", async () => {
    const { split, person, participant } = await createSplitWithParticipant();
    await testDb.split.update({ where: { id: split.id }, data: { status: "CLOSED" } });

    await expect(updateOwnAlias(testDb, person.id, participant.id, "Cerrado")).rejects.toBeInstanceOf(DomainError);
    await expect(saveOwnAvatar(testDb, person.id, participant.id, await makeImage("png"))).rejects.toBeInstanceOf(DomainError);
    await expect(deleteOwnAvatar(testDb, person.id, participant.id)).rejects.toBeInstanceOf(DomainError);
    await expect(chooseOwnProfession(testDb, person.id, participant.id, null)).rejects.toBeInstanceOf(DomainError);
  });

  it("la lectura del avatar no expone la ficha de otra persona", async () => {
    const { person, participant } = await createSplitWithParticipant();
    await saveOwnAvatar(testDb, person.id, participant.id, await makeImage("png", 200, 200));
    const intruder = await createPerson(testDb, { fullName: "Intruso", email: undefined });

    expect(await readAvatarForViewer(testDb, participant.id, { isAdmin: false, personId: intruder.id })).toBeNull();
    expect(await readAvatarForViewer(testDb, participant.id, { isAdmin: false, personId: null })).toBeNull();
    expect(await readAvatarForViewer(testDb, participant.id, { isAdmin: false, personId: person.id })).not.toBeNull();
    // Un administrador si puede leerla; una ficha inexistente devuelve siempre null, sin revelar nada.
    expect(await readAvatarForViewer(testDb, participant.id, { isAdmin: true, personId: null })).not.toBeNull();
    expect(await readAvatarForViewer(testDb, "no-existe", { isAdmin: true, personId: null })).toBeNull();
  });
});
