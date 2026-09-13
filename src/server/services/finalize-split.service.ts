import { Prisma, type PrismaClient } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { computeSplitClassification, computeSplitKpiClassification } from "@/server/services/classification.service";
import { computeFactionClassification } from "@/server/services/faction-classification.service";
import { listKpiConfigsForSplit } from "@/server/services/kpi.service";
import { closeMarketWithinTransaction } from "@/server/services/economy.service";
import { createNewsWithDeliveries, resolveActiveAdminUserIds, resolveAllParticipantsForSplit } from "@/server/services/news.service";
import { buildNewsActionPath } from "@/domain/news-links";
import { adminSplitFinalizedNewsTemplate, splitFinalizedNewsTemplateForParticipant } from "@/domain/news-templates";
import { KPI_CATALOG } from "@/domain/kpis/catalog";
import {
  buildFinalizationFactionWinner,
  buildFinalizationKpiWinner,
  buildFinalizationPodium,
  type SplitFinalizationSummary,
} from "@/domain/split-finalization";

/**
 * Finalizacion formal de un split (`1.2.2`, seccion 7 del encargo). La
 * publicacion existente de cada semana es la unica prueba de cierre: nunca
 * se usa la fecha actual, `numberOfWeeks` sin contrastar, ni un contador
 * enviado por el navegador.
 */

export interface SplitFinalizationCounts {
  totalWeeks: number;
  publishedWeeks: number;
}

/** "Semanas publicadas: X de Y" (seccion 7.2 del encargo), reutilizado por la pantalla y por el servicio. */
export async function getSplitFinalizationCounts(db: PrismaClient, splitId: string): Promise<SplitFinalizationCounts> {
  const [totalWeeks, publishedWeeks] = await Promise.all([
    db.splitWeek.count({ where: { splitId } }),
    db.weekPublication.count({ where: { splitWeek: { splitId } } }),
  ]);
  return { totalWeeks, publishedWeeks };
}

/**
 * Calcula el resumen final (podio, faccion ganadora, ganadores por KPI)
 * exclusivamente a partir de publicaciones ya existentes, reutilizando los
 * servicios oficiales de clasificacion (nunca reimplementa ningun
 * ranking). Es una lectura pura sobre datos inmutables: se ejecuta antes de
 * abrir la transaccion de cierre porque, una vez que todas las semanas de
 * un split ya estan publicadas, no existe ninguna operacion capaz de
 * alterar esos datos (no hay despublicar/reabrir una semana), y un alta de
 * participante deja de ser posible (cualquier semana inicial disponible ya
 * estaria publicada).
 */
async function buildFinalizationSummary(db: PrismaClient, splitId: string): Promise<SplitFinalizationSummary> {
  const [classification, factionClassification, kpiConfigs] = await Promise.all([
    computeSplitClassification(db, splitId),
    computeFactionClassification(db, splitId),
    listKpiConfigsForSplit(db, splitId),
  ]);

  const podium = buildFinalizationPodium(classification.entries.map((entry) => ({ rank: entry.rank, name: entry.alias })));
  const factionWinner = buildFinalizationFactionWinner(
    factionClassification.hasFactionData,
    factionClassification.accumulated.map((entry) => ({ rank: entry.rank, name: entry.name })),
  );

  const activeKpiConfigs = kpiConfigs.filter((config) => config.isActive);
  const kpiWinners = await Promise.all(
    activeKpiConfigs.map(async (config) => {
      const entries = await computeSplitKpiClassification(db, splitId, config.kpiCode, null);
      return buildFinalizationKpiWinner(
        config.kpiCode,
        KPI_CATALOG[config.kpiCode].name,
        entries.map((entry) => ({ rank: entry.rank, name: entry.alias, sum: entry.sum })),
      );
    }),
  );

  return { podium, factionWinner, kpiWinners };
}

export interface FinalizeSplitResult {
  splitId: string;
  /** `true` si el split ya estaba finalizado (doble clic, reintento o carrera concurrente resuelta de forma idempotente). */
  alreadyFinalized: boolean;
}

