import type { Person, Prisma, PrismaClient, SplitParticipant } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { normalizeAlias } from "@/lib/normalize";
import type { AddParticipantInput, UpdateParticipantInput } from "@/server/validation/participant";

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
    throw new DomainError("No se pueden anadir participantes a un split cerrado.");
  }
  if (input.startWeekSequenceNumber > split.numberOfWeeks) {
    throw new DomainError(
      `La semana inicial debe pertenecer al split (entre 1 y ${split.numberOfWeeks}).`,
      "startWeekSequenceNumber",
    );
  }

  const aliasNormalized = normalizeAlias(input.alias);

  try {
    return await db.splitParticipant.create({
      data: {
        splitId,
        personId: input.personId,
        alias: input.alias.trim(),
        aliasNormalized,
        level: input.level,
        startWeekSequenceNumber: input.startWeekSequenceNumber,
      },
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

export async function updateParticipant(
  db: PrismaClient,
  participantId: string,
  input: UpdateParticipantInput,
): Promise<SplitParticipant> {
  const existing = await db.splitParticipant.findUnique({ where: { id: participantId } });
  if (!existing) {
    throw new DomainError("El participante indicado no existe.");
  }
  const aliasNormalized = normalizeAlias(input.alias);

  try {
    return await db.splitParticipant.update({
      where: { id: participantId },
      data: {
        alias: input.alias.trim(),
        aliasNormalized,
        level: input.level,
      },
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

export async function listParticipantsForSplit(db: Db, splitId: string): Promise<ParticipantWithPerson[]> {
  return db.splitParticipant.findMany({
    where: { splitId },
    include: { person: true },
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
    where: {
      splitId,
      startWeekSequenceNumber: { lte: weekSequenceNumber },
      OR: [{ endWeekSequenceNumber: null }, { endWeekSequenceNumber: { gte: weekSequenceNumber } }],
    },
    include: { person: true },
    orderBy: { alias: "asc" },
  });
}
