import type { Prisma, PrismaClient, Split, SplitWeek } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { generateSplitWeeks, parseCalendarDate } from "@/lib/dates";
import type { CreateSplitInput, UpdateSplitDraftInput } from "@/server/validation/split";
import { countActiveKpiConfigs, createDefaultKpiConfigs } from "@/server/services/kpi.service";
import { createDefaultPositionPointRules } from "@/server/services/position-points.service";
import { assertFactionsReadyToActivate } from "@/server/services/faction.service";

type Db = PrismaClient | Prisma.TransactionClient;

function buildWeeksOrThrow(startDate: Date, numberOfWeeks: number) {
  try {
    return generateSplitWeeks(startDate, numberOfWeeks);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Datos de semanas invalidos.";
    throw new DomainError(message, "startDate");
  }
}

export async function createSplitWithWeeks(db: PrismaClient, input: CreateSplitInput): Promise<Split> {
  const startDate = parseCalendarDate(input.startDate);
  const weeks = buildWeeksOrThrow(startDate, input.numberOfWeeks);

  return db.$transaction(async (tx) => {
    const split = await tx.split.create({
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        startDate,
        numberOfWeeks: input.numberOfWeeks,
      },
    });

    await tx.splitWeek.createMany({
      data: weeks.map((week) => ({
        splitId: split.id,
        sequenceNumber: week.sequenceNumber,
        startDate: week.startDate,
        endDate: week.endDate,
      })),
    });

    await createDefaultKpiConfigs(tx, split.id);
    await createDefaultPositionPointRules(tx, split.id);

    return split;
  });
}

export async function getSplitById(db: Db, splitId: string): Promise<Split | null> {
  return db.split.findUnique({ where: { id: splitId } });
}

export interface SplitWithCounts extends Split {
  participantCount: number;
}

export async function listSplitsWithParticipantCount(db: PrismaClient): Promise<SplitWithCounts[]> {
  const splits = await db.split.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { participants: true } } },
  });
  return splits.map(({ _count, ...split }) => ({ ...split, participantCount: _count.participants }));
}

export async function listSplitWeeks(db: Db, splitId: string): Promise<SplitWeek[]> {
  return db.splitWeek.findMany({ where: { splitId }, orderBy: { sequenceNumber: "asc" } });
}

/**
 * Busca una semana comprobando que pertenece al split indicado. Devuelve
 * `null` tanto si la semana no existe como si pertenece a otro split: la
 * pantalla de cargas de KPI nunca debe deducir ni aceptar una semana sin
 * validar esta relacion en servidor.
 */
export async function getSplitWeek(db: Db, splitId: string, weekId: string): Promise<SplitWeek | null> {
  const week = await db.splitWeek.findUnique({ where: { id: weekId } });
  if (!week || week.splitId !== splitId) return null;
  return week;
}

/**
 * Actualiza un split que todavia esta en borrador: nombre, descripcion,
 * fecha de inicio y numero de semanas. Si la fecha o la duracion cambian,
 * las semanas se recalculan de la forma mas sencilla posible: las semanas
 * que siguen existiendo se actualizan con sus nuevas fechas, y solo se
 * crean o eliminan semanas en los extremos. No se permite reducir el
 * numero de semanas por debajo de la semana inicial de algun participante
 * ya incorporado, para no dejar datos inconsistentes.
 */
export async function updateSplitDraft(
  db: PrismaClient,
  splitId: string,
  input: UpdateSplitDraftInput,
): Promise<Split> {
  const split = await db.split.findUnique({ where: { id: splitId } });
  if (!split) {
    throw new DomainError("El split indicado no existe.");
  }
  if (split.status !== "DRAFT") {
    throw new DomainError("Solo se puede editar un split mientras esta en borrador.");
  }

  const startDate = parseCalendarDate(input.startDate);
  const weeks = buildWeeksOrThrow(startDate, input.numberOfWeeks);

  return db.$transaction(async (tx) => {
    if (input.numberOfWeeks < split.numberOfWeeks) {
      const outOfRangeParticipant = await tx.splitParticipant.findFirst({
        where: { splitId, startWeekSequenceNumber: { gt: input.numberOfWeeks } },
      });
      if (outOfRangeParticipant) {
        throw new DomainError(
          `No se puede reducir el split a ${input.numberOfWeeks} semanas: hay un participante cuya semana inicial es posterior.`,
          "numberOfWeeks",
        );
      }
      await tx.splitWeek.deleteMany({
        where: { splitId, sequenceNumber: { gt: input.numberOfWeeks } },
      });
    }

    for (const week of weeks) {
      await tx.splitWeek.upsert({
        where: { splitId_sequenceNumber: { splitId, sequenceNumber: week.sequenceNumber } },
        create: {
          splitId,
          sequenceNumber: week.sequenceNumber,
          startDate: week.startDate,
          endDate: week.endDate,
        },
        update: {
          startDate: week.startDate,
          endDate: week.endDate,
        },
      });
    }

    return tx.split.update({
      where: { id: splitId },
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        startDate,
        numberOfWeeks: input.numberOfWeeks,
      },
    });
  });
}

export async function activateSplit(db: PrismaClient, splitId: string): Promise<Split> {
  const split = await db.split.findUnique({
    where: { id: splitId },
    include: { _count: { select: { participants: true } } },
  });
  if (!split) {
    throw new DomainError("El split indicado no existe.");
  }
  if (split.status !== "DRAFT") {
    throw new DomainError("Solo se puede activar un split que este en borrador.");
  }
  if (split._count.participants < 1) {
    throw new DomainError("El split necesita al menos un participante para poder activarse.");
  }
  const activeKpiCount = await countActiveKpiConfigs(db, splitId);
  if (activeKpiCount < 1) {
    throw new DomainError("El split necesita al menos un KPI activo para poder activarse.");
  }
  await assertFactionsReadyToActivate(db, splitId);

  return db.split.update({ where: { id: splitId }, data: { status: "ACTIVE" } });
}
