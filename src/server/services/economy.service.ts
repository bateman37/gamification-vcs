import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type SplitEconomySettings } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { KPI_CATALOG } from "@/domain/kpis/catalog";
import { isAllowedEquipmentBonusPercent } from "@/domain/equipment-bonus";
import { createNewsWithDeliveries, resolveActiveAdminUserIds, resolveAllParticipantsForSplit } from "@/server/services/news.service";
import { buildNewsActionPath } from "@/domain/news-links";
import {
  marketOpenedNewsTemplateForParticipant,
  marketClosedNewsTemplateForParticipant,
  adminMarketOpenedNewsTemplate,
  adminMarketClosedNewsTemplate,
} from "@/domain/news-templates";

/**
 * Mercado del split (`0.9.0` / MVP-2D, ver
 * docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md, parte B del encargo). Todo split,
 * nuevo o migrado, empieza con el mercado `CERRADO`. Abrir/cerrar solo lo
 * puede hacer un administrador (comprobado en la Server Action), y abrir
 * exige una configuracion completa y valida (seccion 7 del encargo).
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** Configuracion economica del split. Nunca lanza: un split sin fila propia se trata como mercado cerrado. */
export async function getEconomySettings(db: Db, splitId: string): Promise<SplitEconomySettings> {
  const existing = await db.splitEconomySettings.findUnique({ where: { splitId } });
  if (existing) return existing;
  return { splitId, marketStatus: "CLOSED", createdAt: new Date(), updatedAt: new Date() };
}

export async function isMarketOpen(db: Db, splitId: string): Promise<boolean> {
  const settings = await getEconomySettings(db, splitId);
  return settings.marketStatus === "OPEN";
}

/**
 * Problemas que impiden abrir el mercado (seccion 7 del encargo). Devuelve
 * la lista completa en vez de lanzar en el primer error, para poder
 * mostrarla entera al administrador.
 */
export async function collectMarketOpenIssues(db: Db, splitId: string): Promise<string[]> {
  const issues: string[] = [];
  const split = await db.split.findUnique({ where: { id: splitId } });
  if (!split) {
    return ["El split indicado no existe."];
  }
  if (split.status !== "ACTIVE") {
    issues.push("El split debe estar activo para abrir el mercado.");
  }

  const slotCount = await db.splitEquipmentSlot.count({ where: { splitId } });
  if (slotCount === 0) {
    issues.push("Crea al menos una ranura de equipo antes de abrir el mercado.");
  }

  const itemsForSale = await db.splitStoreItem.findMany({ where: { splitId, isForSale: true } });
  if (itemsForSale.length === 0) {
    issues.push("Crea al menos un objeto disponible para comprar antes de abrir el mercado.");
  }

  if (itemsForSale.length > 0) {
    const kpiConfigs = await db.splitKpiConfig.findMany({ where: { splitId } });
    const activeByCode = new Map(kpiConfigs.map((config) => [config.kpiCode, config.isActive]));
    for (const item of itemsForSale) {
      if (!activeByCode.get(item.kpiCode)) {
        issues.push(
          `El objeto "${item.name}" potencia un KPI inactivo (${KPI_CATALOG[item.kpiCode].name}): actívalo o retíralo de la venta.`,
        );
      }
      if (!isAllowedEquipmentBonusPercent(item.bonusPercent)) {
        issues.push(`El objeto "${item.name}" tiene un porcentaje de bonus no valido.`);
      }
      if (item.priceCredits <= 0) {
        issues.push(`El objeto "${item.name}" tiene un precio no valido.`);
      }
    }
  }

  return issues;
}

function assertSplitAllowsMarketToggle(split: { status: string }): void {
  if (split.status === "CLOSED") {
    throw new DomainError("El split esta cerrado: el mercado queda en solo lectura.");
  }
}

