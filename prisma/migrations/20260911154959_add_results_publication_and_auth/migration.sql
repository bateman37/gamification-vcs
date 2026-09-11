-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PARTICIPANT');

-- CreateEnum
CREATE TYPE "PublishedKpiOutcomeStatus" AS ENUM ('COMPUTED', 'VAC', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "personId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeekPublication" (
    "id" TEXT NOT NULL,
    "splitWeekId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeekPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedParticipantWeeklyResult" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "splitParticipantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "fullNameSnapshot" TEXT NOT NULL,
    "aliasSnapshot" TEXT NOT NULL,
    "levelSnapshot" "ParticipantLevel" NOT NULL,
    "totalKpiPoints" DECIMAL(14,4) NOT NULL,
    "applicableMaxPoints" DECIMAL(14,4),
    "weeklyRank" INTEGER NOT NULL,
    "positionPoints" INTEGER NOT NULL,
    "rankedParticipantCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishedParticipantWeeklyResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedKpiResult" (
    "id" TEXT NOT NULL,
    "participantWeeklyResultId" TEXT NOT NULL,
    "kpiCode" "KpiCode" NOT NULL,
    "kpiNameSnapshot" TEXT NOT NULL,
    "outcomeStatus" "PublishedKpiOutcomeStatus" NOT NULL,
    "rawPoints" DECIMAL(14,4),
    "finalPoints" DECIMAL(14,4),
    "baseMax" DECIMAL(14,4),
    "capped" BOOLEAN NOT NULL DEFAULT false,
    "kpiRank" INTEGER,
    "rankedParticipantCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishedKpiResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_personId_key" ON "User"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "WeekPublication_splitWeekId_key" ON "WeekPublication"("splitWeekId");

-- CreateIndex
CREATE INDEX "PublishedParticipantWeeklyResult_personId_idx" ON "PublishedParticipantWeeklyResult"("personId");

-- CreateIndex
CREATE INDEX "PublishedParticipantWeeklyResult_splitId_idx" ON "PublishedParticipantWeeklyResult"("splitId");

-- CreateIndex
CREATE INDEX "PublishedParticipantWeeklyResult_splitParticipantId_idx" ON "PublishedParticipantWeeklyResult"("splitParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedParticipantWeeklyResult_publicationId_splitPartici_key" ON "PublishedParticipantWeeklyResult"("publicationId", "splitParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedKpiResult_participantWeeklyResultId_kpiCode_key" ON "PublishedKpiResult"("participantWeeklyResultId", "kpiCode");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekPublication" ADD CONSTRAINT "WeekPublication_splitWeekId_fkey" FOREIGN KEY ("splitWeekId") REFERENCES "SplitWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekPublication" ADD CONSTRAINT "WeekPublication_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedParticipantWeeklyResult" ADD CONSTRAINT "PublishedParticipantWeeklyResult_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "WeekPublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedParticipantWeeklyResult" ADD CONSTRAINT "PublishedParticipantWeeklyResult_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedParticipantWeeklyResult" ADD CONSTRAINT "PublishedParticipantWeeklyResult_splitParticipantId_fkey" FOREIGN KEY ("splitParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedParticipantWeeklyResult" ADD CONSTRAINT "PublishedParticipantWeeklyResult_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedKpiResult" ADD CONSTRAINT "PublishedKpiResult_participantWeeklyResultId_fkey" FOREIGN KEY ("participantWeeklyResultId") REFERENCES "PublishedParticipantWeeklyResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
