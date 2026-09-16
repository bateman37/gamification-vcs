-- CreateEnum
CREATE TYPE "BadgeType" AS ENUM ('MVP', 'TEAM_MVP', 'KPI');

-- CreateEnum
CREATE TYPE "BadgeAwardOrigin" AS ENUM ('LEGACY_IMPORT', 'SPLIT_FINALIZATION');

-- AlterEnum
ALTER TYPE "NewsCategory" ADD VALUE 'BADGE';

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "type" "BadgeType" NOT NULL,
    "kpiCode" "KpiCode",
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeHistoricalRecipient" (
    "id" TEXT NOT NULL,
    "datasetVersion" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "personId" TEXT,
    "linkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BadgeHistoricalRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeAward" (
    "id" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "personId" TEXT,
    "recipientId" TEXT,
    "splitId" TEXT,
    "splitLabelSnapshot" TEXT NOT NULL,
    "badgeNameSnapshot" TEXT NOT NULL,
    "origin" "BadgeAwardOrigin" NOT NULL,
    "grantedAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BadgeAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Badge_code_key" ON "Badge"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_nameNormalized_key" ON "Badge"("nameNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeHistoricalRecipient_personId_key" ON "BadgeHistoricalRecipient"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeHistoricalRecipient_datasetVersion_normalizedName_key" ON "BadgeHistoricalRecipient"("datasetVersion", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeAward_idempotencyKey_key" ON "BadgeAward"("idempotencyKey");

-- CreateIndex
CREATE INDEX "BadgeAward_personId_idx" ON "BadgeAward"("personId");

-- CreateIndex
CREATE INDEX "BadgeAward_recipientId_idx" ON "BadgeAward"("recipientId");

-- CreateIndex
CREATE INDEX "BadgeAward_badgeId_idx" ON "BadgeAward"("badgeId");

-- CreateIndex
CREATE INDEX "BadgeAward_splitId_idx" ON "BadgeAward"("splitId");

-- AddForeignKey
ALTER TABLE "BadgeHistoricalRecipient" ADD CONSTRAINT "BadgeHistoricalRecipient_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeAward" ADD CONSTRAINT "BadgeAward_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeAward" ADD CONSTRAINT "BadgeAward_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeAward" ADD CONSTRAINT "BadgeAward_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "BadgeHistoricalRecipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeAward" ADD CONSTRAINT "BadgeAward_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraint: exactamente uno de personId/recipientId (nunca ninguno, nunca los dos).
ALTER TABLE "BadgeAward" ADD CONSTRAINT "BadgeAward_owner_exclusive_check" CHECK (("personId" IS NOT NULL) <> ("recipientId" IS NOT NULL));
