import type { Prisma, PrismaClient, SplitPositionPointRule } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { DEFAULT_POSITION_POINTS, resolveRequiredPositionCount } from "@/domain/position-points";
import { assertSplitConfigurationIsEditable } from "@/server/services/shared/split-configuration-lock";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Crea las quince reglas de puntos por posicion semanal de un split nuevo,
 * con los valores predeterminados de Split 8. Debe llamarse dentro de la
 * misma transaccion que crea el split, sus semanas y su configuracion de
 * KPI (ver `createSplitWithWeeks`), para que la creacion sea atomica.
 */
export async function createDefaultPositionPointRules(tx: Prisma.TransactionClient, splitId: string): Promise<void> {
  await tx.splitPositionPointRule.createMany({
    data: DEFAULT_POSITION_POINTS.map((entry) => ({
      splitId,
      position: entry.position,
      points: entry.points,
    })),
  });
}

export async function listPositionPointRules(db: Db, splitId: string): Promise<SplitPositionPointRule[]> {
  return db.splitPositionPointRule.findMany({ where: { splitId }, orderBy: { position: "asc" } });
}

async function getMaxPersistedPosition(db: Db, splitId: string): Promise<number> {
  const aggregate = await db.splitPositionPointRule.aggregate({ where: { splitId }, _max: { position: true } });
  return aggregate._max.position ?? 0;
}

/**
 * Calcula el rango dinamico `1..N` requerido hoy para un split
 * (`resolveRequiredPositionCount`, ver docs/POSITION_POINTS_CONFIGURATION.md):
 * el mayor entre las quince posiciones historicas, el numero actual de
 * participantes y la mayor posicion ya persistida. Nunca confia en un limite
 * enviado por el cliente.
 */
export async function resolveRequiredPositionCountForSplit(db: Db, splitId: string): Promise<number> {
  const [participantCount, maxPersistedPosition] = await Promise.all([
    db.splitParticipant.count({ where: { splitId } }),
    getMaxPersistedPosition(db, splitId),
  ]);
  return resolveRequiredPositionCount(participantCount, maxPersistedPosition);
}

/**
 * Garantiza que existan reglas `1..requiredMax` para el split, creando con
 * `0` puntos unicamente las que faltan (`createMany` con `skipDuplicates`,
 * idempotente y resistente a concurrencia). Es mantenimiento de integridad,
 * no una edicion manual: se llama tanto si la configuracion esta bloqueada
 * como si no lo esta, y nunca modifica una regla ya existente.
 */
export async function ensurePositionPointRuleCoverage(db: Db, splitId: string, requiredMax: number): Promise<void> {
  if (requiredMax < 1) return;
  const positions = Array.from({ length: requiredMax }, (_, index) => index + 1);
  await db.splitPositionPointRule.createMany({
    data: positions.map((position) => ({ splitId, position, points: 0 })),
    skipDuplicates: true,
  });
}

/**
 * Sustituye atomicamente los puntos de las posiciones `1..N` de un split
 * (`N` dinamico desde `1.2.2`). Bloqueada desde que el split tiene al menos
 * una semana publicada, ademas de en un split `CLOSED`
 * (`assertSplitConfigurationIsEditable`, seccion 12 de `0.7.0` / MVP-2A,
 * protegido en servidor, no solo en la interfaz). Antes de esa primera
 * publicacion, esta configuracion no modifica ningun resultado,
 * clasificacion ni contador de KPI cargados ya calculado.
 */
export async function updatePositionPointRules(
  db: PrismaClient,
  splitId: string,
  rows: { position: number; points: number }[],
): Promise<void> {
  await db.$transaction(async (tx) => {
    const split = await tx.split.findUnique({ where: { id: splitId } });
    if (!split) {
      throw new DomainError("El split indicado no existe.");
    }
    await assertSplitConfigurationIsEditable(tx, split);

    const requiredMax = rows.reduce((max, row) => Math.max(max, row.position), 0);
    await ensurePositionPointRuleCoverage(tx, splitId, requiredMax);

    for (const row of rows) {
      await tx.splitPositionPointRule.upsert({
        where: { splitId_position: { splitId, position: row.position } },
        create: { splitId, position: row.position, points: row.points },
        update: { points: row.points },
      });
    }
  });
}

/**
 * Lectura para pantalla: garantiza primero la cobertura dinamica `1..N`
 * (defensa ante datos legacy incompletos, seccion 6.2 del encargo) y
 * devuelve las reglas ya ordenadas. Usada por el detalle del split en vez de
 * `listPositionPointRules` directamente.
 */
export async function ensureAndListPositionPointRules(db: PrismaClient, splitId: string): Promise<SplitPositionPointRule[]> {
  const requiredMax = await resolveRequiredPositionCountForSplit(db, splitId);
  await db.$transaction(async (tx) => {
    await ensurePositionPointRuleCoverage(tx, splitId, requiredMax);
  });
  return listPositionPointRules(db, splitId);
}
