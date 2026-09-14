import { randomUUID } from "node:crypto";
import type { Person, Prisma, PrismaClient, SplitParticipant, SplitProfession } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { normalizeAlias } from "@/lib/normalize";
import type { AddParticipantInput, UpdateParticipantInput } from "@/server/validation/participant";
import {
  resolveProfessionIdOrThrow,
  splitHasAnyPublication,
  splitUsesProfessions,
} from "@/server/services/profession.service";
import { isProfessionAvailableForLevel } from "@/domain/profession-bonus";
import { PROFESSION_BONUS_PERCENT } from "@/domain/profession-bonus";
import { createNewsWithDeliveries } from "@/server/services/news.service";
import { buildNewsActionPath } from "@/domain/news-links";
import { participantAddedNewsTemplate, factionReassignedNewsTemplate, professionAssignedNewsTemplate } from "@/domain/news-templates";
import { KPI_CATALOG } from "@/domain/kpis/catalog";
import { ensurePositionPointRuleCoverage, resolveRequiredPositionCountForSplit } from "@/server/services/position-points.service";

type Db = PrismaClient | Prisma.TransactionClient;

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";
const FOREIGN_KEY_CONSTRAINT_ERROR_CODE = "P2003";

function prismaErrorTargetIncludes(error: unknown, code: string, target: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === code &&
    JSON.stringify((error as { meta?: unknown }).meta ?? "").toLowerCase().includes(target.toLowerCase())
  );
}

/**
 * Comprueba la faccion enviada desde el cliente: obligatoria en cuanto el
 * split ya tiene alguna faccion creada (ver docs/FACTIONS.md), y siempre
 * perteneciente al mismo split (nunca se acepta una faccion de otro
 * split). Devuelve `null` cuando el split todavia no usa facciones.
 */
async function resolveFactionIdOrThrow(db: Db, splitId: string, factionId: string | undefined): Promise<string | null> {
  // Un factionId enviado desde el cliente se valida siempre, incluso si este split concreto todavia no tiene
  // ninguna faccion propia: nunca se acepta una faccion perteneciente a otro split.
  if (factionId) {
    const faction = await db.splitFaction.findUnique({ where: { id: factionId } });
    if (!faction || faction.splitId !== splitId) {
      throw new DomainError("La faccion seleccionada no pertenece a este split.", "factionId");
    }
    return faction.id;
  }

  const factionCount = await db.splitFaction.count({ where: { splitId } });
  if (factionCount === 0) return null;
  throw new DomainError("Selecciona una faccion: este split ya tiene facciones configuradas.", "factionId");
}

