import type { Prisma, PrismaClient, SplitWeekLocation } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { currentCalendarDate } from "@/lib/dates";
import { resolveWeekLocationWindow, type WeekLocationWindow } from "@/domain/location-window";
import { KPI_CATALOG, type KpiCode } from "@/domain/kpis/catalog";
import type { WeekLocationFormInput } from "@/server/validation/location";
import { getSplitWeek } from "@/server/services/split.service";

/**
 * Localizaciones semanales (`0.8.5` / MVP-2C, ver docs/WEEKLY_LOCATIONS.md).
 * CRUD administrativo con la misma ventana temporal para crear, editar y
 * eliminar: solo antes de que la semana comience, nunca en una semana ya
 * publicada ni en un split cerrado.
 */

type Db = PrismaClient | Prisma.TransactionClient;

async function getSplitOrThrow(db: Db, splitId: string) {
  const split = await db.split.findUnique({ where: { id: splitId } });
  if (!split) throw new DomainError("El split indicado no existe.");
  return split;
}

async function isWeekPublished(db: Db, weekId: string): Promise<boolean> {
  return (await db.weekPublication.findUnique({ where: { splitWeekId: weekId } })) !== null;
}

export interface WeekLocationWithWindow {
  location: SplitWeekLocation | null;
  window: WeekLocationWindow;
}

/** Localizacion (si existe) y ventana temporal de una semana concreta. */
export async function getWeekLocation(db: Db, splitId: string, weekId: string): Promise<WeekLocationWithWindow> {
  const week = await getSplitWeek(db, splitId, weekId);
  if (!week) throw new DomainError("La semana indicada no pertenece a este split.");

  const [location, published] = await Promise.all([
    db.splitWeekLocation.findUnique({ where: { splitWeekId: weekId } }),
    isWeekPublished(db, weekId),
  ]);
  const window = resolveWeekLocationWindow(currentCalendarDate(), week, published);
  return { location, window };
}

/** Todas las localizaciones de un split, para pintar el calendario de semanas con una unica consulta. */
export async function listWeekLocationsForSplit(db: Db, splitId: string): Promise<SplitWeekLocation[]> {
  return db.splitWeekLocation.findMany({ where: { splitWeek: { splitId } } });
}

async function assertLocationMutationAllowed(
  db: Db,
  splitId: string,
  weekId: string,
): Promise<{ splitStatus: string }> {
  const split = await getSplitOrThrow(db, splitId);
  if (split.status === "CLOSED") {
    throw new DomainError("No se puede modificar la localizacion de un split cerrado.");
  }
  if (split.status !== "DRAFT" && split.status !== "ACTIVE") {
    throw new DomainError("El split debe estar en borrador o activo para preparar una localizacion.");
  }
  const week = await getSplitWeek(db, splitId, weekId);
  if (!week) throw new DomainError("La semana indicada no pertenece a este split.");

  const published = await isWeekPublished(db, weekId);
  const window = resolveWeekLocationWindow(currentCalendarDate(), week, published);
  if (!window.editable) {
    if (published) {
      throw new DomainError("Esta semana ya esta publicada: su localizacion es de solo lectura.");
    }
    if (window.status === "ACTIVA" || window.status === "FINALIZADA") {
      throw new DomainError("Esta semana ya ha comenzado: su localizacion no se puede crear, editar ni eliminar.");
    }
    throw new DomainError("Esta semana no admite cambios de localizacion.");
  }
  return { splitStatus: split.status };
}

export async function upsertWeekLocation(
  db: PrismaClient,
  splitId: string,
  weekId: string,
  input: WeekLocationFormInput,
): Promise<SplitWeekLocation> {
  await assertLocationMutationAllowed(db, splitId, weekId);

  const kpiConfig = await db.splitKpiConfig.findUnique({
    where: { splitId_kpiCode: { splitId, kpiCode: input.kpiCode } },
  });
  if (!kpiConfig || !kpiConfig.isActive) {
    throw new DomainError(
      'El KPI seleccionado no esta activo en este split. Activalo antes en "KPI del split".',
      "kpiCode",
    );
  }

  return db.splitWeekLocation.upsert({
    where: { splitWeekId: weekId },
    create: {
      splitWeekId: weekId,
      name: input.name.trim(),
      kpiCode: input.kpiCode,
      bonusPercent: input.bonusPercent,
    },
    update: {
      name: input.name.trim(),
      kpiCode: input.kpiCode,
      bonusPercent: input.bonusPercent,
    },
  });
}

export async function deleteWeekLocation(db: PrismaClient, splitId: string, weekId: string): Promise<void> {
  await assertLocationMutationAllowed(db, splitId, weekId);
  await db.splitWeekLocation.deleteMany({ where: { splitWeekId: weekId } });
}

export interface FutureLocationUsage {
  sequenceNumber: number;
  locationName: string;
}

/**
 * Semanas futuras (todavia no comenzadas) cuya localizacion potencia el KPI
 * indicado. Usado para bloquear la desactivacion de ese KPI (seccion 8 del
 * encargo) sin borrar ni cambiar la localizacion en silencio.
 */
export async function findFutureLocationsUsingKpi(
  db: Db,
  splitId: string,
  kpiCode: KpiCode,
): Promise<FutureLocationUsage[]> {
  const now = currentCalendarDate();
  const locations = await db.splitWeekLocation.findMany({
    where: { kpiCode, splitWeek: { splitId, startDate: { gt: now } } },
    include: { splitWeek: { select: { sequenceNumber: true } } },
  });
  return locations
    .map((location) => ({ sequenceNumber: location.splitWeek.sequenceNumber, locationName: location.name }))
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
}

export interface ActiveWeekLocationForSplit {
  splitId: string;
  weekSequenceNumber: number;
  weekStartDate: Date;
  weekEndDate: Date;
  name: string;
  kpiCode: KpiCode;
  kpiName: string;
  bonusPercent: number;
}

/**
 * Localizacion de la semana que contiene la fecha actual, para cada split
 * indicado. Una sola consulta para todos los splits (seccion 23 y 29 del
 * encargo: nunca N+1 por ficha). Como las semanas de un split no se
 * solapan, hay como mucho una entrada por split.
 */
export async function listActiveWeekLocationsForSplits(
  db: Db,
  splitIds: string[],
  now: Date = currentCalendarDate(),
): Promise<Map<string, ActiveWeekLocationForSplit>> {
  if (splitIds.length === 0) return new Map();

  const locations = await db.splitWeekLocation.findMany({
    where: { splitWeek: { splitId: { in: splitIds }, startDate: { lte: now }, endDate: { gte: now } } },
    include: { splitWeek: { select: { splitId: true, sequenceNumber: true, startDate: true, endDate: true } } },
  });

  const result = new Map<string, ActiveWeekLocationForSplit>();
  for (const location of locations) {
    result.set(location.splitWeek.splitId, {
      splitId: location.splitWeek.splitId,
      weekSequenceNumber: location.splitWeek.sequenceNumber,
      weekStartDate: location.splitWeek.startDate,
      weekEndDate: location.splitWeek.endDate,
      name: location.name,
      kpiCode: location.kpiCode,
      kpiName: KPI_CATALOG[location.kpiCode].name,
      bonusPercent: location.bonusPercent,
    });
  }
  return result;
}
