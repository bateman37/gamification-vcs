import type { ParticipantLevel, Prisma, PrismaClient, SplitProfession } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import type { ProfessionFormInput } from "@/server/validation/profession";
import { isProfessionAvailableForLevel, type ApplicableProfession } from "@/domain/profession-bonus";

/**
 * Profesiones de un split (`0.8.0` / MVP-2B, ver
 * docs/PROFESSIONS_AND_PROFILES.md). CRUD administrativo, bloqueo desde la
 * primera publicacion y comprobaciones reutilizadas por la asignacion de
 * participantes, la ficha privada y la publicacion semanal.
 *
 * Regla de alcance: las profesiones son opcionales por split. Un split sin
 * ninguna profesion creada se comporta exactamente igual que en `0.7.0` (sin
 * requisitos, sin selectores y sin bonus).
 */

type Db = PrismaClient | Prisma.TransactionClient;

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

function normalizeProfessionName(name: string): string {
  return name.trim().toLowerCase();
}

export interface ProfessionWithCounts extends SplitProfession {
  participantCount: number;
}

export function toApplicableProfession(profession: SplitProfession): ApplicableProfession {
  return {
    id: profession.id,
    name: profession.name,
    kpiCodeA: profession.kpiCodeA,
    kpiCodeB: profession.kpiCodeB,
    availableN0: profession.availableN0,
    availableN1: profession.availableN1,
    availableN2: profession.availableN2,
  };
}

export async function listProfessionsForSplit(db: Db, splitId: string): Promise<ProfessionWithCounts[]> {
  const professions = await db.splitProfession.findMany({
    where: { splitId },
    include: { _count: { select: { participants: true } } },
    orderBy: { createdAt: "asc" },
  });
  return professions.map(({ _count, ...profession }) => ({ ...profession, participantCount: _count.participants }));
}

export async function countProfessionsForSplit(db: Db, splitId: string): Promise<number> {
  return db.splitProfession.count({ where: { splitId } });
}

/** `true` si el split ya tiene alguna profesion creada, es decir, si "usa profesiones". */
export async function splitUsesProfessions(db: Db, splitId: string): Promise<boolean> {
  return (await countProfessionsForSplit(db, splitId)) > 0;
}

/**
 * `true` desde que el split tiene al menos una publicacion. Es el punto de
 * cierre de las profesiones: ni definiciones ni asignaciones se pueden tocar
 * a partir de ahi (seccion 7 del encargo). Se comprueba siempre en servidor
 * con el mismo `db`/transaccion que va a escribir.
 */
export async function splitHasAnyPublication(db: Db, splitId: string): Promise<boolean> {
  const count = await db.weekPublication.count({ where: { splitWeek: { splitId } } });
  return count > 0;
}

async function getEditableSplitOrThrow(db: Db, splitId: string) {
  const split = await db.split.findUnique({ where: { id: splitId } });
  if (!split) throw new DomainError("El split indicado no existe.");
  if (split.status === "CLOSED") {
    throw new DomainError("No se pueden modificar las profesiones de un split cerrado.");
  }
  return split;
}

async function assertProfessionsAreEditable(db: Db, splitId: string): Promise<void> {
  await getEditableSplitOrThrow(db, splitId);
  if (await splitHasAnyPublication(db, splitId)) {
    throw new DomainError(
      "Las profesiones quedaron bloqueadas al publicar la primera semana del split: no se pueden crear, editar ni eliminar.",
    );
  }
}