export async function addParticipant(
  db: PrismaClient,
  splitId: string,
  input: AddParticipantInput,
): Promise<SplitParticipant> {
  const split = await db.split.findUnique({ where: { id: splitId } });
  if (!split) {
    throw new DomainError("El split indicado no existe.");
  }
  if (split.status === "CLOSED") {
    throw new DomainError("No se pueden añadir participantes a un split cerrado.");
  }
  if (input.startWeekSequenceNumber > split.numberOfWeeks) {
    throw new DomainError(
      `La semana inicial debe pertenecer al split (entre 1 y ${split.numberOfWeeks}).`,
      "startWeekSequenceNumber",
    );
  }

  const startWeek = await db.splitWeek.findUnique({
    where: { splitId_sequenceNumber: { splitId, sequenceNumber: input.startWeekSequenceNumber } },
    include: { publication: true },
  });
  if (startWeek?.publication) {
    throw new DomainError(
      "No se puede añadir un participante con semana inicial en una semana ya publicada. Elige una semana futura no publicada.",
      "startWeekSequenceNumber",
    );
  }

  const factionId = await resolveFactionIdOrThrow(db, splitId, input.factionId);
  // Un alta posterior a la primera publicacion exige profesion en el propio formulario: el catalogo
  // y las profesiones ya estan bloqueados, asi que no podria elegirla despues (ver docs/PROFESSIONS_AND_PROFILES.md).
  const professionId = await resolveProfessionIdOrThrow(db, splitId, input.professionId, input.level, {
    requiredWhenAvailable: await splitHasAnyPublication(db, splitId),
  });
  const aliasNormalized = normalizeAlias(input.alias);
  const splitUsesProf = await splitUsesProfessions(db, splitId);
  const faction = factionId ? await db.splitFaction.findUnique({ where: { id: factionId } }) : null;

  try {
    return await db.$transaction(async (tx) => {
      const participant = await tx.splitParticipant.create({
        data: {
          splitId,
          personId: input.personId,
          alias: input.alias.trim(),
          aliasNormalized,
          level: input.level,
          startWeekSequenceNumber: input.startWeekSequenceNumber,
          factionId,
          professionId,
        },
      });

      // Ampliacion automatica de cobertura de puntos por posicion (`1.2.2`, seccion 6.2 del encargo):
      // mantenimiento de integridad, no una edicion manual, asi que se aplica aunque la configuracion
      // ya este bloqueada por la primera publicacion. Solo crea con `0` las posiciones que faltan.
      const requiredPositionCount = await resolveRequiredPositionCountForSplit(tx, splitId);
      await ensurePositionPointRuleCoverage(tx, splitId, requiredPositionCount);

      // Alta de participante (seccion 30 del encargo): siempre exactamente una noticia para la
      // persona anadida, tenga ya cuenta o no (se entrega a `Person`, ver docs/NEWS_CENTER.md).
      const { title, body } = participantAddedNewsTemplate({
        splitName: split.name,
        factionName: faction?.name ?? null,
        needsAvatar: true,
        needsProfession: splitUsesProf && !professionId,
      });
      await createNewsWithDeliveries(
        tx,
        {
          splitId,
          splitNameSnapshot: split.name,
          origin: "AUTOMATIC",
          category: "PROFILE",
          title,
          body,
          eventKey: `participant-added:${participant.id}`,
        },
        [{ personId: participant.personId, actionPath: buildNewsActionPath({ kind: "PROFILE", splitParticipantId: participant.id }, "PERSON") }],
      );

      return participant;
    });
  } catch (error) {
    if (prismaErrorTargetIncludes(error, UNIQUE_CONSTRAINT_ERROR_CODE, "personId")) {
      throw new DomainError("Esta persona ya participa en este split.", "personId");
    }
    if (prismaErrorTargetIncludes(error, UNIQUE_CONSTRAINT_ERROR_CODE, "aliasNormalized")) {
      throw new DomainError("Ya existe un participante con ese alias en este split.", "alias");
    }
    if (prismaErrorTargetIncludes(error, FOREIGN_KEY_CONSTRAINT_ERROR_CODE, "startWeekSequenceNumber")) {
      throw new DomainError(
        `La semana inicial debe pertenecer al split (entre 1 y ${split.numberOfWeeks}).`,
        "startWeekSequenceNumber",
      );
    }
    throw error;
  }
}

/**
 * Decide la profesion resultante de una edicion administrativa de
 * participante (ver docs/PROFESSIONS_AND_PROFILES.md, secciones 5 y 7):
 *
 * - Antes de la primera publicacion del split: se puede escoger, cambiar o
 *   dejar vacia, siempre validando split y nivel.
 * - Desde la primera publicacion: la profesion queda congelada. Un intento
 *   de cambiarla (o de vaciarla) se rechaza en servidor, aunque llegue
 *   directamente a la Server Action con un id manipulado. Un cambio de nivel
 *   incompatible con la profesion congelada tambien se rechaza, sin
 *   eliminarla ni cambiarla automaticamente.
 */
