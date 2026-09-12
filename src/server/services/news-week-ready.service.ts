import type { Prisma, PrismaClient } from "@prisma/client";
import { getWeeklyKpiLoadSummary } from "@/server/services/kpi-load-summary.service";
import { createNewsWithDeliveries, resolveActiveAdminUserIds } from "@/server/services/news.service";
import { buildNewsActionPath } from "@/domain/news-links";
import { adminWeekReadyNewsTemplate } from "@/domain/news-templates";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Aviso administrativo de "semana lista para revisar" (seccion 38 del
 * encargo). Se llama al final de cada carga Excel o entrada manual de KPI
 * (los nueve origenes), siempre dentro de la misma transaccion que guarda
 * los datos: comprueba con la misma logica compartida del calendario
 * (`getWeeklyKpiLoadSummary`) si todos los KPI activos de la semana ya
 * estan cargados y la semana todavia no esta publicada. La clave
 * idempotente por `splitWeekId` garantiza que solo se cree una vez, aunque
 * se vuelva a cargar o corregir datos despues.
 */
export async function notifyIfWeekReadyToReview(db: Db, splitId: string, weekId: string): Promise<void> {
  const week = await db.splitWeek.findUnique({ where: { id: weekId } });
  if (!week) return;

  const alreadyPublished = await db.weekPublication.findUnique({ where: { splitWeekId: weekId } });
  if (alreadyPublished) return;

  const summary = (await getWeeklyKpiLoadSummary(db, splitId, [week])).get(weekId);
  if (!summary || summary.totalActiveCount === 0 || summary.loadedCount !== summary.totalActiveCount) return;

  const split = await db.split.findUnique({ where: { id: splitId } });
  if (!split) return;

  const adminUserIds = await resolveActiveAdminUserIds(db);
  if (adminUserIds.length === 0) return;

  const { title, body } = adminWeekReadyNewsTemplate({ splitName: split.name, weekStartDate: week.startDate });
  await createNewsWithDeliveries(
    db,
    {
      splitId,
      splitNameSnapshot: split.name,
      origin: "AUTOMATIC",
      category: "ADMIN",
      title,
      body,
      eventKey: `week-ready:${weekId}`,
    },
    adminUserIds.map((userId) => ({
      userId,
      actionPath: buildNewsActionPath({ kind: "WEEK_RESULTS_ADMIN", splitId, weekId }, "USER"),
    })),
  );
}
