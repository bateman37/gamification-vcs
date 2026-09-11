-- AlterTable
ALTER TABLE "PublishedKpiResult" ADD COLUMN     "basePointsBeforeProfession" DECIMAL(14,4),
ADD COLUMN     "professionApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "professionBonusPoints" DECIMAL(14,4),
ADD COLUMN     "professionNameSnapshot" TEXT;

-- AlterTable
ALTER TABLE "PublishedParticipantWeeklyResult" ADD COLUMN     "professionBonusPercent" INTEGER,
ADD COLUMN     "professionId" TEXT,
ADD COLUMN     "professionKpiCodeA" "KpiCode",
ADD COLUMN     "professionKpiCodeB" "KpiCode",
ADD COLUMN     "professionNameSnapshot" TEXT,
ADD COLUMN     "splitUsedProfessions" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SplitParticipant" ADD COLUMN     "professionId" TEXT;

-- CreateTable
CREATE TABLE "SplitProfession" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "kpiCodeA" "KpiCode" NOT NULL,
    "kpiCodeB" "KpiCode" NOT NULL,
    "availableN0" BOOLEAN NOT NULL DEFAULT false,
    "availableN1" BOOLEAN NOT NULL DEFAULT false,
    "availableN2" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplitProfession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitParticipantAvatar" (
    "splitParticipantId" TEXT NOT NULL,
    "imageData" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplitParticipantAvatar_pkey" PRIMARY KEY ("splitParticipantId")
);

-- CreateIndex
CREATE UNIQUE INDEX "SplitProfession_splitId_nameNormalized_key" ON "SplitProfession"("splitId", "nameNormalized");

-- CreateIndex
CREATE INDEX "PublishedParticipantWeeklyResult_professionId_idx" ON "PublishedParticipantWeeklyResult"("professionId");

-- CreateIndex
CREATE INDEX "SplitParticipant_professionId_idx" ON "SplitParticipant"("professionId");

-- AddForeignKey
ALTER TABLE "SplitParticipant" ADD CONSTRAINT "SplitParticipant_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "SplitProfession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitProfession" ADD CONSTRAINT "SplitProfession_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitParticipantAvatar" ADD CONSTRAINT "SplitParticipantAvatar_splitParticipantId_fkey" FOREIGN KEY ("splitParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedParticipantWeeklyResult" ADD CONSTRAINT "PublishedParticipantWeeklyResult_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "SplitProfession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint: una profesion potencia siempre dos KPI distintos (ver docs/PROFESSIONS_AND_PROFILES.md).
ALTER TABLE "SplitProfession" ADD CONSTRAINT "SplitProfession_distinct_kpis_check" CHECK ("kpiCodeA" <> "kpiCodeB");

-- CheckConstraint: una profesion debe estar disponible para al menos un nivel tecnico.
ALTER TABLE "SplitProfession" ADD CONSTRAINT "SplitProfession_at_least_one_level_check" CHECK ("availableN0" OR "availableN1" OR "availableN2");

-- CheckConstraint: el nombre normalizado nunca queda vacio (igual que faccion y alias de participante).
ALTER TABLE "SplitProfession" ADD CONSTRAINT "SplitProfession_nameNormalized_not_blank_check" CHECK (length(trim("nameNormalized")) > 0);

-- CheckConstraint: el tamano guardado del avatar es siempre positivo y coincide con los bytes almacenados.
ALTER TABLE "SplitParticipantAvatar" ADD CONSTRAINT "SplitParticipantAvatar_byteSize_positive_check" CHECK ("byteSize" > 0);
ALTER TABLE "SplitParticipantAvatar" ADD CONSTRAINT "SplitParticipantAvatar_byteSize_matches_data_check" CHECK ("byteSize" = octet_length("imageData"));

-- CheckConstraint: el porcentaje de bonus congelado, cuando existe, es siempre positivo (hoy siempre 20).
ALTER TABLE "PublishedParticipantWeeklyResult" ADD CONSTRAINT "PublishedParticipantWeeklyResult_professionBonusPercent_check" CHECK ("professionBonusPercent" IS NULL OR "professionBonusPercent" > 0);

-- Nota de migracion: no se inventa ninguna profesion ni ningun bonus retroactivo. Las filas ya
-- publicadas conservan `professionId`/`professionBonusPoints` a NULL y `splitUsedProfessions` a
-- false, y siguen leyendose exactamente igual que antes de `0.8.0`.
