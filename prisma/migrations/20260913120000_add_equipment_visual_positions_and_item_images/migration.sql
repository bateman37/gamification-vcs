-- `1.2.0`: equipo visual, inventario RPG e imagenes de objetos.
--
-- Migracion estrictamente ADITIVA y NO DESTRUCTIVA:
--   * ninguna ranura, objeto, compra, inventario, equipo, movimiento de
--     creditos ni publicacion se elimina, se sustituye ni se reasigna;
--   * todas las ranuras existentes conservan su `id`, su nombre, su orden y
--     todas sus relaciones, y quedan ACTIVAS;
--   * `visualPosition` nace NULL: solo se rellena automaticamente cuando el
--     nombre normalizado de la ranura coincide EXACTAMENTE con un nombre base
--     del catalogo cerrado y esa posicion no esta ya ocupada en ese split.
--     Nunca se deduce que "Arma", "Escudo" o "Anillo" sean una parte del
--     cuerpo concreta: ante cualquier duda la ranura queda sin ubicar.

-- 1. Catalogo cerrado de posiciones visuales.
CREATE TYPE "EquipmentVisualPosition" AS ENUM (
  'HEAD',
  'LEFT_HAND',
  'TORSO',
  'RIGHT_HAND',
  'HANDS',
  'LEGS',
  'CAPE',
  'ARTIFACT',
  'FEET',
  'RELIC'
);

-- 2. Evolucion de la ranura existente (aditiva).
ALTER TABLE "SplitEquipmentSlot" ADD COLUMN "visualPosition" "EquipmentVisualPosition";
ALTER TABLE "SplitEquipmentSlot" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Como mucho una ranura por posicion visual dentro de un split. Varios NULL no
-- colisionan entre si en PostgreSQL: las ranuras historicas sin ubicar conviven.
CREATE UNIQUE INDEX "SplitEquipmentSlot_splitId_visualPosition_key"
  ON "SplitEquipmentSlot"("splitId", "visualPosition");

-- 3. Mapeo automatico conservador de ranuras historicas.
--    Solo por coincidencia exacta del nombre normalizado con un nombre base del
--    catalogo, y solo si esa posicion sigue libre en ese split. `DISTINCT ON`
--    evita que dos ranuras compitan por la misma posicion (no puede ocurrir por
--    la unicidad de `nameNormalized`, pero deja la migracion a prueba de datos
--    inesperados).
WITH "base_names"("nameNormalized", "position") AS (
  VALUES
    ('cabeza', 'HEAD'),
    ('mano izquierda', 'LEFT_HAND'),
    ('torso', 'TORSO'),
    ('mano derecha', 'RIGHT_HAND'),
    ('manos', 'HANDS'),
    ('piernas', 'LEGS'),
    ('capa', 'CAPE'),
    ('artefacto', 'ARTIFACT'),
    ('pies', 'FEET'),
    ('reliquia', 'RELIC')
), "matches" AS (
  SELECT DISTINCT ON ("slot"."splitId", "base"."position")
    "slot"."id" AS "slotId",
    "base"."position" AS "position"
  FROM "SplitEquipmentSlot" AS "slot"
  JOIN "base_names" AS "base" ON "base"."nameNormalized" = "slot"."nameNormalized"
  ORDER BY "slot"."splitId", "base"."position", "slot"."createdAt", "slot"."id"
)
UPDATE "SplitEquipmentSlot" AS "target"
SET "visualPosition" = "matches"."position"::"EquipmentVisualPosition"
FROM "matches"
WHERE "target"."id" = "matches"."slotId";

-- 4. Imagen opcional de objeto, en una entidad separada uno-a-uno (mismo
--    patron que `SplitParticipantAvatar`): los bytes nunca viajan en un listado.
CREATE TABLE "SplitStoreItemImage" (
    "splitStoreItemId" TEXT NOT NULL,
    "imageData" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplitStoreItemImage_pkey" PRIMARY KEY ("splitStoreItemId")
);

ALTER TABLE "SplitStoreItemImage"
  ADD CONSTRAINT "SplitStoreItemImage_splitStoreItemId_fkey"
  FOREIGN KEY ("splitStoreItemId") REFERENCES "SplitStoreItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SplitStoreItemImage"
  ADD CONSTRAINT "SplitStoreItemImage_byteSize_positive_check" CHECK ("byteSize" > 0);
ALTER TABLE "SplitStoreItemImage"
  ADD CONSTRAINT "SplitStoreItemImage_byteSize_matches_data_check" CHECK ("byteSize" = octet_length("imageData"));
