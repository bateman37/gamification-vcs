import type { Prisma, PrismaClient, Split } from "@prisma/client";
import { DomainError } from "@/lib/errors";

/**
 * Guarda unica de bloqueo de configuracion tras la primera publicacion
 * (`0.7.0` / MVP-2A, seccion 12 del encargo). Desde que existe al menos una
 * `WeekPublication` del split, quedan bloqueados para el resto del split:
 * los puntos por posicion semanal, la activacion/desactivacion de KPI y sus
 * parametros de calculo. Sustituye la decision provisional de `MVP-1B` que
 * permitia editar KPI en un split `ACTIVE` sin limite (ver docs/DECISIONS.md).
 *
 * Debe llamarse con el mismo `db`/transaccion que va a escribir, igual que
 * `assertWeekIsEditable`, para que la comprobacion sea consistente con la
 * operacion y proteja tambien una carrera entre la primera publicacion y una
 * edicion concurrente. El nombre/color de las facciones no forma parte de
 * este bloqueo: se rige por su propia regla (ver docs/FACTIONS.md).
 */

type Db = PrismaClient | Prisma.TransactionClient;

export async function assertSplitConfigurationIsEditable(db: Db, split: Pick<Split, "id" | "status">): Promise<void> {
  if (split.status === "CLOSED") {
    throw new DomainError("No se puede editar la configuracion de un split cerrado.");
  }
  const publicationCount = await db.weekPublication.count({ where: { splitWeek: { splitId: split.id } } });
  if (publicationCount > 0) {
    throw new DomainError(
      "La configuracion quedo bloqueada al publicar la primera semana del split.",
    );
  }
}
