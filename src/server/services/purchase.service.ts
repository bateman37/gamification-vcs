import { Prisma, type PrismaClient } from "@prisma/client";
import { DomainError } from "@/lib/errors";

/**
 * Compra de un objeto del catalogo (`0.9.0` / MVP-2D, ver
 * docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md, seccion 16 del encargo). Toda la
 * comprobacion y la escritura ocurren dentro de una unica transaccion
 * serializable: mercado, objeto, propiedad previa y saldo se vuelven a leer
 * ahi, nunca se confia en un estado calculado antes de entrar a la
 * transaccion ni en nada enviado por el navegador (precio, saldo o bonus).
 */

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";
const SERIALIZATION_FAILURE_ERROR_CODE = "P2034";

export interface PurchaseResult {
  purchaseId: string;
}

export async function purchaseStoreItem(
  db: PrismaClient,
  personId: string,
  splitParticipantId: string,
  storeItemId: string,
): Promise<PurchaseResult> {
  try {
    return await db.$transaction(
      async (tx) => {
        const participant = await tx.splitParticipant.findUnique({
          where: { id: splitParticipantId },
          include: { split: true },
        });
        if (!participant || participant.personId !== personId) {
          throw new DomainError("Esta participacion no existe o no es tuya.");
        }
        if (participant.split.status !== "ACTIVE") {
          throw new DomainError("Solo se puede comprar en un split activo.");
        }

        const settings = await tx.splitEconomySettings.findUnique({ where: { splitId: participant.splitId } });
        if (!settings || settings.marketStatus !== "OPEN") {
          throw new DomainError("El mercado esta cerrado: no se puede comprar ahora mismo.");
        }

        const item = await tx.splitStoreItem.findUnique({ where: { id: storeItemId } });
        if (!item || item.splitId !== participant.splitId) {
          throw new DomainError("El objeto indicado no pertenece a este split.");
        }
        if (!item.isForSale) {
          throw new DomainError(`"${item.name}" ya no esta disponible para la venta.`);
        }

        const alreadyOwned = await tx.splitParticipantItem.findUnique({
          where: { splitParticipantId_storeItemId: { splitParticipantId, storeItemId } },
        });
        if (alreadyOwned) {
          throw new DomainError(`Ya tienes "${item.name}".`);
        }

        const balanceResult = await tx.creditLedgerEntry.aggregate({
          where: { splitParticipantId },
          _sum: { amount: true },
        });
        const balance = balanceResult._sum.amount ?? 0;
        if (balance < item.priceCredits) {
          throw new DomainError(`Saldo insuficiente: "${item.name}" cuesta ${item.priceCredits} creditos y tienes ${balance}.`);
        }

        const slot = await tx.splitEquipmentSlot.findUnique({ where: { id: item.equipmentSlotId } });
        if (!slot) {
          throw new DomainError("La ranura de este objeto ya no existe.");
        }

        const purchase = await tx.itemPurchase.create({
          data: {
            splitParticipantId,
            storeItemId,
            itemNameSnapshot: item.name,
            priceCreditsSnapshot: item.priceCredits,
            equipmentSlotIdSnapshot: slot.id,
            equipmentSlotNameSnapshot: slot.name,
            kpiCodeSnapshot: item.kpiCode,
            bonusPercentSnapshot: item.bonusPercent,
          },
        });

        await tx.splitParticipantItem.create({
          data: { splitParticipantId, storeItemId, purchaseId: purchase.id },
        });

        await tx.creditLedgerEntry.create({
          data: {
            splitParticipantId,
            type: "PURCHASE",
            amount: -item.priceCredits,
            description: `Compra: ${item.name}`,
            purchaseId: purchase.id,
          },
        });

        return { purchaseId: purchase.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof DomainError) throw error;
    // Doble clic o compra concurrente: la restriccion unica o el fallo de serializacion nunca deben
    // duplicar el objeto ni gastar el mismo saldo dos veces (seccion 16 del encargo).
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code?: string }).code;
      if (code === UNIQUE_CONSTRAINT_ERROR_CODE) {
        throw new DomainError("Ya tienes este objeto, o la compra ya se proceso en otra peticion.");
      }
      if (code === SERIALIZATION_FAILURE_ERROR_CODE) {
        throw new DomainError("Hubo una compra simultanea. Vuelve a intentarlo.");
      }
    }
    throw error;
  }
}
