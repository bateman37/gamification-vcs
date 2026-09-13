-- `1.2.1`: renombra la denominacion base visible de la posicion `ARTIFACT`
-- de "Artefacto" a "Anillo". La clave tecnica `ARTIFACT` (enum, relaciones,
-- compras, inventario, equipo, snapshots historicos) NO cambia: es
-- exclusivamente una migracion de datos sobre el nombre visible.
--
-- Solo renombra una ranura cuando:
--   * ocupa la posicion `ARTIFACT`;
--   * su nombre normalizado sigue siendo exactamente el valor por defecto
--     anterior ("artefacto"), es decir, nadie la ha renombrado a mano.
--
-- Nunca toca una ranura ya renombrada por el administrador (conserva
-- cualquier nombre personalizado). Si el split ya tiene otra ranura llamada
-- "Anillo", la actualizacion de esa fila se omite en silencio gracias al
-- `NOT EXISTS`: no se inventa ningun sufijo ni se borra ninguna fila, para
-- no romper la unicidad `(splitId, nameNormalized)`. Ese caso (ranura sin
-- renombrar automaticamente) se documenta en la PR del hotfix.
UPDATE "SplitEquipmentSlot" AS "target"
SET "name" = 'Anillo', "nameNormalized" = 'anillo'
WHERE "target"."visualPosition" = 'ARTIFACT'
  AND "target"."nameNormalized" = 'artefacto'
  AND NOT EXISTS (
    SELECT 1
    FROM "SplitEquipmentSlot" AS "other"
    WHERE "other"."splitId" = "target"."splitId"
      AND "other"."nameNormalized" = 'anillo'
      AND "other"."id" <> "target"."id"
  );
