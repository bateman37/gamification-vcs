-- `1.2.2`: imagen opcional de faccion y puntos por posicion dinamicos.
--
-- Migracion estrictamente ADITIVA: no borra ni recorta ninguna faccion,
-- imagen, regla de posicion, resultado publicado ni snapshot existente.

-- 1. Emblema opcional de faccion, en una entidad separada uno-a-uno (mismo
--    patron que `SplitParticipantAvatar`/`SplitStoreItemImage`): los bytes
--    nunca viajan en un listado de facciones.
CREATE TABLE "SplitFactionImage" (
    "splitFactionId" TEXT NOT NULL,
    "imageData" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplitFactionImage_pkey" PRIMARY KEY ("splitFactionId")
);

ALTER TABLE "SplitFactionImage"
  ADD CONSTRAINT "SplitFactionImage_splitFactionId_fkey"
  FOREIGN KEY ("splitFactionId") REFERENCES "SplitFaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SplitFactionImage"
  ADD CONSTRAINT "SplitFactionImage_byteSize_positive_check" CHECK ("byteSize" > 0);
ALTER TABLE "SplitFactionImage"
  ADD CONSTRAINT "SplitFactionImage_byteSize_matches_data_check" CHECK ("byteSize" = octet_length("imageData"));

-- 2. Puntos por posicion semanal: elimina el limite superior fijo de 15
--    (dos restricciones historicas hoy conviven: la de la migracion de
--    creacion y la anadida despues junto a las de publicacion). Se conserva
--    `position >= 1` y la unicidad `(splitId, position)`; el limite superior
--    pasa a ser dinamico por split (`ensurePositionPointRuleCoverage`,
--    calculado en servicio, nunca en base de datos).
ALTER TABLE "SplitPositionPointRule" DROP CONSTRAINT IF EXISTS "SplitPositionPointRule_position_range_check";
ALTER TABLE "SplitPositionPointRule" DROP CONSTRAINT IF EXISTS "SplitPositionPointRule_position_check";
ALTER TABLE "SplitPositionPointRule" ADD CONSTRAINT "SplitPositionPointRule_position_check" CHECK ("position" >= 1);

-- 3. Backfill aditivo: para cada split cuyo numero de participantes ya
--    supera 15, crea unicamente las filas ausentes `16..N` (N = numero de
--    participantes) con `0` puntos. No modifica ninguna regla `1..15` ya
--    existente ni ninguna fila superior a 15 que ya hubiera de una prueba
--    previa (`ON CONFLICT DO NOTHING`, reejecutable sin duplicar datos).
INSERT INTO "SplitPositionPointRule" ("id", "splitId", "position", "points", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    counts."splitId",
    positions."position",
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT "splitId", COUNT(*) AS "participantCount"
    FROM "SplitParticipant"
    GROUP BY "splitId"
) AS counts
CROSS JOIN LATERAL generate_series(16, counts."participantCount") AS positions("position")
WHERE counts."participantCount" > 15
ON CONFLICT ("splitId", "position") DO NOTHING;
