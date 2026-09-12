-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('CLOSED', 'OPEN');

-- CreateEnum
CREATE TYPE "CreditMovementType" AS ENUM ('WEEKLY_EARNING', 'PURCHASE');

-- AlterTable
ALTER TABLE "PublishedKpiResult" ADD COLUMN     "equipmentApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "equipmentBonusPoints" DECIMAL(14,4);

-- AlterTable
ALTER TABLE "PublishedParticipantWeeklyResult" ADD COLUMN     "creditsEarned" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SplitEconomySettings" (
    "splitId" TEXT NOT NULL,
    "marketStatus" "MarketStatus" NOT NULL DEFAULT 'CLOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplitEconomySettings_pkey" PRIMARY KEY ("splitId")
);

-- CreateTable
CREATE TABLE "SplitEquipmentSlot" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplitEquipmentSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitStoreItem" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "description" TEXT,
    "priceCredits" INTEGER NOT NULL,
    "equipmentSlotId" TEXT NOT NULL,
    "kpiCode" "KpiCode" NOT NULL,
    "bonusPercent" INTEGER NOT NULL,
    "isForSale" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplitStoreItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemPurchase" (
    "id" TEXT NOT NULL,
    "splitParticipantId" TEXT NOT NULL,
    "storeItemId" TEXT NOT NULL,
    "itemNameSnapshot" TEXT NOT NULL,
    "priceCreditsSnapshot" INTEGER NOT NULL,
    "equipmentSlotIdSnapshot" TEXT NOT NULL,
    "equipmentSlotNameSnapshot" TEXT NOT NULL,
    "kpiCodeSnapshot" "KpiCode" NOT NULL,
    "bonusPercentSnapshot" INTEGER NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitParticipantItem" (
    "id" TEXT NOT NULL,
    "splitParticipantId" TEXT NOT NULL,
    "storeItemId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SplitParticipantItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitParticipantEquippedItem" (
    "splitParticipantId" TEXT NOT NULL,
    "equipmentSlotId" TEXT NOT NULL,
    "ownedItemId" TEXT NOT NULL,
    "equippedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplitParticipantEquippedItem_pkey" PRIMARY KEY ("splitParticipantId","equipmentSlotId")
);

