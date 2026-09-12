-- CreateEnum
CREATE TYPE "NewsOrigin" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "NewsCategory" AS ENUM ('SPLIT', 'PROFILE', 'RESULTS', 'FACTION', 'PROFESSION', 'LOCATION', 'MARKET', 'PURCHASE', 'ANNOUNCEMENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "NewsPriority" AS ENUM ('NORMAL', 'IMPORTANT');

-- CreateTable
CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL,
    "splitId" TEXT,
    "splitNameSnapshot" TEXT,
    "origin" "NewsOrigin" NOT NULL,
    "category" "NewsCategory" NOT NULL,
    "priority" "NewsPriority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "eventKey" TEXT,
    "createdByUserId" TEXT,
    "manualAudienceSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsDelivery" (
    "id" TEXT NOT NULL,
    "newsItemId" TEXT NOT NULL,
    "recipientPersonId" TEXT,
    "recipientUserId" TEXT,
    "actionPath" TEXT,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsItem_eventKey_key" ON "NewsItem"("eventKey");

-- CreateIndex
CREATE INDEX "NewsItem_splitId_category_createdAt_idx" ON "NewsItem"("splitId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "NewsDelivery_recipientPersonId_archivedAt_readAt_createdAt_idx" ON "NewsDelivery"("recipientPersonId", "archivedAt", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "NewsDelivery_recipientUserId_archivedAt_readAt_createdAt_idx" ON "NewsDelivery"("recipientUserId", "archivedAt", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsDelivery_newsItemId_recipientPersonId_key" ON "NewsDelivery"("newsItemId", "recipientPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsDelivery_newsItemId_recipientUserId_key" ON "NewsDelivery"("newsItemId", "recipientUserId");

-- AddForeignKey
ALTER TABLE "NewsItem" ADD CONSTRAINT "NewsItem_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsItem" ADD CONSTRAINT "NewsItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsDelivery" ADD CONSTRAINT "NewsDelivery_newsItemId_fkey" FOREIGN KEY ("newsItemId") REFERENCES "NewsItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsDelivery" ADD CONSTRAINT "NewsDelivery_recipientPersonId_fkey" FOREIGN KEY ("recipientPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsDelivery" ADD CONSTRAINT "NewsDelivery_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint: exactamente un destinatario por entrega (nunca ambos, nunca ninguno).
ALTER TABLE "NewsDelivery" ADD CONSTRAINT "NewsDelivery_recipient_exclusive_check" CHECK (
  ("recipientPersonId" IS NOT NULL AND "recipientUserId" IS NULL)
  OR ("recipientPersonId" IS NULL AND "recipientUserId" IS NOT NULL)
);

-- CheckConstraint: actionPath siempre construido en servidor, nunca una URL libre o externa.
ALTER TABLE "NewsDelivery" ADD CONSTRAINT "NewsDelivery_actionPath_internal_check" CHECK (
  "actionPath" IS NULL OR "actionPath" LIKE '/%'
);

-- CheckConstraint: titulo y cuerpo nunca vacios tras recorte, con un tope generoso de seguridad
-- (el limite estricto de la seccion 41 del encargo -120/600- se aplica en la validacion de servidor
-- del envio manual; las noticias automaticas pueden redactar resumenes algo mas largos).
ALTER TABLE "NewsItem" ADD CONSTRAINT "NewsItem_title_length_check" CHECK (
  length(btrim("title")) > 0 AND length("title") <= 200
);

ALTER TABLE "NewsItem" ADD CONSTRAINT "NewsItem_body_length_check" CHECK (
  length(btrim("body")) > 0 AND length("body") <= 2000
);
