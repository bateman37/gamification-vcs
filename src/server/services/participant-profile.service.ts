import type { ParticipantLevel, Prisma, PrismaClient, SplitParticipant, SplitStatus } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { normalizeAlias } from "@/lib/normalize";
import { isProfessionAvailableForLevel } from "@/domain/profession-bonus";
import { toProfessionView, type ProfessionView } from "@/domain/profession-display";
import { processAvatarImage } from "@/server/services/avatar-image";
import { splitHasAnyPublication } from "@/server/services/profession.service";

/**
 * Fichas privadas de participante (`0.8.0` / MVP-2B, ver
 * docs/PROFESSIONS_AND_PROFILES.md, parte D del encargo).
 *
 * Todas las operaciones son de **autoservicio** y de intencion limitada:
 * reciben siempre el `personId` resuelto en servidor desde la sesion, nunca
 * uno enviado por el navegador, y comprueban que la participacion indicada
 * pertenece a esa persona. Ninguna de ellas puede cambiar nivel, faccion,
 * semana inicial, persona ni datos de otra ficha; la administracion sigue
 * usando `participant.service.ts`.
 */

type Db = PrismaClient | Prisma.TransactionClient;

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

export interface ProfileCard {
  splitParticipantId: string;
  splitId: string;
  splitName: string;
  splitStatus: SplitStatus;
  splitStartDate: Date;
  alias: string;
  level: ParticipantLevel;
  faction: { name: string; color: string } | null;
  /** Profesion actual (no una instantanea publicada). `null` si no ha elegido o el split no usa profesiones. */
  profession: ProfessionView | null;
  /** Profesiones del split disponibles para el nivel del participante. Vacio si el split no usa profesiones. */
  availableProfessions: ProfessionView[];
  /** `true` si el split tiene al menos una profesion creada. */
  splitUsesProfessions: boolean;
  /** `true` desde la primera publicacion del split: la profesion deja de ser editable. */
  professionLocked: boolean;
  /** `false` cuando el split esta `CLOSED`: toda la ficha pasa a solo lectura. */
  editable: boolean;
  /** Version estable del avatar (hash), o `null` si no tiene. Nunca se cargan los bytes aqui. */
  avatarVersion: string | null;
  /** `true` si el split tiene alguna semana publicada (para enlazar a los resultados). */
  hasPublishedResults: boolean;
}

const SPLIT_STATUS_ORDER: Record<SplitStatus, number> = { ACTIVE: 0, DRAFT: 1, CLOSED: 2 };

/**
 * Fichas de una persona, una por participacion de split. Nunca selecciona
 * los bytes del avatar: solo su hash, para construir la URL de la imagen.
 */
export async function listProfileCardsForPerson(db: Db, personId: string): Promise<ProfileCard[]> {
  const participations = await db.splitParticipant.findMany({
    where: { personId },
    include: {
      split: { select: { id: true, name: true, status: true, startDate: true } },
      faction: { select: { name: true, color: true } },
      profession: true,
      avatar: { select: { sha256: true } },
    },
  });
  if (participations.length === 0) return [];

  const splitIds = Array.from(new Set(participations.map((participation) => participation.splitId)));
  const [professions, publications] = await Promise.all([
    db.splitProfession.findMany({ where: { splitId: { in: splitIds } }, orderBy: { name: "asc" } }),
    db.weekPublication.findMany({ where: { splitWeek: { splitId: { in: splitIds } } }, select: { splitWeek: { select: { splitId: true } } } }),
  ]);

  const professionsBySplit = new Map<string, typeof professions>();
  for (const profession of professions) {
    const list = professionsBySplit.get(profession.splitId) ?? [];
    list.push(profession);
    professionsBySplit.set(profession.splitId, list);
  }
  const publishedSplitIds = new Set(publications.map((publication) => publication.splitWeek.splitId));

  return participations
    .map((participation) => {
      const splitProfessions = professionsBySplit.get(participation.splitId) ?? [];
      const hasPublications = publishedSplitIds.has(participation.splitId);
      return {
        splitParticipantId: participation.id,
        splitId: participation.splitId,
        splitName: participation.split.name,
        splitStatus: participation.split.status,
        splitStartDate: participation.split.startDate,
        alias: participation.alias,
        level: participation.level,
        faction: participation.faction,
        profession: participation.profession ? toProfessionView(participation.profession) : null,
        availableProfessions: splitProfessions
          .filter((profession) => isProfessionAvailableForLevel(profession, participation.level))
          .map(toProfessionView),
        splitUsesProfessions: splitProfessions.length > 0,
        professionLocked: hasPublications,
        editable: participation.split.status !== "CLOSED",
        avatarVersion: participation.avatar?.sha256 ?? null,
        hasPublishedResults: hasPublications,
      } satisfies ProfileCard;
    })
    .sort(
      (a, b) =>
        SPLIT_STATUS_ORDER[a.splitStatus] - SPLIT_STATUS_ORDER[b.splitStatus] ||
        b.splitStartDate.getTime() - a.splitStartDate.getTime() ||
        a.splitName.localeCompare(b.splitName, "es"),
    );
}

/**
 * Carga la participacion comprobando que pertenece a la persona de la
 * sesion. Devolver un error generico (y no "no existe" frente a "no es
 * tuya") evita revelar la existencia de fichas ajenas.
 */
