-- CreateEnum
CREATE TYPE "SplitStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ParticipantLevel" AS ENUM ('N0', 'N1', 'N2');

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Split" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATE NOT NULL,
    "numberOfWeeks" INTEGER NOT NULL,
    "status" "SplitStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Split_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitWeek" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplitWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitParticipant" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "aliasNormalized" TEXT NOT NULL,
    "level" "ParticipantLevel" NOT NULL,
    "startWeekSequenceNumber" INTEGER NOT NULL,
    "endWeekSequenceNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplitParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_email_key" ON "Person"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SplitWeek_splitId_sequenceNumber_key" ON "SplitWeek"("splitId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SplitParticipant_splitId_personId_key" ON "SplitParticipant"("splitId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "SplitParticipant_splitId_aliasNormalized_key" ON "SplitParticipant"("splitId", "aliasNormalized");

-- AddForeignKey
ALTER TABLE "SplitWeek" ADD CONSTRAINT "SplitWeek_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitParticipant" ADD CONSTRAINT "SplitParticipant_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitParticipant" ADD CONSTRAINT "SplitParticipant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitParticipant" ADD CONSTRAINT "SplitParticipant_splitId_startWeekSequenceNumber_fkey" FOREIGN KEY ("splitId", "startWeekSequenceNumber") REFERENCES "SplitWeek"("splitId", "sequenceNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint: el numero de semanas de un split debe ser razonable (1-52).
ALTER TABLE "Split" ADD CONSTRAINT "Split_numberOfWeeks_range_check" CHECK ("numberOfWeeks" BETWEEN 1 AND 52);

-- CheckConstraint: la fecha de inicio de un split debe ser lunes (ISO DOW 1).
ALTER TABLE "Split" ADD CONSTRAINT "Split_startDate_is_monday_check" CHECK (EXTRACT(ISODOW FROM "startDate") = 1);

-- CheckConstraint: cada semana de un split debe comenzar en lunes y terminar en domingo.
ALTER TABLE "SplitWeek" ADD CONSTRAINT "SplitWeek_startDate_is_monday_check" CHECK (EXTRACT(ISODOW FROM "startDate") = 1);
ALTER TABLE "SplitWeek" ADD CONSTRAINT "SplitWeek_endDate_is_sunday_check" CHECK (EXTRACT(ISODOW FROM "endDate") = 7);
ALTER TABLE "SplitWeek" ADD CONSTRAINT "SplitWeek_sequenceNumber_positive_check" CHECK ("sequenceNumber" > 0);

-- CheckConstraint: el alias normalizado nunca puede quedar vacio.
ALTER TABLE "SplitParticipant" ADD CONSTRAINT "SplitParticipant_aliasNormalized_not_blank_check" CHECK (length(btrim("aliasNormalized")) > 0);
ALTER TABLE "SplitParticipant" ADD CONSTRAINT "SplitParticipant_startWeekSequenceNumber_positive_check" CHECK ("startWeekSequenceNumber" > 0);
