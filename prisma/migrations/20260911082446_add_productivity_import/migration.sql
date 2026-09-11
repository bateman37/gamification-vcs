-- CreateTable
CREATE TABLE "ProductivityImport" (
    "id" TEXT NOT NULL,
    "splitWeekId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "fileSha256" TEXT NOT NULL,
    "sourceRowCount" INTEGER NOT NULL,
    "importedRowCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductivityImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductivityWeeklyRow" (
    "id" TEXT NOT NULL,
    "productivityImportId" TEXT NOT NULL,
    "splitParticipantId" TEXT NOT NULL,
    "sourceAgentName" TEXT NOT NULL,
    "updates" INTEGER NOT NULL,
    "comments" INTEGER NOT NULL,
    "publicComments" INTEGER NOT NULL,
    "internalComments" INTEGER NOT NULL,
    "ticketsUpdatedWithComment" INTEGER NOT NULL,
    "ticketsResolved" INTEGER NOT NULL,
    "ticketsCreated" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductivityWeeklyRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityImport_splitWeekId_key" ON "ProductivityImport"("splitWeekId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityWeeklyRow_productivityImportId_splitParticipant_key" ON "ProductivityWeeklyRow"("productivityImportId", "splitParticipantId");

-- AddForeignKey
ALTER TABLE "ProductivityImport" ADD CONSTRAINT "ProductivityImport_splitWeekId_fkey" FOREIGN KEY ("splitWeekId") REFERENCES "SplitWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityWeeklyRow" ADD CONSTRAINT "ProductivityWeeklyRow_productivityImportId_fkey" FOREIGN KEY ("productivityImportId") REFERENCES "ProductivityImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityWeeklyRow" ADD CONSTRAINT "ProductivityWeeklyRow_splitParticipantId_fkey" FOREIGN KEY ("splitParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint: los siete conteos importados del Excel son siempre
-- enteros no negativos (cero es un dato real, ver docs/IMPORT_PRODUCTIVITY.md).
ALTER TABLE "ProductivityWeeklyRow" ADD CONSTRAINT "ProductivityWeeklyRow_updates_nonnegative_check" CHECK ("updates" >= 0);
ALTER TABLE "ProductivityWeeklyRow" ADD CONSTRAINT "ProductivityWeeklyRow_comments_nonnegative_check" CHECK ("comments" >= 0);
ALTER TABLE "ProductivityWeeklyRow" ADD CONSTRAINT "ProductivityWeeklyRow_publicComments_nonnegative_check" CHECK ("publicComments" >= 0);
ALTER TABLE "ProductivityWeeklyRow" ADD CONSTRAINT "ProductivityWeeklyRow_internalComments_nonnegative_check" CHECK ("internalComments" >= 0);
ALTER TABLE "ProductivityWeeklyRow" ADD CONSTRAINT "ProductivityWeeklyRow_ticketsUpdatedWithComment_nonnegative_check" CHECK ("ticketsUpdatedWithComment" >= 0);
ALTER TABLE "ProductivityWeeklyRow" ADD CONSTRAINT "ProductivityWeeklyRow_ticketsResolved_nonnegative_check" CHECK ("ticketsResolved" >= 0);
ALTER TABLE "ProductivityWeeklyRow" ADD CONSTRAINT "ProductivityWeeklyRow_ticketsCreated_nonnegative_check" CHECK ("ticketsCreated" >= 0);

-- CheckConstraint: los conteos fuente y de filas importadas de la cabecera
-- de carga nunca pueden ser negativos.
ALTER TABLE "ProductivityImport" ADD CONSTRAINT "ProductivityImport_sourceRowCount_nonnegative_check" CHECK ("sourceRowCount" >= 0);
ALTER TABLE "ProductivityImport" ADD CONSTRAINT "ProductivityImport_importedRowCount_nonnegative_check" CHECK ("importedRowCount" >= 0);
