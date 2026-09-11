import type { Prisma, PrismaClient, SplitFaction, SplitParticipant } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import type { FactionFormInput } from "@/server/validation/faction";
import { selectFactionTopThree, rankFactions, type FactionMemberScore, type FactionTopThree } from "@/domain/faction-ranking";

/**
 * Facciones de un split (`0.7.0` / MVP-2A, ver docs/FACTIONS.md). CRUD y
 * comprobaciones de completitud reutilizadas por la activacion del split y
 * por la publicacion semanal. No existe un segundo "renombre": el aporte de
 * cada participante a su faccion es siempre su `positionPoints` publicado.
 */

type Db = PrismaClient | Prisma.TransactionClient;

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

function normalizeFactionName(name: string): string {
  return name.trim().toLowerCase();
}

export interface FactionWithCounts extends SplitFaction {
  participantCount: number;
}

export async function listFactionsForSplit(db: Db, splitId: string): Promise<FactionWithCounts[]> {
  const factions = await db.splitFaction.findMany({
    where: { splitId },
    include: { _count: { select: { participants: true } } },
    orderBy: { createdAt: "asc" },
  });
  return factions.map(({ _count, ...faction }) => ({ ...faction, participantCount: _count.participants }));
}

export async function countFactionsForSplit(db: Db, splitId: string): Promise<number> {
  return db.splitFaction.count({ where: { splitId } });
}

/** `true` una vez que el split tiene al menos una publicacion (bloquea crear/eliminar facciones, ver seccion 3 de docs/FACTIONS.md). */
async function splitHasAnyPublication(db: Db, splitId: string): Promise<boolean> {
  const count = await db.weekPublication.count({ where: { splitWeek: { splitId } } });
  return count > 0;
}

async function getEditableSplitOrThrow(db: Db, splitId: string) {
  const split = await db.split.findUnique({ where: { id: splitId } });
  if (!split) throw new DomainError("El split indicado no existe.");
  if (split.status === "CLOSED") {
    throw new DomainError("No se pueden modificar las facciones de un split cerrado.");
  }
  return split;
}

