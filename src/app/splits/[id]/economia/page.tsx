import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { getSplitById } from "@/server/services/split.service";
import { listKpiConfigsForSplit } from "@/server/services/kpi.service";
import { collectMarketOpenIssues, getEconomySettings } from "@/server/services/economy.service";
import { getEquipmentSlotBoard } from "@/server/services/equipment-slot.service";
import { listStoreItemsForSplit } from "@/server/services/store-item.service";
import { listEconomySummaryForSplit } from "@/server/services/ledger.service";
import { KPI_CATALOG } from "@/domain/kpis/catalog";
import { Badge } from "@/components/ui";
import { MarketToggleButton } from "./MarketToggleButton";
import { AdminSlotPositionEditor, type AdminSlotRow } from "./AdminSlotPositionEditor";
import { StoreItemsPanel } from "./StoreItemsPanel";
import { EconomySummaryPanel } from "./EconomySummaryPanel";

/**
 * Administracion detallada de economia y mercado (`0.9.0` / MVP-2D, parte B
 * del encargo). Enlazada desde una tarjeta compacta en `/splits/[id]`
 * (seccion 8: "enlace a una vista administrativa detallada si la seccion
 * queda demasiado cargada").
 */
export default async function SplitEconomyPage({ params }: { params: { id: string } }) {
  await requireAdminSession();
  const split = await getSplitById(prisma, params.id);
  if (!split) notFound();

  const [settings, openIssues, board, items, kpiConfigs, summary] = await Promise.all([
    getEconomySettings(prisma, split.id),
    collectMarketOpenIssues(prisma, split.id),
    getEquipmentSlotBoard(prisma, split.id),
    listStoreItemsForSplit(prisma, split.id),
    listKpiConfigsForSplit(prisma, split.id),
    listEconomySummaryForSplit(prisma, split.id),
  ]);

  const activeKpis = kpiConfigs.filter((config) => config.isActive).map((config) => ({ code: config.kpiCode, name: KPI_CATALOG[config.kpiCode].name }));

  // DTO minima para el Client Component: solo ids opacos, nombre visible, posicion,
  // estado y contadores. Nunca bytes de imagen ni datos de otros participantes.
  const toSlotRow = (slot: (typeof board.unplacedSlots)[number]): AdminSlotRow => ({
    id: slot.id,
    name: slot.name,
    visualPosition: slot.visualPosition,
    isActive: slot.isActive,
    storeItemCount: slot.storeItemCount,
    itemsForSaleCount: slot.itemsForSaleCount,
    ownerCount: slot.ownerCount,
    equippedCount: slot.equippedCount,
  });
  const positionRows = board.positions.map((entry) => ({
    position: entry.position,
    baseName: entry.baseName,
    slot: entry.slot ? toSlotRow(entry.slot) : null,
  }));
  const unplacedSlotRows = board.unplacedSlots.map(toSlotRow);

  // Un objeto solo puede asociarse a una ranura activa (ver store-item.service.ts).
  const slotOptions = board.positions
    .map((entry) => entry.slot)
    .concat(board.unplacedSlots)
    .filter((slot): slot is NonNullable<typeof slot> => slot !== null && slot !== undefined && slot.isActive)
    .map((slot) => ({ id: slot.id, name: slot.name }));

  const itemRows = items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    priceCredits: item.priceCredits,
    equipmentSlotId: item.equipmentSlotId,
    equipmentSlotName: item.equipmentSlotName,
    equipmentSlotVisualPosition: item.equipmentSlotVisualPosition,
    equipmentSlotIsActive: item.equipmentSlotIsActive,
    kpiCode: item.kpiCode,
    kpiName: KPI_CATALOG[item.kpiCode].name,
    bonusPercent: item.bonusPercent,
    isForSale: item.isForSale,
    ownedCount: item.ownedCount,
    imageVersion: item.imageVersion,
  }));

  const structureLocked = settings.marketStatus === "OPEN" || split.status === "CLOSED";

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/splits/${split.id}`} className="text-sm text-text-muted underline hover:text-ink">
          &larr; Volver a {split.name}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">Economía y mercado</h1>
          <Badge tone={settings.marketStatus === "OPEN" ? "green" : "gray"}>
            {settings.marketStatus === "OPEN" ? "Mercado abierto" : "Mercado cerrado"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-text-muted">
          1 crédito equivale a 1 punto KPI completo publicado. Los créditos se generan exclusivamente al publicar una
          semana.
        </p>
      </div>

      <section className="space-y-3">
        <MarketToggleButton splitId={split.id} marketStatus={settings.marketStatus} openIssues={openIssues} />
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <AdminSlotPositionEditor
          splitId={split.id}
          positions={positionRows}
          unplacedSlots={unplacedSlotRows}
          locked={structureLocked}
        />
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <StoreItemsPanel splitId={split.id} items={itemRows} locked={structureLocked} activeKpis={activeKpis} slots={slotOptions} />
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h3 className="text-base font-semibold">Resumen de compras y créditos</h3>
        <EconomySummaryPanel summary={summary} />
      </section>
    </div>
  );
}
