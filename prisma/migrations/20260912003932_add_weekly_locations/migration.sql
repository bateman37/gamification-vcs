-- AlterTable
ALTER TABLE "PublishedKpiResult" ADD COLUMN     "locationApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locationBonusPoints" DECIMAL(14,4);

-- AlterTable
ALTER TABLE "WeekPublication" ADD COLUMN     "locationBonusPercentSnapshot" INTEGER,
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "locationKpiCodeSnapshot" "KpiCode",
ADD COLUMN     "locationNameSnapshot" TEXT;

-- CreateTable
CREATE TABLE "SplitWeekLocation" (
    "id" TEXT NOT NULL,
    "splitWeekId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kpiCode" "KpiCode" NOT NULL,
    "bonusPercent" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplitWeekLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SplitWeekLocation_splitWeekId_key" ON "SplitWeekLocation"("splitWeekId");

-- AddForeignKey
ALTER TABLE "WeekPublication" ADD CONSTRAINT "WeekPublication_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "SplitWeekLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitWeekLocation" ADD CONSTRAINT "SplitWeekLocation_splitWeekId_fkey" FOREIGN KEY ("splitWeekId") REFERENCES "SplitWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CheckConstraint: el nombre de la localizacion nunca puede quedar vacio tras recortar espacios exteriores.
ALTER TABLE "SplitWeekLocation" ADD CONSTRAINT "SplitWeekLocation_name_not_blank_check" CHECK (length(btrim("name")) > 0);

-- CheckConstraint: el bonus solo puede ser uno de los cinco porcentajes cerrados (seccion 2 del encargo).
ALTER TABLE "SplitWeekLocation" ADD CONSTRAINT "SplitWeekLocation_bonusPercent_allowed_check" CHECK ("bonusPercent" IN (10, 20, 30, 40, 50));

-- CheckConstraint: el porcentaje congelado en la publicacion, cuando existe, respeta el mismo conjunto cerrado.
ALTER TABLE "WeekPublication" ADD CONSTRAINT "WeekPublication_locationBonusPercentSnapshot_allowed_check" CHECK ("locationBonusPercentSnapshot" IS NULL OR "locationBonusPercentSnapshot" IN (10, 20, 30, 40, 50));
