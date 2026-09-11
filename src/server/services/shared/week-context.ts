import type { Prisma, PrismaClient, Split } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { getSplitWeek } from "@/server/services/split.service";

/**
 * Resolucion y comprobacion de split/semana compartida por los cuatro
 * servicios de carga semanal (Productividad, Escalados, Calidad,
 * Llamadas). El servicio de Productividad, ya validado manualmente,
 * conserva su propia copia privada equivalente y no se ha tocado.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export interface WeekContext {
  split: Split;
  weekId: string;
  weekSequenceNumber: number;
}

export async function loadWeekContext(db: Db, splitId: string, weekId: string): Promise<WeekContext> {
  const split = await db.split.findUnique({ where: { id: splitId } });
  if (!split) {
    throw new DomainError("El split indicado no existe.");
  }
  const week = await getSplitWeek(db, splitId, weekId);
  if (!week) {
    throw new DomainError("La semana indicada no pertenece a este split.");
  }
  return { split, weekId: week.id, weekSequenceNumber: week.sequenceNumber };
}

export function assertSplitAcceptsLoads(split: Split, originLabel: string): void {
  if (split.status !== "ACTIVE") {
    throw new DomainError(`Solo se puede analizar o confirmar una carga de ${originLabel} en un split activo.`);
  }
}

/**
 * Guarda centralizada de bloqueo (seccion 5.4 de docs/RESULTS_PUBLICATION.md):
 * una semana publicada nunca puede modificarse, ni por carga Excel, ni por
 * entrada manual, ni por ninguna otra mutacion futura sobre sus datos. Se
 * consulta siempre en servidor, nunca se confia en `disabled` de la
 * interfaz. Debe llamarse con el mismo `db`/transaccion que hara la
 * escritura, para que la comprobacion sea consistente con la operacion.
 */
export async function assertWeekIsEditable(db: Db, weekId: string): Promise<void> {
  const publication = await db.weekPublication.findUnique({ where: { splitWeekId: weekId } });
  if (publication) {
    throw new DomainError("Semana publicada: los datos estan bloqueados y no se pueden modificar.");
  }
}