-- CreateTable
CREATE TABLE "CreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "splitParticipantId" TEXT NOT NULL,
    "type" "CreditMovementType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "publishedResultId" TEXT,
    "purchaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedEquippedItem" (
    "id" TEXT NOT NULL,
    "participantWeeklyResultId" TEXT NOT NULL,
    "storeItemId" TEXT,
    "itemNameSnapshot" TEXT NOT NULL,
    "equipmentSlotId" TEXT,
    "equipmentSlotNameSnapshot" TEXT NOT NULL,
    "kpiCodeSnapshot" "KpiCode" NOT NULL,
    "bonusPercentSnapshot" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishedEquippedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SplitEquipmentSlot_splitId_nameNormalized_key" ON "SplitEquipmentSlot"("splitId", "nameNormalized");

-- CreateIndex
CREATE INDEX "SplitStoreItem_splitId_equipmentSlotId_idx" ON "SplitStoreItem"("splitId", "equipmentSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "SplitStoreItem_splitId_nameNormalized_key" ON "SplitStoreItem"("splitId", "nameNormalized");

-- CreateIndex
CREATE INDEX "ItemPurchase_splitParticipantId_idx" ON "ItemPurchase"("splitParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemPurchase_splitParticipantId_storeItemId_key" ON "ItemPurchase"("splitParticipantId", "storeItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SplitParticipantItem_purchaseId_key" ON "SplitParticipantItem"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "SplitParticipantItem_splitParticipantId_storeItemId_key" ON "SplitParticipantItem"("splitParticipantId", "storeItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SplitParticipantEquippedItem_ownedItemId_key" ON "SplitParticipantEquippedItem"("ownedItemId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedgerEntry_publishedResultId_key" ON "CreditLedgerEntry"("publishedResultId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedgerEntry_purchaseId_key" ON "CreditLedgerEntry"("purchaseId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_splitParticipantId_createdAt_idx" ON "CreditLedgerEntry"("splitParticipantId", "createdAt");

-- CreateIndex
CREATE INDEX "PublishedEquippedItem_participantWeeklyResultId_idx" ON "PublishedEquippedItem"("participantWeeklyResultId");

-- AddForeignKey
ALTER TABLE "SplitEconomySettings" ADD CONSTRAINT "SplitEconomySettings_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitEquipmentSlot" ADD CONSTRAINT "SplitEquipmentSlot_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitStoreItem" ADD CONSTRAINT "SplitStoreItem_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitStoreItem" ADD CONSTRAINT "SplitStoreItem_equipmentSlotId_fkey" FOREIGN KEY ("equipmentSlotId") REFERENCES "SplitEquipmentSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPurchase" ADD CONSTRAINT "ItemPurchase_splitParticipantId_fkey" FOREIGN KEY ("splitParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPurchase" ADD CONSTRAINT "ItemPurchase_storeItemId_fkey" FOREIGN KEY ("storeItemId") REFERENCES "SplitStoreItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitParticipantItem" ADD CONSTRAINT "SplitParticipantItem_splitParticipantId_fkey" FOREIGN KEY ("splitParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitParticipantItem" ADD CONSTRAINT "SplitParticipantItem_storeItemId_fkey" FOREIGN KEY ("storeItemId") REFERENCES "SplitStoreItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitParticipantItem" ADD CONSTRAINT "SplitParticipantItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "ItemPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitParticipantEquippedItem" ADD CONSTRAINT "SplitParticipantEquippedItem_splitParticipantId_fkey" FOREIGN KEY ("splitParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitParticipantEquippedItem" ADD CONSTRAINT "SplitParticipantEquippedItem_equipmentSlotId_fkey" FOREIGN KEY ("equipmentSlotId") REFERENCES "SplitEquipmentSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitParticipantEquippedItem" ADD CONSTRAINT "SplitParticipantEquippedItem_ownedItemId_fkey" FOREIGN KEY ("ownedItemId") REFERENCES "SplitParticipantItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_splitParticipantId_fkey" FOREIGN KEY ("splitParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_publishedResultId_fkey" FOREIGN KEY ("publishedResultId") REFERENCES "PublishedParticipantWeeklyResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "ItemPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedEquippedItem" ADD CONSTRAINT "PublishedEquippedItem_participantWeeklyResultId_fkey" FOREIGN KEY ("participantWeeklyResultId") REFERENCES "PublishedParticipantWeeklyResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedEquippedItem" ADD CONSTRAINT "PublishedEquippedItem_storeItemId_fkey" FOREIGN KEY ("storeItemId") REFERENCES "SplitStoreItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedEquippedItem" ADD CONSTRAINT "PublishedEquippedItem_equipmentSlotId_fkey" FOREIGN KEY ("equipmentSlotId") REFERENCES "SplitEquipmentSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraint: el nombre de la ranura nunca puede quedar vacio tras recortar espacios exteriores.
ALTER TABLE "SplitEquipmentSlot" ADD CONSTRAINT "SplitEquipmentSlot_nameNormalized_not_blank_check" CHECK (length(btrim("nameNormalized")) > 0);

-- CheckConstraint: el orden de presentacion de una ranura nunca es negativo.
ALTER TABLE "SplitEquipmentSlot" ADD CONSTRAINT "SplitEquipmentSlot_displayOrder_nonnegative_check" CHECK ("displayOrder" >= 0);

-- CheckConstraint: el nombre de un objeto nunca puede quedar vacio tras recortar espacios exteriores.
ALTER TABLE "SplitStoreItem" ADD CONSTRAINT "SplitStoreItem_nameNormalized_not_blank_check" CHECK (length(btrim("nameNormalized")) > 0);

-- CheckConstraint: el precio de un objeto es siempre un entero positivo (seccion 12 del encargo).
ALTER TABLE "SplitStoreItem" ADD CONSTRAINT "SplitStoreItem_priceCredits_positive_check" CHECK ("priceCredits" > 0);

-- CheckConstraint: el bonus de un objeto solo puede ser uno de los cinco porcentajes cerrados (misma lista que localizaciones).
ALTER TABLE "SplitStoreItem" ADD CONSTRAINT "SplitStoreItem_bonusPercent_allowed_check" CHECK ("bonusPercent" IN (10, 20, 30, 40, 50));

-- CheckConstraint: el precio y el bonus congelados en una compra respetan las mismas reglas que el objeto en el momento de comprarlo.
ALTER TABLE "ItemPurchase" ADD CONSTRAINT "ItemPurchase_priceCreditsSnapshot_positive_check" CHECK ("priceCreditsSnapshot" > 0);
ALTER TABLE "ItemPurchase" ADD CONSTRAINT "ItemPurchase_bonusPercentSnapshot_allowed_check" CHECK ("bonusPercentSnapshot" IN (10, 20, 30, 40, 50));

-- CheckConstraint: el signo del importe depende del tipo de movimiento (seccion 4 del encargo): ganancia semanal nunca negativa, compra siempre negativa.
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_amount_sign_check" CHECK (
  ("type" = 'WEEKLY_EARNING' AND "amount" >= 0) OR ("type" = 'PURCHASE' AND "amount" < 0)
);

-- CheckConstraint: cada movimiento tiene exactamente una referencia de origen, coherente con su tipo.
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_source_ref_check" CHECK (
  ("type" = 'WEEKLY_EARNING' AND "publishedResultId" IS NOT NULL AND "purchaseId" IS NULL) OR
  ("type" = 'PURCHASE' AND "purchaseId" IS NOT NULL AND "publishedResultId" IS NULL)
);

-- CheckConstraint: el porcentaje de un objeto congelado en una publicacion respeta el mismo conjunto cerrado.
ALTER TABLE "PublishedEquippedItem" ADD CONSTRAINT "PublishedEquippedItem_bonusPercentSnapshot_allowed_check" CHECK ("bonusPercentSnapshot" IN (10, 20, 30, 40, 50));

-- CheckConstraint: los creditos ganados nunca son negativos (seccion 2 del encargo: max(0, floor(totalKpiPoints))).
ALTER TABLE "PublishedParticipantWeeklyResult" ADD CONSTRAINT "PublishedParticipantWeeklyResult_creditsEarned_nonnegative_check" CHECK ("creditsEarned" >= 0);

-- DataMigration: todo split, nuevo o existente antes de esta version, empieza con el mercado cerrado (seccion 6 del encargo).
-- Idempotente: no inserta de nuevo si la fila de configuracion ya existe (redeploy seguro).
INSERT INTO "SplitEconomySettings" ("splitId", "marketStatus", "createdAt", "updatedAt")
SELECT "id", 'CLOSED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Split"
ON CONFLICT ("splitId") DO NOTHING;

-- DataMigration: backfill del libro de creditos para toda semana ya publicada antes de esta version (seccion 5 del
-- encargo). Usa exclusivamente "totalKpiPoints" ya publicado (nunca recalcula KPI, bonus ni posiciones), aplica
-- max(0, floor(totalKpiPoints)) y crea un unico movimiento WEEKLY_EARNING por resultado, incluido uno de importe 0
-- cuando corresponda. Idempotente: "WHERE NOT EXISTS" evita duplicar el movimiento si esta migracion se repitiera.
INSERT INTO "CreditLedgerEntry" ("id", "splitParticipantId", "type", "amount", "description", "publishedResultId", "createdAt")
SELECT
  gen_random_uuid(),
  r."splitParticipantId",
  'WEEKLY_EARNING',
  GREATEST(FLOOR(r."totalKpiPoints")::int, 0),
  'Creditos de la semana (backfill 0.9.0 / MVP-2D)',
  r."id",
  p."publishedAt"
FROM "PublishedParticipantWeeklyResult" r
JOIN "WeekPublication" p ON p."id" = r."publicationId"
WHERE NOT EXISTS (
  SELECT 1 FROM "CreditLedgerEntry" e WHERE e."publishedResultId" = r."id"
);

-- DataMigration: sincroniza el campo "creditsEarned" congelado con el mismo calculo del backfill anterior, para toda
-- publicacion existente (incluidas las anteriores a profesiones y localizaciones).
UPDATE "PublishedParticipantWeeklyResult"
SET "creditsEarned" = GREATEST(FLOOR("totalKpiPoints")::int, 0)
WHERE "creditsEarned" <> GREATEST(FLOOR("totalKpiPoints")::int, 0);