async function resolveProfessionIdForUpdate(
  db: Db,
  existing: SplitParticipant & { profession: SplitProfession | null },
  input: UpdateParticipantInput,
): Promise<string | null> {
  const locked = await splitHasAnyPublication(db, existing.splitId);

  if (!locked) {
    return resolveProfessionIdOrThrow(db, existing.splitId, input.professionId, input.level, {
      requiredWhenAvailable: false,
    });
  }

  const requestedProfessionId = input.professionId ?? null;
  if (requestedProfessionId !== (existing.professionId ?? null)) {
    throw new DomainError(
      "La profesion quedo bloqueada al publicar la primera semana del split: ya no se puede cambiar.",
      "professionId",
    );
  }
  if (existing.profession && !isProfessionAvailableForLevel(existing.profession, input.level)) {
    throw new DomainError(
      `No se puede cambiar el nivel a ${input.level}: la profesion congelada "${existing.profession.name}" no esta disponible para ese nivel.`,
      "level",
    );
  }
  if (!existing.professionId && (await splitUsesProfessions(db, existing.splitId))) {
    // Defensivo: un participante sin profesion en un split con profesiones ya publicado no deberia
    // existir (la publicacion lo bloquea), y tampoco puede resolverse desde aqui.
    throw new DomainError(
      "Este participante no tiene profesion y el split ya esta publicado: las profesiones estan bloqueadas.",
      "professionId",
    );
  }
  return existing.professionId ?? null;
}

export async function updateParticipant(
  db: PrismaClient,
  participantId: string,
  input: UpdateParticipantInput,
): Promise<SplitParticipant> {
  const existing = await db.splitParticipant.findUnique({ where: { id: participantId }, include: { profession: true } });
  if (!existing) {
    throw new DomainError("El participante indicado no existe.");
  }
  const split = await db.split.findUnique({ where: { id: existing.splitId } });
  if (!split) {
    throw new DomainError("El split indicado no existe.");
  }
  const factionId = await resolveFactionIdOrThrow(db, existing.splitId, input.factionId ?? existing.factionId ?? undefined);
  const professionId = await resolveProfessionIdForUpdate(db, existing, input);
  const aliasNormalized = normalizeAlias(input.alias);

  // Solo se notifican cambios reales durante un split activo (seccion 30/37 del encargo): las
  // tareas de preparacion en `DRAFT` nunca generan noticias de jugador.
  const factionChanged = split.status === "ACTIVE" && factionId !== (existing.factionId ?? null) && factionId !== null;
  const professionChanged =
    split.status === "ACTIVE" && professionId !== (existing.professionId ?? null) && professionId !== null;
  const newFaction = factionChanged && factionId ? await db.splitFaction.findUnique({ where: { id: factionId } }) : null;
  const newProfession = professionChanged && professionId ? await db.splitProfession.findUnique({ where: { id: professionId } }) : null;
  // Identificador de operacion unico, generado una sola vez fuera de la transaccion (seccion 47 del
  // encargo): un reasignar/cambiar es un evento repetible, asi que la clave idempotente no puede ser
  // solo el id del participante.
  const operationId = randomUUID();

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.splitParticipant.update({
        where: { id: participantId },
        data: {
          alias: input.alias.trim(),
          aliasNormalized,
          level: input.level,
          factionId,
          professionId,
        },
      });

      if (newFaction) {
        const { title, body } = factionReassignedNewsTemplate({ factionName: newFaction.name });
        await createNewsWithDeliveries(
          tx,
          {
            splitId: existing.splitId,
            splitNameSnapshot: split.name,
            origin: "AUTOMATIC",
            category: "FACTION",
            title,
            body,
            eventKey: `faction-reassigned:${operationId}`,
          },
          [{ personId: existing.personId, actionPath: buildNewsActionPath({ kind: "PROFILE", splitParticipantId: participantId }, "PERSON") }],
        );
      }

      if (newProfession) {
        const { title, body } = professionAssignedNewsTemplate({
          professionName: newProfession.name,
          kpiNameA: KPI_CATALOG[newProfession.kpiCodeA].name,
          kpiNameB: KPI_CATALOG[newProfession.kpiCodeB].name,
          bonusPercent: PROFESSION_BONUS_PERCENT,
        });
        await createNewsWithDeliveries(
          tx,
          {
            splitId: existing.splitId,
            splitNameSnapshot: split.name,
            origin: "AUTOMATIC",
            category: "PROFESSION",
            title,
            body,
            eventKey: `profession-assigned:${operationId}`,
          },
          [{ personId: existing.personId, actionPath: buildNewsActionPath({ kind: "PROFILE", splitParticipantId: participantId }, "PERSON") }],
        );
      }

      return updated;
    });
  } catch (error) {
    if (prismaErrorTargetIncludes(error, UNIQUE_CONSTRAINT_ERROR_CODE, "aliasNormalized")) {
      throw new DomainError("Ya existe un participante con ese alias en este split.", "alias");
    }
    throw error;
  }
}

