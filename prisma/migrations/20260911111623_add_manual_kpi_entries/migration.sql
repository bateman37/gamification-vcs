-- CreateTable
CREATE TABLE "StabilityWeeklyEntry" (
    "id" TEXT NOT NULL,
    "splitWeekId" TEXT NOT NULL,
    "splitParticipantId" TEXT NOT NULL,
    "resultValue" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StabilityWeeklyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChronomancyWeeklyEntry" (
    "id" TEXT NOT NULL,
    "splitWeekId" TEXT NOT NULL,
    "splitParticipantId" TEXT NOT NULL,
    "productiveHours" DECIMAL(12,4) NOT NULL,
    "totalHours" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChronomancyWeeklyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WriterWeeklyEntry" (
    "id" TEXT NOT NULL,
    "splitWeekId" TEXT NOT NULL,
    "splitParticipantId" TEXT NOT NULL,
    "deliveredArticles" INTEGER NOT NULL,
    "undeliveredArticles" INTEGER NOT NULL,
    "proposedArticles" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WriterWeeklyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentWeeklyEntry" (
    "id" TEXT NOT NULL,
    "splitWeekId" TEXT NOT NULL,
    "splitParticipantId" TEXT NOT NULL,
    "dedicatedHours" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentWeeklyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprenticeWeeklyEntry" (
    "id" TEXT NOT NULL,
    "splitWeekId" TEXT NOT NULL,
    "splitParticipantId" TEXT NOT NULL,
    "completedTrainings" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprenticeWeeklyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StabilityWeeklyEntry_splitWeekId_splitParticipantId_key" ON "StabilityWeeklyEntry"("splitWeekId", "splitParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "ChronomancyWeeklyEntry_splitWeekId_splitParticipantId_key" ON "ChronomancyWeeklyEntry"("splitWeekId", "splitParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "WriterWeeklyEntry_splitWeekId_splitParticipantId_key" ON "WriterWeeklyEntry"("splitWeekId", "splitParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentWeeklyEntry_splitWeekId_splitParticipantId_key" ON "StudentWeeklyEntry"("splitWeekId", "splitParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprenticeWeeklyEntry_splitWeekId_splitParticipantId_key" ON "ApprenticeWeeklyEntry"("splitWeekId", "splitParticipantId");

-- AddForeignKey
ALTER TABLE "StabilityWeeklyEntry" ADD CONSTRAINT "StabilityWeeklyEntry_splitWeekId_fkey" FOREIGN KEY ("splitWeekId") REFERENCES "SplitWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StabilityWeeklyEntry" ADD CONSTRAINT "StabilityWeeklyEntry_splitParticipantId_fkey" FOREIGN KEY ("splitParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChronomancyWeeklyEntry" ADD CONSTRAINT "ChronomancyWeeklyEntry_splitWeekId_fkey" FOREIGN KEY ("splitWeekId") REFERENCES "SplitWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChronomancyWeeklyEntry" ADD CONSTRAINT "ChronomancyWeeklyEntry_splitParticipantId_fkey" FOREIGN KEY ("splitParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WriterWeeklyEntry" ADD CONSTRAINT "WriterWeeklyEntry_splitWeekId_fkey" FOREIGN KEY ("splitWeekId") REFERENCES "SplitWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WriterWeeklyEntry" ADD CONSTRAINT "WriterWeeklyEntry_splitParticipantId_fkey" FOREIGN KEY ("splitParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWeeklyEntry" ADD CONSTRAINT "StudentWeeklyEntry_splitWeekId_fkey" FOREIGN KEY ("splitWeekId") REFERENCES "SplitWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWeeklyEntry" ADD CONSTRAINT "StudentWeeklyEntry_splitParticipantId_fkey" FOREIGN KEY ("splitParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprenticeWeeklyEntry" ADD CONSTRAINT "ApprenticeWeeklyEntry_splitWeekId_fkey" FOREIGN KEY ("splitWeekId") REFERENCES "SplitWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprenticeWeeklyEntry" ADD CONSTRAINT "ApprenticeWeeklyEntry_splitParticipantId_fkey" FOREIGN KEY ("splitParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint: los valores de las cinco entradas manuales son siempre
-- no negativos (cero es un dato real, ver docs/MANUAL_KPI_ENTRY.md).
ALTER TABLE "StabilityWeeklyEntry" ADD CONSTRAINT "StabilityWeeklyEntry_resultValue_nonnegative_check" CHECK ("resultValue" >= 0);

ALTER TABLE "ChronomancyWeeklyEntry" ADD CONSTRAINT "ChronomancyWeeklyEntry_productiveHours_nonnegative_check" CHECK ("productiveHours" >= 0);
ALTER TABLE "ChronomancyWeeklyEntry" ADD CONSTRAINT "ChronomancyWeeklyEntry_totalHours_nonnegative_check" CHECK ("totalHours" >= 0);

ALTER TABLE "WriterWeeklyEntry" ADD CONSTRAINT "WriterWeeklyEntry_deliveredArticles_nonnegative_check" CHECK ("deliveredArticles" >= 0);
ALTER TABLE "WriterWeeklyEntry" ADD CONSTRAINT "WriterWeeklyEntry_undeliveredArticles_nonnegative_check" CHECK ("undeliveredArticles" >= 0);
ALTER TABLE "WriterWeeklyEntry" ADD CONSTRAINT "WriterWeeklyEntry_proposedArticles_nonnegative_check" CHECK ("proposedArticles" >= 0);

ALTER TABLE "StudentWeeklyEntry" ADD CONSTRAINT "StudentWeeklyEntry_dedicatedHours_nonnegative_check" CHECK ("dedicatedHours" >= 0);

ALTER TABLE "ApprenticeWeeklyEntry" ADD CONSTRAINT "ApprenticeWeeklyEntry_completedTrainings_nonnegative_check" CHECK ("completedTrainings" >= 0);