/**
 * Finaliza formalmente un split: solo cuando esta activo y todas sus
 * semanas programadas tienen ya su publicacion vigente. Dentro de una
 * unica transaccion serializable: cambia el estado al terminal existente
 * `CLOSED` (etiqueta visible "Finalizado"), cierra el mercado si estaba
 * abierto y crea una unica noticia final idempotente
 * (`split-finalized:{splitId}`) para todos los participantes, mas un aviso
 * administrativo. Un doble clic, un reintento de red o una llamada
 * concurrente nunca duplican la noticia ni vuelven a cambiar el estado: si
 * el split ya esta `CLOSED`, la operacion devuelve un resultado idempotente.
 */
export async function finalizeSplit(db: PrismaClient, splitId: string): Promise<FinalizeSplitResult> {
  const split = await db.split.findUnique({ where: { id: splitId } });
  if (!split) throw new DomainError("El split indicado no existe.");
  if (split.status === "CLOSED") {
    // No existe ningun otro camino a `CLOSED` en el dominio: este estado solo puede haberse
    // alcanzado por una finalizacion previa, asi que un reintento no debe volver a crear nada.
    return { splitId, alreadyFinalized: true };
  }
  if (split.status !== "ACTIVE") {
    throw new DomainError("Solo se puede finalizar un split activo.");
  }

  const counts = await getSplitFinalizationCounts(db, splitId);
  if (counts.totalWeeks === 0) {
    throw new DomainError("El split necesita al menos una semana programada para poder finalizarse.");
  }
  if (counts.publishedWeeks !== counts.totalWeeks) {
    throw new DomainError(
      `No se puede finalizar: hay ${counts.publishedWeeks} de ${counts.totalWeeks} semanas publicadas. Publica todas las semanas primero.`,
    );
  }

  const summary = await buildFinalizationSummary(db, splitId);
  const participants = await resolveAllParticipantsForSplit(db, splitId);
  const adminUserIds = await resolveActiveAdminUserIds(db);

  try {
    await db.$transaction(
      async (tx) => {
        // Revalidacion final dentro de la transaccion (seccion 12.2 del encargo): la comprobacion
        // anterior no basta por si sola frente a una carrera concurrente.
        const current = await tx.split.findUnique({ where: { id: splitId } });
        if (!current) throw new DomainError("El split indicado no existe.");
        if (current.status === "CLOSED") return; // Ganada por una llamada concurrente: idempotente.
        if (current.status !== "ACTIVE") {
          throw new DomainError("Solo se puede finalizar un split activo.");
        }

        const [totalWeeksNow, publishedWeeksNow] = await Promise.all([
          tx.splitWeek.count({ where: { splitId } }),
          tx.weekPublication.count({ where: { splitWeek: { splitId } } }),
        ]);
        if (totalWeeksNow === 0 || publishedWeeksNow !== totalWeeksNow) {
          throw new DomainError("No se puede finalizar: no todas las semanas estan publicadas todavia.");
        }

        await tx.split.update({ where: { id: splitId }, data: { status: "CLOSED" } });
        await closeMarketWithinTransaction(tx, splitId, current);

        if (participants.length > 0) {
          const { title, body } = splitFinalizedNewsTemplateForParticipant({ splitName: current.name, summary });
          await createNewsWithDeliveries(
            tx,
            {
              splitId,
              splitNameSnapshot: current.name,
              origin: "AUTOMATIC",
              category: "RESULTS",
              priority: "IMPORTANT",
              title,
              body,
              eventKey: `split-finalized:${splitId}`,
            },
            participants.map((p) => ({ personId: p.personId, actionPath: buildNewsActionPath({ kind: "RESULTS", splitId }, "PERSON") })),
          );
        }

        if (adminUserIds.length > 0) {
          const adminText = adminSplitFinalizedNewsTemplate({
            splitName: current.name,
            participantCount: participants.length,
            summary,
          });
          await createNewsWithDeliveries(
            tx,
            {
              splitId,
              splitNameSnapshot: current.name,
              origin: "AUTOMATIC",
              category: "ADMIN",
              priority: "IMPORTANT",
              title: adminText.title,
              body: adminText.body,
              eventKey: `admin-split-finalized:${splitId}`,
            },
            adminUserIds.map((userId) => ({ userId, actionPath: buildNewsActionPath({ kind: "SPLIT_ADMIN", splitId, anchor: "resumen" }, "USER") })),
          );
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    const raceExisting = await db.split.findUnique({ where: { id: splitId } });
    if (raceExisting?.status === "CLOSED") {
      return { splitId, alreadyFinalized: true };
    }
    throw error;
  }

  return { splitId, alreadyFinalized: false };
}
