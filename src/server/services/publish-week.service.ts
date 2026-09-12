import { Prisma, type PrismaClient } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { getSplitById, getSplitWeek } from "@/server/services/split.service";
import { computeWeeklyResults } from "@/server/services/weekly-results.service";
import { computeCreditsEarned } from "@/domain/credits";

/**
 * Publicacion de una semana (ver docs/RESULTS_PUBLICATION.md y, desde
 * `0.9.0` / MVP-2D, docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md): operacion de
 * dominio irreversible. Vuelve a calcular todo desde base de datos (nunca
 * confia en totales enviados por el navegador) y escribe la instantanea
 * completa (publicacion, resultados por participante, por KPI, equipo
 * equipado y creditos) dentro de una unica transaccion serializable.
 *
 * Desde `0.9.0`, `computeWeeklyResults` se ejecuta **dentro** de esa misma
 * transaccion (con `tx`, nunca con el cliente exterior): el equipo de cada
 * participante se relee en el instante exacto de publicar, para que una
 * carrera entre equipar/desequipar y publicar nunca produzca una
 * instantanea hibrida (seccion 22 del encargo). La restriccion unica sobre
 * `splitWeekId` sigue protegiendo la concurrencia de publicacion sin crear
 * nunca dos publicaciones.
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

  try {
    const publication = await db.$transaction(
      async (tx) => {
        // Recalculado dentro de la transaccion: incluye la relectura del equipo vivo de cada
        // participante en este instante exacto (seccion 22 del encargo).
        const results = await computeWeeklyResults(tx, splitId, week.id);
        if (!results.isComplete) {
          throw new DomainError("La semana no esta completa: faltan KPI por cargar o introducir. No se puede publicar.");
        }
        if (results.participants.length === 0) {
          throw new DomainError("No hay participantes aplicables en esta semana. No se puede publicar.");
        }
        if (results.blockingIssues.length > 0) {
          throw new DomainError(`No se puede publicar hasta resolver: ${results.blockingIssues.join(" ")}`);
        }

        // Faccion actual de cada participante (`0.7.0` / MVP-2A, ver docs/FACTIONS.md): se congela
        // nombre y color en el momento de publicar. `null` para splits que no usan facciones.
        const factions = await tx.splitFaction.findMany({ where: { splitId } });
        const factionById = new Map(factions.map((faction) => [faction.id, faction]));

        const created = await tx.weekPublication.create({
          data: {
            splitWeekId: week.id,
            publishedByUserId: publishedByUserId ?? undefined,
            // Localizacion semanal congelada (`0.8.5` / MVP-2C, ver docs/WEEKLY_LOCATIONS.md):
            // como es unica y comun a toda la semana, se guarda una sola vez aqui, no por participante.
            locationId: results.location?.id ?? null,
            locationNameSnapshot: results.location?.name ?? null,
            locationKpiCodeSnapshot: results.location?.kpiCode ?? null,
            locationBonusPercentSnapshot: results.location?.bonusPercent ?? null,
          },
        });

        for (const participant of results.participants) {
          if (participant.positionPoints === null) {
            throw new DomainError(`Falta la regla de puntos por posicion para la posicion ${participant.weeklyRank}.`);
          }

          const faction = participant.factionId ? factionById.get(participant.factionId) ?? null : null;
          // Profesion congelada tal como estaba al publicar (`0.8.0` / MVP-2B). `null` cuando el split no
          // usa profesiones; `splitUsedProfessions` distingue ese caso de una publicacion anterior a 0.8.0.
          const profession = participant.profession;
          const creditsEarned = computeCreditsEarned(participant.totalKpiPoints);

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
              professionId: profession?.id ?? null,
              professionNameSnapshot: profession?.name ?? null,
              professionKpiCodeA: profession?.kpiCodeA ?? null,
              professionKpiCodeB: profession?.kpiCodeB ?? null,
              professionBonusPercent: profession?.bonusPercent ?? null,
              splitUsedProfessions: results.usesProfessions,
              creditsEarned,
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
              basePointsBeforeProfession: kpiResult.basePointsBeforeProfession,
              professionBonusPoints: kpiResult.professionBonusPoints,
              professionApplied: kpiResult.professionApplied,
              professionNameSnapshot: kpiResult.professionName,
              locationBonusPoints: kpiResult.locationBonusPoints,
              locationApplied: kpiResult.locationApplied,
              equipmentBonusPoints: kpiResult.equipmentBonusPoints,
              equipmentApplied: kpiResult.equipmentApplied,
              kpiRank: kpiResult.kpiRank,
              rankedParticipantCount: kpiResult.rankedParticipantCount,
            })),
          });

          // Instantanea del equipo equipado en el instante de publicar (`0.9.0` / MVP-2D, seccion 28
          // del encargo): una fila por objeto, independientemente de si su KPI produjo bonus esa
          // semana. Nunca depende despues del catalogo o del equipo actual.
          if (participant.equippedItems.length > 0) {
            await tx.publishedEquippedItem.createMany({
              data: participant.equippedItems.map((equippedItem, index) => ({
                participantWeeklyResultId: participantResult.id,
                storeItemId: equippedItem.storeItemId,
                itemNameSnapshot: equippedItem.itemName,
                equipmentSlotId: equippedItem.equipmentSlotId,
                equipmentSlotNameSnapshot: equippedItem.equipmentSlotName,
                kpiCodeSnapshot: equippedItem.kpiCode,
                bonusPercentSnapshot: equippedItem.bonusPercent,
                displayOrder: index,
              })),
            });
          }

          // Creditos ganados por esta fila, generados exactamente una vez al publicar (`0.9.0` /
          // MVP-2D, seccion 3 del encargo): un unico movimiento WEEKLY_EARNING vinculado a este
          // resultado, en la misma transaccion que crea la publicacion.
          await tx.creditLedgerEntry.create({
            data: {
              splitParticipantId: participant.splitParticipantId,
              type: "WEEKLY_EARNING",
              amount: creditsEarned,
              description: `Creditos de la semana ${week.sequenceNumber}`,
              publishedResultId: participantResult.id,
            },
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
