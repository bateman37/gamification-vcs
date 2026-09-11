-- CreateTable
CREATE TABLE "EscalationImport" (
    "id" TEXT NOT NULL,
    "splitWeekId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "fileSha256" TEXT NOT NULL,
    "sourceRowCount" INTEGER NOT NULL,
    "importedRowCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscalationImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationWeeklyRow" (
    "id" TEXT NOT NULL,
    "escalationImportId" TEXT NOT NULL,
    "splitParticipantId" TEXT NOT NULL,
    "sourceAgentName" TEXT NOT NULL,
    "groupReassignments" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscalationWeeklyRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityImport" (
    "id" TEXT NOT NULL,
    "splitWeekId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "fileSha256" TEXT NOT NULL,
    "sourceRowCount" INTEGER NOT NULL,
    "importedRowCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityWeeklyRow" (
    "id" TEXT NOT NULL,
    "qualityImportId" TEXT NOT NULL,
    "splitParticipantId" TEXT NOT NULL,
    "sourceAgentName" TEXT NOT NULL,
    "goodSatisfactionTickets" INTEGER NOT NULL,
    "badSatisfactionTickets" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityWeeklyRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceImport" (
    "id" TEXT NOT NULL,
    "splitWeekId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "fileSha256" TEXT NOT NULL,
    "sourceRowCount" INTEGER NOT NULL,
    "importedRowCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceWeeklyRow" (
    "id" TEXT NOT NULL,
    "voiceImportId" TEXT NOT NULL,
    "splitParticipantId" TEXT NOT NULL,
    "sourceAgentName" TEXT NOT NULL,
    "acceptedCallSegments" INTEGER NOT NULL,
    "rejectedCallSegments" INTEGER NOT NULL,
    "unattendedCallSegments" INTEGER NOT NULL,
    "outboundCalls" INTEGER NOT NULL,
    "segmentDurationHours" DECIMAL(14,6) NOT NULL,
    "segmentTalkTimeHours" DECIMAL(14,6) NOT NULL,
    "segmentWrapUpTimeHours" DECIMAL(14,6) NOT NULL,
    "segmentTalkTimeMinutes" DECIMAL(14,6) NOT NULL,
    "segmentWrapUpTimeMinutes" DECIMAL(14,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceWeeklyRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EscalationImport_splitWeekId_key" ON "EscalationImport"("splitWeekId");

-- CreateIndex
CREATE UNIQUE INDEX "EscalationWeeklyRow_escalationImportId_splitParticipantId_key" ON "EscalationWeeklyRow"("escalationImportId", "splitParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "QualityImport_splitWeekId_key" ON "QualityImport"("splitWeekId");

-- CreateIndex
CREATE UNIQUE INDEX "QualityWeeklyRow_qualityImportId_splitParticipantId_key" ON "QualityWeeklyRow"("qualityImportId", "splitParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceImport_splitWeekId_key" ON "VoiceImport"("splitWeekId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceWeeklyRow_voiceImportId_splitParticipantId_key" ON "VoiceWeeklyRow"("voiceImportId", "splitParticipantId");

-- AddForeignKey
ALTER TABLE "EscalationImport" ADD CONSTRAINT "EscalationImport_splitWeekId_fkey" FOREIGN KEY ("splitWeekId") REFERENCES "SplitWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationWeeklyRow" ADD CONSTRAINT "EscalationWeeklyRow_escalationImportId_fkey" FOREIGN KEY ("escalationImportId") REFERENCES "EscalationImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationWeeklyRow" ADD CONSTRAINT "EscalationWeeklyRow_splitParticipantId_fkey" FOREIGN KEY ("splitParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityImport" ADD CONSTRAINT "QualityImport_splitWeekId_fkey" FOREIGN KEY ("splitWeekId") REFERENCES "SplitWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityWeeklyRow" ADD CONSTRAINT "QualityWeeklyRow_qualityImportId_fkey" FOREIGN KEY ("qualityImportId") REFERENCES "QualityImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityWeeklyRow" ADD CONSTRAINT "QualityWeeklyRow_splitParticipantId_fkey" FOREIGN KEY ("splitParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceImport" ADD CONSTRAINT "VoiceImport_splitWeekId_fkey" FOREIGN KEY ("splitWeekId") REFERENCES "SplitWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceWeeklyRow" ADD CONSTRAINT "VoiceWeeklyRow_voiceImportId_fkey" FOREIGN KEY ("voiceImportId") REFERENCES "VoiceImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceWeeklyRow" ADD CONSTRAINT "VoiceWeeklyRow_splitParticipantId_fkey" FOREIGN KEY ("splitParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint: los conteos de las filas semanales de los tres nuevos
-- origenes son siempre no negativos (cero es un dato real).
ALTER TABLE "EscalationWeeklyRow" ADD CONSTRAINT "EscalationWeeklyRow_groupReassignments_nonnegative_check" CHECK ("groupReassignments" >= 0);

ALTER TABLE "QualityWeeklyRow" ADD CONSTRAINT "QualityWeeklyRow_goodSatisfactionTickets_nonnegative_check" CHECK ("goodSatisfactionTickets" >= 0);
ALTER TABLE "QualityWeeklyRow" ADD CONSTRAINT "QualityWeeklyRow_badSatisfactionTickets_nonnegative_check" CHECK ("badSatisfactionTickets" >= 0);

ALTER TABLE "VoiceWeeklyRow" ADD CONSTRAINT "VoiceWeeklyRow_acceptedCallSegments_nonnegative_check" CHECK ("acceptedCallSegments" >= 0);
ALTER TABLE "VoiceWeeklyRow" ADD CONSTRAINT "VoiceWeeklyRow_rejectedCallSegments_nonnegative_check" CHECK ("rejectedCallSegments" >= 0);
ALTER TABLE "VoiceWeeklyRow" ADD CONSTRAINT "VoiceWeeklyRow_unattendedCallSegments_nonnegative_check" CHECK ("unattendedCallSegments" >= 0);
ALTER TABLE "VoiceWeeklyRow" ADD CONSTRAINT "VoiceWeeklyRow_outboundCalls_nonnegative_check" CHECK ("outboundCalls" >= 0);
ALTER TABLE "VoiceWeeklyRow" ADD CONSTRAINT "VoiceWeeklyRow_segmentDurationHours_nonnegative_check" CHECK ("segmentDurationHours" >= 0);
ALTER TABLE "VoiceWeeklyRow" ADD CONSTRAINT "VoiceWeeklyRow_segmentTalkTimeHours_nonnegative_check" CHECK ("segmentTalkTimeHours" >= 0);
ALTER TABLE "VoiceWeeklyRow" ADD CONSTRAINT "VoiceWeeklyRow_segmentWrapUpTimeHours_nonnegative_check" CHECK ("segmentWrapUpTimeHours" >= 0);
ALTER TABLE "VoiceWeeklyRow" ADD CONSTRAINT "VoiceWeeklyRow_segmentTalkTimeMinutes_nonnegative_check" CHECK ("segmentTalkTimeMinutes" >= 0);
ALTER TABLE "VoiceWeeklyRow" ADD CONSTRAINT "VoiceWeeklyRow_segmentWrapUpTimeMinutes_nonnegative_check" CHECK ("segmentWrapUpTimeMinutes" >= 0);

-- CheckConstraint: los conteos de las cabeceras de carga de los tres
-- nuevos origenes nunca pueden ser negativos.
ALTER TABLE "EscalationImport" ADD CONSTRAINT "EscalationImport_sourceRowCount_nonnegative_check" CHECK ("sourceRowCount" >= 0);
ALTER TABLE "EscalationImport" ADD CONSTRAINT "EscalationImport_importedRowCount_nonnegative_check" CHECK ("importedRowCount" >= 0);

ALTER TABLE "QualityImport" ADD CONSTRAINT "QualityImport_sourceRowCount_nonnegative_check" CHECK ("sourceRowCount" >= 0);
ALTER TABLE "QualityImport" ADD CONSTRAINT "QualityImport_importedRowCount_nonnegative_check" CHECK ("importedRowCount" >= 0);

ALTER TABLE "VoiceImport" ADD CONSTRAINT "VoiceImport_sourceRowCount_nonnegative_check" CHECK ("sourceRowCount" >= 0);
ALTER TABLE "VoiceImport" ADD CONSTRAINT "VoiceImport_importedRowCount_nonnegative_check" CHECK ("importedRowCount" >= 0);