export interface ParticipantWithPerson extends SplitParticipant {
  person: Person;
}

export interface ParticipantWithPersonAndFaction extends ParticipantWithPerson {
  faction: { name: string; color: string } | null;
  /** Profesion actual del participante (`0.8.0` / MVP-2B). `null` si el split no usa profesiones o todavia no ha elegido. */
  profession: SplitProfession | null;
}

/** Participante con su profesion cargada, para el motor agregado semanal (evita N+1). */
export interface ParticipantWithPersonAndProfession extends ParticipantWithPerson {
  profession: SplitProfession | null;
}

/**
 * Numero total de personas que participan en el split (`0.7.0` / MVP-2A,
 * seccion 17 del encargo). Denominador unico de todos los "x de n" de
 * resultados de un split: nunca el numero de resultados aplicables de un
 * KPI concreto (`rankedParticipantCount`, que sigue siendo el numerador de
 * cada ranking, sin cambiar su formula).
 */
export async function countParticipantsForSplit(db: Db, splitId: string): Promise<number> {
  return db.splitParticipant.count({ where: { splitId } });
}

export async function listParticipantsForSplit(db: Db, splitId: string): Promise<ParticipantWithPersonAndFaction[]> {
  // Nunca se selecciona `avatar`: los bytes de la imagen no deben cargarse en un listado (ver seccion 31 del encargo).
  return db.splitParticipant.findMany({
    where: { splitId },
    include: { person: true, faction: { select: { name: true, color: true } }, profession: true },
    orderBy: { startWeekSequenceNumber: "asc" },
  });
}

/**
 * Participantes cuya vigencia incluye una semana concreta del split, segun
 * `startWeekSequenceNumber` y `endWeekSequenceNumber` (ver
 * docs/IMPORT_PRODUCTIVITY.md). `endWeekSequenceNumber` todavia no se usa
 * en ningun flujo, pero la consulta ya lo respeta si algun dia se informa.
 */
export async function listApplicableParticipantsForWeek(
  db: Db,
  splitId: string,
  weekSequenceNumber: number,
): Promise<ParticipantWithPerson[]> {
  return db.splitParticipant.findMany({
    where: applicableParticipantsWhere(splitId, weekSequenceNumber),
    include: { person: true },
    orderBy: { alias: "asc" },
  });
}

function applicableParticipantsWhere(splitId: string, weekSequenceNumber: number) {
  return {
    splitId,
    startWeekSequenceNumber: { lte: weekSequenceNumber },
    OR: [{ endWeekSequenceNumber: null }, { endWeekSequenceNumber: { gte: weekSequenceNumber } }],
  };
}

/**
 * Igual que `listApplicableParticipantsForWeek`, pero cargando tambien la
 * profesion de cada participante en la misma consulta (`0.8.0` / MVP-2B).
 * La usa el motor agregado semanal, que necesita la profesion para aplicar
 * el bonus sin una consulta por participante ni por KPI.
 */
export async function listApplicableParticipantsWithProfessionForWeek(
  db: Db,
  splitId: string,
  weekSequenceNumber: number,
): Promise<ParticipantWithPersonAndProfession[]> {
  return db.splitParticipant.findMany({
    where: applicableParticipantsWhere(splitId, weekSequenceNumber),
    include: { person: true, profession: true },
    orderBy: { alias: "asc" },
  });
}
