import { Prisma, type PrismaClient } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { getSplitById, getSplitWeek } from "@/server/services/split.service";
import { computeWeeklyResults } from "@/server/services/weekly-results.service";

/**
 * Publicacion de una semana (ver docs/RESULTS_PUBLICATION.md): operacion de
 * dominio irreversible. Vuelve a calcular todo desde base de datos (nunca
 * confia en totales enviados por el navegador) y escribe la instantanea
 * completa (publicacion, resultados por participante y por KPI) dentro de
 * una unica transaccion serializable, para que la restriccion unica sobre
 * `splitWeekId` proteja la concurrencia sin crear nunca dos publicaciones.
 */

export interface PublishWeekResult {
  publicationId: string;
  /** `true` si la semana ya estaba publicada (carrera concurrente resuelta de forma idempotente). */
  alreadyPublished: boolean;
}

export async function publishWeek(
  db: PrismaClient,
  splitId: string,
  weekId: string,
  publishedByUserId: string | null,
): Promise<PublishWeekResult> {
  const split = await getSplitById(db, splitId);
  if (!split) throw new DomainError("El split indicado no existe.");
  if (split.status !== "ACTIVE") {
    throw new DomainError("Solo se puede publicar una semana de un split activo.");
  }
  const week = await getSplitWeek(db, splitId, weekId);
  if (!week) throw new DomainError("La semana indicada no pertenece a este split.");

  const existing = await db.weekPublication.findUnique({ where: { splitWeekId: week.id } });
  if (existing) {
    throw new DomainError("Esta semana ya esta publicada.");
  }

  const results = await computeWeeklyResults(db, splitId, week.id);
  if (!results.isComplete) {
    throw new DomainError("La semana no esta completa: faltan KPI por cargar o introducir. No se puede publicar.");
  }
  if (results.participants.length === 0) {
    throw new DomainError("No hay participantes aplicables en esta semana. No se puede publicar.");
  }
  if (results.blockingIssues.length > 0) {
    throw new DomainError(`No se puede publicar hasta resolver: ${results.blockingIssues.join(" ")}`);
  }

  // Faccion actual de cada participante (`0.7.0` / MVP-2A, ver docs/FACTIONS.md): se congela nombre y color en el
  // momento de publicar. `null` para splits que no usan facciones.
  const factions = await db.splitFaction.findMany({ where: { splitId } });
  const factionById = new Map(factions.map((faction) => [faction.id, faction]));

  try {
    const publication = await db.$transaction(
      async (tx) => {
        const created = await tx.weekPublication.create({
          data: { splitWeekId: week.id, publishedByUserId: publishedByUserId ?? undefined },
        });

        for (const participant of results.participants) {
          if (participant.positionPoints === null) {
            throw new DomainError(`Falta la regla de puntos por posicion para la posicion ${participant.weeklyRank}.`);
          }

          const faction = participant.factionId ? factionById.get(participant.factionId) ?? null : null;

          const participantResult = await tx.publishedParticipantWeeklyResult.create({
            data: {
              publicationId: created.id,
              splitId,
              splitParticipantId: participant.splitParticipantId,
              personId: participant.personId,
              fullNameSnapshot: participant.fullName,
              aliasSnapshot: participant.alias,
              levelSnapshot: participant.level,
              totalKpiPoints: participant.totalKpiPoints,
              applicableMaxPoints: participant.applicableMaxPoints,
              weeklyRank: participant.weeklyRank,
              positionPoints: participant.positionPoints,
              rankedParticipantCount: results.participants.length,
              factionId: faction?.id ?? null,
              factionNameSnapshot: faction?.name ?? null,
              factionColorSnapshot: faction?.color ?? null,
            },
          });

          await tx.publishedKpiResult.createMany({
            data: participant.kpiResults.map((kpiResult) => ({
              participantWeeklyResultId: participantResult.id,
              kpiCode: kpiResult.kpiCode,
              kpiNameSnapshot: kpiResult.kpiName,
              outcomeStatus: kpiResult.status,
              rawPoints: kpiResult.rawPoints,
              finalPoints: kpiResult.finalPoints,
              baseMax: kpiResult.baseMax,
              capped: kpiResult.capped,
              kpiRank: kpiResult.kpiRank,
              rankedParticipantCount: kpiResult.rankedParticipantCount,
            })),
          });
        }

        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return { publicationId: publication.id, alreadyPublished: false };
  } catch (error) {
    // Carrera concurrente (violacion de la restriccion unica o fallo de serializacion): si al comprobar de nuevo ya
    // existe una publicacion para esta semana, se trata como resultado idempotente, nunca como una segunda publicacion.
    const raceExisting = await db.weekPublication.findUnique({ where: { splitWeekId: week.id } });
    if (raceExisting) {
      return { publicationId: raceExisting.id, alreadyPublished: true };
    }
    throw error;
  }
}