export async function openMarket(db: PrismaClient, splitId: string): Promise<SplitEconomySettings> {
  return db.$transaction(
    async (tx) => {
      const split = await tx.split.findUnique({ where: { id: splitId } });
      if (!split) throw new DomainError("El split indicado no existe.");
      assertSplitAllowsMarketToggle(split);

      const current = await getEconomySettings(tx, splitId);
      if (current.marketStatus === "OPEN") {
        // Sin cambio real (`OPEN -> OPEN`): nunca se notifica (seccion 48 del encargo).
        return tx.splitEconomySettings.upsert({ where: { splitId }, create: { splitId, marketStatus: "OPEN" }, update: { marketStatus: "OPEN" } });
      }

      const issues = await collectMarketOpenIssues(tx, splitId);
      if (issues.length > 0) {
        throw new DomainError(`No se puede abrir el mercado: ${issues.join(" ")}`);
      }

      const settings = await tx.splitEconomySettings.upsert({
        where: { splitId },
        create: { splitId, marketStatus: "OPEN" },
        update: { marketStatus: "OPEN" },
      });

      const itemCount = await tx.splitStoreItem.count({ where: { splitId, isForSale: true } });
      const operationId = randomUUID();

      const participants = await resolveAllParticipantsForSplit(tx, splitId);
      if (participants.length > 0) {
        const text = marketOpenedNewsTemplateForParticipant({ itemCount });
        await createNewsWithDeliveries(
          tx,
          { splitId, splitNameSnapshot: split.name, origin: "AUTOMATIC", category: "MARKET", title: text.title, body: text.body, eventKey: `market-opened:${operationId}` },
          participants.map((p) => ({ personId: p.personId, actionPath: buildNewsActionPath({ kind: "MARKET", splitParticipantId: p.splitParticipantId }, "PERSON") })),
        );
      }

      const adminUserIds = await resolveActiveAdminUserIds(tx);
      if (adminUserIds.length > 0) {
        const adminText = adminMarketOpenedNewsTemplate({ splitName: split.name, itemCount });
        await createNewsWithDeliveries(
          tx,
          { splitId, splitNameSnapshot: split.name, origin: "AUTOMATIC", category: "ADMIN", title: adminText.title, body: adminText.body, eventKey: `admin-market-opened:${operationId}` },
          adminUserIds.map((userId) => ({ userId, actionPath: buildNewsActionPath({ kind: "SPLIT_ECONOMY_ADMIN", splitId }, "USER") })),
        );
      }

      return settings;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function closeMarket(db: PrismaClient, splitId: string): Promise<SplitEconomySettings> {
  return db.$transaction(
    async (tx) => {
      const split = await tx.split.findUnique({ where: { id: splitId } });
      if (!split) throw new DomainError("El split indicado no existe.");
      assertSplitAllowsMarketToggle(split);

      const current = await getEconomySettings(tx, splitId);
      if (current.marketStatus === "CLOSED") {
        return tx.splitEconomySettings.upsert({ where: { splitId }, create: { splitId, marketStatus: "CLOSED" }, update: { marketStatus: "CLOSED" } });
      }

      const settings = await tx.splitEconomySettings.upsert({
        where: { splitId },
        create: { splitId, marketStatus: "CLOSED" },
        update: { marketStatus: "CLOSED" },
      });

      const operationId = randomUUID();

      const participants = await resolveAllParticipantsForSplit(tx, splitId);
      if (participants.length > 0) {
        const text = marketClosedNewsTemplateForParticipant();
        await createNewsWithDeliveries(
          tx,
          { splitId, splitNameSnapshot: split.name, origin: "AUTOMATIC", category: "MARKET", title: text.title, body: text.body, eventKey: `market-closed:${operationId}` },
          participants.map((p) => ({ personId: p.personId, actionPath: buildNewsActionPath({ kind: "MARKET", splitParticipantId: p.splitParticipantId }, "PERSON") })),
        );
      }

      const adminUserIds = await resolveActiveAdminUserIds(tx);
      if (adminUserIds.length > 0) {
        const adminText = adminMarketClosedNewsTemplate({ splitName: split.name });
        await createNewsWithDeliveries(
          tx,
          { splitId, splitNameSnapshot: split.name, origin: "AUTOMATIC", category: "ADMIN", title: adminText.title, body: adminText.body, eventKey: `admin-market-closed:${operationId}` },
          adminUserIds.map((userId) => ({ userId, actionPath: buildNewsActionPath({ kind: "SPLIT_ECONOMY_ADMIN", splitId }, "USER") })),
        );
      }

      return settings;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
