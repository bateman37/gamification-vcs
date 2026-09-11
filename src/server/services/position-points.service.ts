import type { Prisma, PrismaClient, SplitPositionPointRule } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { DEFAULT_POSITION_POINTS } from "@/domain/position-points";

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

/**
 * Sustituye atomicamente los puntos de las quince posiciones de un split.
 * No se permite en splits `CLOSED` (protegido tambien en servidor, no solo
 * en la interfaz). Esta configuracion todavia no modifica ningun resultado,
 * clasificacion ni contador de KPI cargados.
 */
export async function updatePositionPointRules(
  db: PrismaClient,
  splitId: string,
  rows: { position: number; points: number }[],
): Promise<void> {
  const split = await db.split.findUnique({ where: { id: splitId } });
  if (!split) {
    throw new DomainError("El split indicado no existe.");
  }
  if (split.status === "CLOSED") {
    throw new DomainError("No se pueden editar los puntos por posicion de un split cerrado.");
  }

  await db.$transaction(
    rows.map((row) =>
      db.splitPositionPointRule.update({
        where: { splitId_position: { splitId, position: row.position } },
        data: { points: row.points },
      }),
    ),
  );
}
