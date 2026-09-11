import { compare, hash } from "bcryptjs";
import type { PrismaClient, User } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/normalize";

/**
 * Ciclo de cuenta minimo (`0.6.0` / MVP-1C, ver docs/AUTHENTICATION.md). Las
 * contrasenas nunca se guardan en claro ni con cifrado reversible: solo su
 * hash (bcrypt, 12 rondas). Este servicio nunca imprime ni devuelve una
 * contrasena en claro.
 */

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS);
}

function assertPasswordStrength(password: string, field: string): void {
  if (password.trim().length < MIN_PASSWORD_LENGTH) {
    throw new DomainError(`La contrasena debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`, field);
  }
}

function isUniqueConstraintOn(error: unknown, target: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002" &&
    JSON.stringify((error as { meta?: unknown }).meta ?? "").toLowerCase().includes(target.toLowerCase())
  );
}

export interface CreateParticipantAccountInput {
  personId: string;
  email: string;
  temporaryPassword: string;
}

/** Crea una cuenta de participante vinculada uno a uno con una persona, con contrasena temporal que exige cambio en el primer acceso. */
export async function createParticipantAccount(db: PrismaClient, input: CreateParticipantAccountInput): Promise<User> {
  const person = await db.person.findUnique({ where: { id: input.personId } });
  if (!person) throw new DomainError("La persona indicada no existe.");

  assertPasswordStrength(input.temporaryPassword, "temporaryPassword");
  const email = normalizeEmail(input.email);
  if (email === "") throw new DomainError("El correo es obligatorio.", "email");

  const passwordHash = await hashPassword(input.temporaryPassword);

  try {
    return await db.user.create({
      data: { email, passwordHash, role: "PARTICIPANT", personId: input.personId, isActive: true, mustChangePassword: true },
    });
  } catch (error) {
    if (isUniqueConstraintOn(error, "email")) throw new DomainError("Ya existe una cuenta con ese correo.", "email");
    if (isUniqueConstraintOn(error, "personId")) throw new DomainError("Esta persona ya tiene una cuenta.", "personId");
    throw error;
  }
}

export async function setAccountActive(db: PrismaClient, userId: string, isActive: boolean): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { isActive } });
}

/** El administrador fija una contrasena temporal nueva; el participante debe volver a cambiarla en su siguiente acceso. */
export async function setTemporaryPassword(db: PrismaClient, userId: string, temporaryPassword: string): Promise<void> {
  assertPasswordStrength(temporaryPassword, "temporaryPassword");
  const passwordHash = await hashPassword(temporaryPassword);
  await db.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: true } });
}

/** Cambio de la propia contrasena (obligatorio en el primer acceso si `mustChangePassword` esta activo). */
export async function changeOwnPassword(db: PrismaClient, userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new DomainError("La cuenta no existe.");

  const currentValid = await compare(currentPassword, user.passwordHash);
  if (!currentValid) throw new DomainError("La contrasena actual no es correcta.", "currentPassword");

  assertPasswordStrength(newPassword, "newPassword");
  const passwordHash = await hashPassword(newPassword);
  await db.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } });
}

export interface PersonWithAccount {
  id: string;
  fullName: string;
  email: string | null;
  account: { id: string; email: string; isActive: boolean; mustChangePassword: boolean } | null;
}

/** Personas con su cuenta de participante (si tiene), para la pantalla administrativa de gestion de cuentas. */
export async function listPersonsWithAccount(db: PrismaClient): Promise<PersonWithAccount[]> {
  const persons = await db.person.findMany({
    orderBy: { fullName: "asc" },
    include: { user: { select: { id: true, email: true, isActive: true, mustChangePassword: true } } },
  });
  return persons.map((person) => ({
    id: person.id,
    fullName: person.fullName,
    email: person.email,
    account: person.user,
  }));
}

/**
 * Crea el primer administrador solo si no existe ya ningun usuario con rol
 * `ADMIN`. Usado por `scripts/create-first-admin.ts`; nunca registra la
 * contrasena en consola ni en logs.
 */
export async function ensureFirstAdmin(db: PrismaClient, email: string, password: string): Promise<{ created: boolean; email: string }> {
  const normalizedEmail = normalizeEmail(email);
  const existingAdmin = await db.user.findFirst({ where: { role: "ADMIN" } });
  if (existingAdmin) return { created: false, email: existingAdmin.email };

  assertPasswordStrength(password, "password");
  const passwordHash = await hashPassword(password);
  const admin = await db.user.create({
    data: { email: normalizedEmail, passwordHash, role: "ADMIN", isActive: true, mustChangePassword: true },
  });
  return { created: true, email: admin.email };
}