async function getOwnParticipationOrThrow(
  db: Db,
  personId: string,
  splitParticipantId: string,
): Promise<SplitParticipant & { split: { id: string; status: SplitStatus } }> {
  const participation = await db.splitParticipant.findUnique({
    where: { id: splitParticipantId },
    include: { split: { select: { id: true, status: true } } },
  });
  if (!participation || participation.personId !== personId) {
    throw new DomainError("Esta ficha no existe o no es tuya.");
  }
  return participation;
}

async function getEditableOwnParticipationOrThrow(db: Db, personId: string, splitParticipantId: string) {
  const participation = await getOwnParticipationOrThrow(db, personId, splitParticipantId);
  if (participation.split.status === "CLOSED") {
    throw new DomainError("El split esta cerrado: su ficha es de solo lectura.");
  }
  return participation;
}

/**
 * Cambia el alias propio dentro de un split. Reutiliza la misma
 * normalizacion y la misma unicidad por split que la administracion; no
 * toca ningun otro campo y no reescribe instantaneas ya publicadas.
 */
export async function updateOwnAlias(
  db: PrismaClient,
  personId: string,
  splitParticipantId: string,
  alias: string,
): Promise<SplitParticipant> {
  const participation = await getEditableOwnParticipationOrThrow(db, personId, splitParticipantId);
  const trimmed = alias.trim();
  if (trimmed.length === 0) throw new DomainError("El alias es obligatorio.", "alias");
  if (trimmed.length > 100) throw new DomainError("El alias es demasiado largo.", "alias");

  try {
    return await db.splitParticipant.update({
      where: { id: participation.id },
      data: { alias: trimmed, aliasNormalized: normalizeAlias(trimmed) },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === UNIQUE_CONSTRAINT_ERROR_CODE) {
      throw new DomainError("Ya existe un participante con ese alias en este split.", "alias");
    }
    throw error;
  }
}

/**
 * Elige (o deja sin elegir) la propia profesion, solo mientras el split no
 * tenga ninguna semana publicada. Valida propiedad de la ficha, split,
 * nivel y pertenencia de la profesion.
 */
export async function chooseOwnProfession(
  db: PrismaClient,
  personId: string,
  splitParticipantId: string,
  professionId: string | null,
): Promise<SplitParticipant> {
  const participation = await getEditableOwnParticipationOrThrow(db, personId, splitParticipantId);

  if (await splitHasAnyPublication(db, participation.splitId)) {
    throw new DomainError("Profesion bloqueada desde la publicacion de la primera semana.", "professionId");
  }

  const professionCount = await db.splitProfession.count({ where: { splitId: participation.splitId } });
  if (professionCount === 0) {
    throw new DomainError("Este split no utiliza profesiones.", "professionId");
  }

  if (professionId === null) {
    return db.splitParticipant.update({ where: { id: participation.id }, data: { professionId: null } });
  }

  const profession = await db.splitProfession.findUnique({ where: { id: professionId } });
  if (!profession || profession.splitId !== participation.splitId) {
    throw new DomainError("La profesion seleccionada no pertenece a este split.", "professionId");
  }
  if (!isProfessionAvailableForLevel(profession, participation.level)) {
    throw new DomainError(`La profesion "${profession.name}" no esta disponible para tu nivel ${participation.level}.`, "professionId");
  }

  return db.splitParticipant.update({ where: { id: participation.id }, data: { professionId: profession.id } });
}

/** Guarda (o reemplaza) el avatar propio, ya validado y normalizado. */
export async function saveOwnAvatar(
  db: PrismaClient,
  personId: string,
  splitParticipantId: string,
  input: Buffer,
): Promise<void> {
  const participation = await getEditableOwnParticipationOrThrow(db, personId, splitParticipantId);
  const processed = await processAvatarImage(input);

  await db.splitParticipantAvatar.upsert({
    where: { splitParticipantId: participation.id },
    create: {
      splitParticipantId: participation.id,
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

/** Elimina el avatar propio. Es idempotente: si no habia ninguno, no falla. */
export async function deleteOwnAvatar(db: PrismaClient, personId: string, splitParticipantId: string): Promise<void> {
  const participation = await getEditableOwnParticipationOrThrow(db, personId, splitParticipantId);
  await db.splitParticipantAvatar.deleteMany({ where: { splitParticipantId: participation.id } });
}

export interface StoredAvatar {
  data: Buffer;
  mimeType: string;
  sha256: string;
}

/**
 * Lee los bytes de un avatar para servirlo. Es la **unica** funcion que
 * selecciona `imageData`. El llamador debe haber autorizado antes la
 * lectura: un `PARTICIPANT` solo puede ver la suya (`personId` de la
 * sesion); un `ADMIN` puede ver cualquiera.
 */
export async function readAvatarForViewer(
  db: Db,
  splitParticipantId: string,
  viewer: { isAdmin: boolean; personId: string | null },
): Promise<StoredAvatar | null> {
  const participation = await db.splitParticipant.findUnique({
    where: { id: splitParticipantId },
    select: { personId: true, avatar: { select: { imageData: true, mimeType: true, sha256: true } } },
  });
  if (!participation) return null;
  if (!viewer.isAdmin && participation.personId !== viewer.personId) return null;
  if (!participation.avatar) return null;

  return {
    data: Buffer.from(participation.avatar.imageData),
    mimeType: participation.avatar.mimeType,
    sha256: participation.avatar.sha256,
  };
}
