-- AlterTable
ALTER TABLE "PublishedParticipantWeeklyResult" ADD COLUMN     "factionColorSnapshot" TEXT,
ADD COLUMN     "factionId" TEXT,
ADD COLUMN     "factionNameSnapshot" TEXT;

-- AlterTable
ALTER TABLE "SplitParticipant" ADD COLUMN     "factionId" TEXT;

-- CreateTable
CREATE TABLE "SplitFaction" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplitFaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SplitFaction_splitId_nameNormalized_key" ON "SplitFaction"("splitId", "nameNormalized");

-- CreateIndex
CREATE INDEX "PublishedParticipantWeeklyResult_factionId_idx" ON "PublishedParticipantWeeklyResult"("factionId");

-- CreateIndex
CREATE INDEX "SplitParticipant_factionId_idx" ON "SplitParticipant"("factionId");

-- AddForeignKey
ALTER TABLE "SplitParticipant" ADD CONSTRAINT "SplitParticipant_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "SplitFaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitFaction" ADD CONSTRAINT "SplitFaction_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedParticipantWeeklyResult" ADD CONSTRAINT "PublishedParticipantWeeklyResult_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "SplitFaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint: el color de una faccion siempre es un hexadecimal "#RRGGBB" (ver docs/FACTIONS.md).
ALTER TABLE "SplitFaction" ADD CONSTRAINT "SplitFaction_color_format_check" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$');

-- CheckConstraint: el nombre normalizado nunca queda vacio (igual que el alias de participante).
ALTER TABLE "SplitFaction" ADD CONSTRAINT "SplitFaction_nameNormalized_not_blank_check" CHECK (length(trim("nameNormalized")) > 0);