export async function createProfession(db: PrismaClient, splitId: string, input: ProfessionFormInput): Promise<SplitProfession> {
  await assertProfessionsAreEditable(db, splitId);

  try {
    return await db.splitProfession.create({
      data: {
        splitId,
        name: input.name.trim(),
        nameNormalized: normalizeProfessionName(input.name),
        kpiCodeA: input.kpiCodeA,
        kpiCodeB: input.kpiCodeB,
        availableN0: input.availableN0,
        availableN1: input.availableN1,
        availableN2: input.availableN2,
      },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === UNIQUE_CONSTRAINT_ERROR_CODE) {
      throw new DomainError("Ya existe una profesion con ese nombre en este split.", "name");
    }
    throw error;
  }
}

export async function updateProfession(
  db: PrismaClient,
  splitId: string,
  professionId: string,
  input: ProfessionFormInput,
): Promise<SplitProfession> {
  await assertProfessionsAreEditable(db, splitId);
  const existing = await db.splitProfession.findUnique({ where: { id: professionId } });
  if (!existing || existing.splitId !== splitId) {
    throw new DomainError("La profesion indicada no existe en este split.");
  }

  // Una edicion de niveles nunca limpia asignaciones en silencio: si dejase invalida la profesion de
  // algun participante, se rechaza indicando exactamente a quien afectaria (seccion 3 del encargo).
  const assigned = await db.splitParticipant.findMany({ where: { professionId }, select: { alias: true, level: true } });
  const invalidated = assigned.filter((participant) => !isProfessionAvailableForLevel(input, participant.level));
  if (invalidated.length > 0) {
    const aliases = invalidated.map((participant) => `"${participant.alias}" (${participant.level})`).join(", ");
    throw new DomainError(
      `No se pueden quitar esos niveles: la profesion dejaria de ser valida para ${aliases}. Cambia primero su profesion o su nivel.`,
      "availableN0",
    );
  }

  try {
    return await db.splitProfession.update({
      where: { id: professionId },
      data: {
        name: input.name.trim(),
        nameNormalized: normalizeProfessionName(input.name),
        kpiCodeA: input.kpiCodeA,
        kpiCodeB: input.kpiCodeB,
        availableN0: input.availableN0,
        availableN1: input.availableN1,
        availableN2: input.availableN2,
      },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === UNIQUE_CONSTRAINT_ERROR_CODE) {
      throw new DomainError("Ya existe una profesion con ese nombre en este split.", "name");
    }
    throw error;
  }
}

export async function deleteProfession(db: PrismaClient, splitId: string, professionId: string): Promise<void> {
  await assertProfessionsAreEditable(db, splitId);
  const existing = await db.splitProfession.findUnique({
    where: { id: professionId },
    include: { _count: { select: { participants: true, publishedResults: true } } },
  });
  if (!existing || existing.splitId !== splitId) {
    throw new DomainError("La profesion indicada no existe en este split.");
  }
  if (existing._count.participants > 0) {
    throw new DomainError(
      "No se puede eliminar una profesion con participantes asignados. Cambia o retira primero esas asignaciones.",
    );
  }
  if (existing._count.publishedResults > 0) {
    // Defensivo: no deberia ocurrir si el split no tiene publicaciones, pero protege el borrado fisico igualmente.
    throw new DomainError("No se puede eliminar una profesion referenciada por una publicacion.");
  }

  await db.splitProfession.delete({ where: { id: professionId } });
}

export async function getProfessionById(db: Db, splitId: string, professionId: string): Promise<SplitProfession | null> {
  const profession = await db.splitProfession.findUnique({ where: { id: professionId } });
  if (!profession || profession.splitId !== splitId) return null;
  return profession;
}

/** Profesiones del split disponibles para un nivel tecnico concreto. */
export async function listProfessionsForLevel(db: Db, splitId: string, level: ParticipantLevel): Promise<SplitProfession[]> {
  const professions = await db.splitProfession.findMany({ where: { splitId }, orderBy: { name: "asc" } });
  return professions.filter((profession) => isProfessionAvailableForLevel(profession, level));
}

/**
 * Resuelve y valida la profesion enviada desde el cliente para una
 * participacion. Nunca se acepta una profesion de otro split ni una no
 * disponible para el nivel indicado.
 *
 * - Split sin profesiones: siempre `null` (y se rechaza cualquier id enviado).
 * - Split con profesiones y sin publicaciones: la profesion es opcional
 *   (el participante puede elegirla despues desde su ficha).
 * - Split con profesiones y ya publicado: es obligatoria en el propio alta,
 *   porque tanto el catalogo como las profesiones estan bloqueados.
 */
export async function resolveProfessionIdOrThrow(
  db: Db,
  splitId: string,
  professionId: string | undefined,
  level: ParticipantLevel,
  options: { requiredWhenAvailable: boolean },
): Promise<string | null> {
  if (professionId) {
    const profession = await db.splitProfession.findUnique({ where: { id: professionId } });
    if (!profession || profession.splitId !== splitId) {
      throw new DomainError("La profesion seleccionada no pertenece a este split.", "professionId");
    }
    if (!isProfessionAvailableForLevel(profession, level)) {
      throw new DomainError(
        `La profesion "${profession.name}" no esta disponible para el nivel ${level}.`,
        "professionId",
      );
    }
    return profession.id;
  }

  if (!(await splitUsesProfessions(db, splitId))) return null;

  if (options.requiredWhenAvailable) {
    throw new DomainError(
      "Selecciona una profesion: este split ya tiene una semana publicada, asi que la profesion es obligatoria desde el alta.",
      "professionId",
    );
  }
  return null;
}

export interface ProfessionAssignmentIssue {
  splitParticipantId: string;
  alias: string;
  message: string;
}

/**
 * Comprueba que todos los participantes indicados tienen una profesion
 * valida cuando el split usa profesiones (seccion 6 del encargo). Devuelve
 * la lista de problemas en vez de lanzar, para que la previsualizacion
 * pueda mostrarlos todos a la vez como `blockingIssues`.
 */
export function collectProfessionAssignmentIssues(
  usesProfessions: boolean,
  participants: readonly { id: string; alias: string; level: ParticipantLevel; profession: SplitProfession | null }[],
): ProfessionAssignmentIssue[] {
  if (!usesProfessions) return [];

  const issues: ProfessionAssignmentIssue[] = [];
  for (const participant of participants) {
    if (!participant.profession) {
      issues.push({
        splitParticipantId: participant.id,
        alias: participant.alias,
        message: `El participante "${participant.alias}" todavia no ha elegido profesion. Asignale una antes de publicar.`,
      });
      continue;
    }
    if (!isProfessionAvailableForLevel(participant.profession, participant.level)) {
      issues.push({
        splitParticipantId: participant.id,
        alias: participant.alias,
        message: `La profesion "${participant.profession.name}" de "${participant.alias}" no esta disponible para su nivel ${participant.level}. Corrigelo antes de publicar.`,
      });
      continue;
    }
    if (participant.profession.kpiCodeA === participant.profession.kpiCodeB) {
      issues.push({
        splitParticipantId: participant.id,
        alias: participant.alias,
        message: `La profesion "${participant.profession.name}" no tiene dos KPI distintos configurados. Corrigela antes de publicar.`,
      });
    }
  }
  return issues;
}
