-- CreateTable
CREATE TABLE "SplitPositionPointRule" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplitPositionPointRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SplitPositionPointRule_splitId_position_key" ON "SplitPositionPointRule"("splitId", "position");

-- AddForeignKey
ALTER TABLE "SplitPositionPointRule" ADD CONSTRAINT "SplitPositionPointRule_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CheckConstraint: solo existen las posiciones 1..15 en esta primera version.
ALTER TABLE "SplitPositionPointRule" ADD CONSTRAINT "SplitPositionPointRule_position_range_check" CHECK ("position" >= 1 AND "position" <= 15);

-- CheckConstraint: los puntos nunca son negativos.
ALTER TABLE "SplitPositionPointRule" ADD CONSTRAINT "SplitPositionPointRule_points_nonnegative_check" CHECK ("points" >= 0);

-- Backfill: crea las quince reglas de puntos por posicion, con los valores
-- historicos exactos auditados en Guia!B57:C71 del Excel de Split 8, para
-- cada split que ya existiera antes de esta migracion (ver
-- docs/DISCOVERY-1-SPLIT-8.md y docs/POSITION_POINTS_CONFIGURATION.md). No
-- modifica ningun otro dato ni cambia el estado de ningun split. Sobre una
-- base de datos vacia esta sentencia no inserta ninguna fila.
INSERT INTO "SplitPositionPointRule" ("id", "splitId", "position", "points", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    s."id",
    defaults."position",
    defaults."points",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Split" s
CROSS JOIN (
    VALUES
        (1, 15),
        (2, 11),
        (3, 8),
        (4, 5),
        (5, 3),
        (6, 2),
        (7, 1),
        (8, 1),
        (9, 1),
        (10, 1),
        (11, 1),
        (12, 1),
        (13, 1),
        (14, 1),
        (15, 1)
) AS defaults("position", "points");
