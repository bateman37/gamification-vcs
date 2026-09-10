import type { Person, Prisma, PrismaClient } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/normalize";
import { type CreatePersonInput, type UpdatePersonInput } from "@/server/validation/person";

type Db = PrismaClient | Prisma.TransactionClient;

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

function isUniqueConstraintError(error: unknown, target: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === UNIQUE_CONSTRAINT_ERROR_CODE &&
    JSON.stringify((error as { meta?: unknown }).meta ?? "").includes(target)
  );
}

export async function createPerson(db: Db, input: CreatePersonInput): Promise<Person> {
  const email = input.email ? normalizeEmail(input.email) : undefined;
  try {
    return await db.person.create({
      data: {
        fullName: input.fullName.trim(),
        email: email ?? null,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error, "email")) {
      throw new DomainError("Ya existe una persona con ese correo electronico.", "email");
    }
    throw error;
  }
}

export async function updatePerson(db: Db, personId: string, input: UpdatePersonInput): Promise<Person> {
  const email = input.email ? normalizeEmail(input.email) : undefined;
  const existing = await db.person.findUnique({ where: { id: personId } });
  if (!existing) {
    throw new DomainError("La persona indicada no existe.");
  }
  try {
    return await db.person.update({
      where: { id: personId },
      data: {
        fullName: input.fullName.trim(),
        email: email ?? null,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error, "email")) {
      throw new DomainError("Ya existe una persona con ese correo electronico.", "email");
    }
    throw error;
  }
}

export interface PersonWithParticipationCount extends Person {
  participationCount: number;
}

export async function listPersonsWithParticipationCount(
  db: PrismaClient,
): Promise<PersonWithParticipationCount[]> {
  const people = await db.person.findMany({
    orderBy: { fullName: "asc" },
    include: { _count: { select: { participations: true } } },
  });
  return people.map(({ _count, ...person }) => ({
    ...person,
    participationCount: _count.participations,
  }));
}

export async function getPersonById(db: Db, personId: string): Promise<Person | null> {
  return db.person.findUnique({ where: { id: personId } });
}

export async function listAllPersons(db: PrismaClient): Promise<Person[]> {
  return db.person.findMany({ orderBy: { fullName: "asc" } });
}