export async function createFaction(db: PrismaClient, splitId: string, input: FactionFormInput): Promise<SplitFaction> {
  await getEditableSplitOrThrow(db, splitId);
  if (await splitHasAnyPublication(db, splitId)) {
    throw new DomainError("No se pueden crear facciones despues de la primera publicacion del split.");
  }

  try {
    return await db.splitFaction.create({
      data: {
        splitId,
        name: input.name.trim(),
        nameNormalized: normalizeFactionName(input.name),
        color: input.color.trim(),
      },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === UNIQUE_CONSTRAINT_ERROR_CODE) {
      throw new DomainError("Ya existe una faccion con ese nombre en este split.", "name");
    }
    throw error;
  }
}

export async function updateFaction(
  db: PrismaClient,
  splitId: string,
  factionId: string,
  input: FactionFormInput,
): Promise<SplitFaction> {
  await getEditableSplitOrThrow(db, splitId);
  const existing = await db.splitFaction.findUnique({ where: { id: factionId } });
  if (!existing || existing.splitId !== splitId) {
    throw new DomainError("La faccion indicada no existe en este split.");
  }

  try {
    return await db.splitFaction.update({
      where: { id: factionId },
      data: { name: input.name.trim(), nameNormalized: normalizeFactionName(input.name), color: input.color.trim() },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === UNIQUE_CONSTRAINT_ERROR_CODE) {
      throw new DomainError("Ya existe una faccion con ese nombre en este split.", "name");
    }
    throw error;
  }
}

export async function deleteFaction(db: PrismaClient, splitId: string, factionId: string): Promise<void> {
  await getEditableSplitOrThrow(db, splitId);
  const existing = await db.splitFaction.findUnique({
    where: { id: factionId },
    include: { _count: { select: { participants: true, publishedResults: true } } },
  });
  if (!existing || existing.splitId !== splitId) {
    throw new DomainError("La faccion indicada no existe en este split.");
  }
  if (await splitHasAnyPublication(db, splitId)) {
    throw new DomainError("No se pueden eliminar facciones despues de la primera publicacion del split.");
  }
  if (existing._count.participants > 0) {
    throw new DomainError("No se puede eliminar una faccion con participantes asignados. Reasignalos primero.");
  }
  if (existing._count.publishedResults > 0) {
    // Defensivo: no deberia ocurrir si no hay publicaciones para el split, pero protege igualmente el borrado fisico.
    throw new DomainError("No se puede eliminar una faccion referenciada por una publicacion.");
  }

  await db.splitFaction.delete({ where: { id: factionId } });
}

function isApplicableToWeek(participant: Pick<SplitParticipant, "startWeekSequenceNumber" | "endWeekSequenceNumber">, weekSequenceNumber: number): boolean {
  if (participant.startWeekSequenceNumber > weekSequenceNumber) return false;
  if (participant.endWeekSequenceNumber !== null && participant.endWeekSequenceNumber < weekSequenceNumber) return false;
  return true;
}

/**
 * Comprueba que el split esta listo para activarse en lo que respecta a
 * facciones (seccion 4 de docs/FACTIONS.md). Si el split todavia no tiene
 * ninguna faccion creada, no exige nada (comportamiento identico al
 * anterior a `0.7.0`, ver docs/DECISIONS.md). Si ya tiene alguna, exige
 * al menos dos, todos los participantes asignados, y cada faccion con al
 * menos tres participantes aplicables desde la primera semana del split.
 */
export async function assertFactionsReadyToActivate(db: Db, splitId: string): Promise<void> {
  const factions = await db.splitFaction.findMany({ where: { splitId } });
  if (factions.length === 0) return;

  if (factions.length < 2) {
    throw new DomainError("El split necesita al menos dos facciones configuradas para poder activarse.");
  }

  const participants = await db.splitParticipant.findMany({ where: { splitId } });
  const unassigned = participants.find((participant) => !participant.factionId);
  if (unassigned) {
    throw new DomainError(`El participante "${unassigned.alias}" todavia no tiene una faccion asignada.`);
  }

  const countByFaction = new Map<string, number>();
  for (const faction of factions) countByFaction.set(faction.id, 0);
  for (const participant of participants) {
    if (participant.factionId && isApplicableToWeek(participant, 1)) {
      countByFaction.set(participant.factionId, (countByFaction.get(participant.factionId) ?? 0) + 1);
    }
  }

  for (const faction of factions) {
    const count = countByFaction.get(faction.id) ?? 0;
    if (count < 3) {
      throw new DomainError(
        `La faccion "${faction.name}" necesita al menos tres participantes aplicables desde la primera semana (tiene ${count}).`,
      );
    }
  }
}

export async function getFactionById(db: Db, splitId: string, factionId: string): Promise<SplitFaction | null> {
  const faction = await db.splitFaction.findUnique({ where: { id: factionId } });
  if (!faction || faction.splitId !== splitId) return null;
  return faction;
}

export interface FactionWeeklyPreviewEntry {
  factionId: string;
  name: string;
  color: string;
  weeklyRank: number;
  weeklyScore: number;
  topContributors: FactionMemberScore[];
}

export interface FactionWeeklyPreview {
  /** `false` si el split no usa facciones: el resto de campos quedan vacios. */
  hasFactions: boolean;
  /** Bloquea la publicacion (faltan asignaciones o una faccion con menos de tres aplicables esta semana). */
  blockingIssues: string[];
  /** Solo facciones con al menos un participante aplicable esta semana, ordenadas por posicion. */
  factions: FactionWeeklyPreviewEntry[];
}

export interface WeeklyMemberForFactionPreview {
  splitParticipantId: string;
  alias: string;
  /** `null` cuando todavia no tiene puntos por posicion asignados (otro blockingIssue ya lo reporta). */
  positionPoints: number | null;
  factionId: string | null;
}

/**
 * Construye la previsualizacion/instantanea de facciones de una semana
 * (seccion 6 de docs/FACTIONS.md): selecciona el top 3 de cada faccion y
 * suma sus `positionPoints`, sin calcular ninguna media. Reutilizada tanto
 * por la previsualizacion en vivo como por la publicacion (que llama a esta
 * misma funcion dentro de su propia transaccion).
 */
export async function buildFactionWeeklyPreview(
  db: Db,
  splitId: string,
  members: readonly WeeklyMemberForFactionPreview[],
): Promise<FactionWeeklyPreview> {
  const factions = await db.splitFaction.findMany({ where: { splitId } });
  if (factions.length === 0) return { hasFactions: false, blockingIssues: [], factions: [] };

  const blockingIssues: string[] = [];
  const membersByFaction = new Map<string, FactionMemberScore[]>();
  for (const faction of factions) membersByFaction.set(faction.id, []);

  for (const member of members) {
    if (!member.factionId) {
      blockingIssues.push(`El participante "${member.alias}" no tiene faccion asignada. Asignale una antes de publicar.`);
      continue;
    }
    if (member.positionPoints === null) continue;
    const list = membersByFaction.get(member.factionId);
    if (!list) continue;
    list.push({ splitParticipantId: member.splitParticipantId, alias: member.alias, positionPoints: member.positionPoints });
  }

  interface WorkingFactionEntry {
    factionId: string;
    name: string;
    color: string;
    top: FactionTopThree;
  }

  const workingEntries: WorkingFactionEntry[] = [];
  for (const faction of factions) {
    const membersOfFaction = membersByFaction.get(faction.id) ?? [];
    if (membersOfFaction.length === 0) continue;

    const top = selectFactionTopThree(membersOfFaction);
    if (!top) {
      blockingIssues.push(
        `La faccion "${faction.name}" tiene ${membersOfFaction.length} participante(s) aplicable(s) esta semana; se necesitan al menos 3 para publicar.`,
      );
      continue;
    }
    workingEntries.push({ factionId: faction.id, name: faction.name, color: faction.color, top });
  }

  const ranked = rankFactions(
    workingEntries.map((entry) => ({
      factionId: entry.factionId,
      factionName: entry.name,
      score: entry.top.weeklyScore,
      contributionVector: entry.top.topContributors.map((contributor) => contributor.positionPoints),
    })),
  );

  const entryById = new Map(workingEntries.map((entry) => [entry.factionId, entry]));
  const factionsOut: FactionWeeklyPreviewEntry[] = ranked
    .map(({ item, rank }) => {
      const entry = entryById.get(item.factionId)!;
      return {
        factionId: entry.factionId,
        name: entry.name,
        color: entry.color,
        weeklyRank: rank,
        weeklyScore: entry.top.weeklyScore,
        topContributors: entry.top.topContributors,
      };
    })
    .sort((a, b) => a.weeklyRank - b.weeklyRank);

  return { hasFactions: true, blockingIssues, factions: factionsOut };
}
