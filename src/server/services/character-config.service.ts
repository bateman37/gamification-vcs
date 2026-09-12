import { Prisma, type MarketStatus, type ParticipantLevel, type PrismaClient, type SplitStatus } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { KPI_CATALOG, type KpiCode } from "@/domain/kpis/catalog";
import { toProfessionView, type ProfessionView } from "@/domain/profession-display";
import { locationBonusLabel } from "@/domain/location-bonus";
import { getEconomySettings } from "@/server/services/economy.service";
import { getParticipantBalance, listLedgerEntriesForParticipant, type LedgerEntryView } from "@/server/services/ledger.service";
import { listOwnedItemsForParticipant, type OwnedItemView } from "@/server/services/inventory.service";
import { listEquipmentForParticipant, type EquippedSlotView } from "@/server/services/equipment.service";
import { listStoreItemsForSale } from "@/server/services/store-item.service";
import { listWeekLocationsForSplit } from "@/server/services/location.service";

/**
 * Configuracion privada del personaje (`0.9.0` / MVP-2D, parte I del
 * encargo): resumen, equipo, inventario, mercado e historial de una
 * participacion de split concreta. Resuelve siempre la identidad desde
 * `session.user.personId` (comprobado por el llamador antes de invocar
 * este servicio) y comprueba ademas que la participacion pertenece a esa
 * persona.
 */

export interface StoreCatalogEntryView {
  storeItemId: string;
  name: string;
  description: string | null;
  priceCredits: number;
  equipmentSlotName: string;
  kpiCode: KpiCode;
  kpiName: string;
  bonusPercent: number;
  status: "YA_LO_TIENES" | "SALDO_INSUFICIENTE" | "DISPONIBLE" | "MERCADO_CERRADO";
}

export interface WeekLocationHistoryRow {
  weekSequenceNumber: number;
  weekStartDate: Date;
  published: boolean;
  location: { name: string; kpiName: string; bonusPercent: number } | null;
}

export interface CharacterConfigView {
  splitParticipantId: string;
  splitId: string;
  splitName: string;
  splitStatus: SplitStatus;
  alias: string;
  level: ParticipantLevel;
  faction: { name: string; color: string } | null;
  profession: ProfessionView | null;
  splitUsesProfessions: boolean;
  avatarVersion: string | null;
  editable: boolean;
  hasPublishedResults: boolean;
  totalOfficialKpiPoints: number;
  totalPositionPoints: number;
  publishedWeekCount: number;
  activeLocation: { name: string; kpiName: string; bonusLabel: string; startDate: Date; endDate: Date } | null;
  balance: number;
  marketStatus: MarketStatus;
  equipment: EquippedSlotView[];
  inventory: OwnedItemView[];
  storeCatalog: StoreCatalogEntryView[];
  ledger: LedgerEntryView[];
  weekLocations: WeekLocationHistoryRow[];
}

async function getOwnParticipationOrThrow(db: PrismaClient, personId: string, splitParticipantId: string) {
  const participation = await db.splitParticipant.findUnique({
    where: { id: splitParticipantId },
    include: {
      split: { select: { id: true, name: true, status: true } },
      faction: { select: { name: true, color: true } },
      profession: true,
      avatar: { select: { sha256: true } },
    },
  });
  if (!participation || participation.personId !== personId) {
    throw new DomainError("Esta ficha no existe o no es tuya.");
  }
  return participation;
}

export async function getCharacterConfig(
  db: PrismaClient,
  personId: string,
  splitParticipantId: string,
): Promise<CharacterConfigView> {
  const participation = await getOwnParticipationOrThrow(db, personId, splitParticipantId);
  const splitId = participation.splitId;

  const [
    professionCount,
    publishedResults,
    economySettings,
    balance,
    equipment,
    inventory,
    storeItemsForSale,
    ledger,
    weeks,
    weekLocations,
    publications,
  ] = await Promise.all([
    db.splitProfession.count({ where: { splitId } }),
    db.publishedParticipantWeeklyResult.findMany({ where: { splitParticipantId } }),
    getEconomySettings(db, splitId),
    getParticipantBalance(db, splitParticipantId),
    listEquipmentForParticipant(db, splitParticipantId, splitId),
    listOwnedItemsForParticipant(db, splitParticipantId),
    listStoreItemsForSale(db, splitId),
    listLedgerEntriesForParticipant(db, splitParticipantId),
    db.splitWeek.findMany({ where: { splitId }, orderBy: { sequenceNumber: "asc" } }),
    listWeekLocationsForSplit(db, splitId),
    db.weekPublication.findMany({ where: { splitWeek: { splitId } } }),
  ]);

  const totalOfficialKpiPoints = publishedResults.reduce((sum, row) => sum.plus(row.totalKpiPoints), new Prisma.Decimal(0)).toNumber();
  const totalPositionPoints = publishedResults.reduce((sum, row) => sum + row.positionPoints, 0);

  const ownedItemIds = new Set(inventory.map((item) => item.storeItemId));
  const storeCatalog: StoreCatalogEntryView[] = storeItemsForSale.map((item) => {
    let status: StoreCatalogEntryView["status"];
    if (economySettings.marketStatus !== "OPEN") status = "MERCADO_CERRADO";
    else if (ownedItemIds.has(item.id)) status = "YA_LO_TIENES";
    else if (balance < item.priceCredits) status = "SALDO_INSUFICIENTE";
    else status = "DISPONIBLE";

    return {
      storeItemId: item.id,
      name: item.name,
      description: item.description,
      priceCredits: item.priceCredits,
      equipmentSlotName: item.equipmentSlotName,
      kpiCode: item.kpiCode,
      kpiName: KPI_CATALOG[item.kpiCode].name,
      bonusPercent: item.bonusPercent,
      status,
    };
  });

  const publicationByWeekId = new Map(publications.map((publication) => [publication.splitWeekId, publication]));
  const liveLocationByWeekId = new Map(weekLocations.map((location) => [location.splitWeekId, location]));
  const weekLocationRows: WeekLocationHistoryRow[] = weeks.map((week) => {
    const publication = publicationByWeekId.get(week.id);
    if (publication) {
      return {
        weekSequenceNumber: week.sequenceNumber,
        weekStartDate: week.startDate,
        published: true,
        location:
          publication.locationNameSnapshot && publication.locationKpiCodeSnapshot && publication.locationBonusPercentSnapshot
            ? {
                name: publication.locationNameSnapshot,
                kpiName: KPI_CATALOG[publication.locationKpiCodeSnapshot].name,
                bonusPercent: publication.locationBonusPercentSnapshot,
              }
            : null,
      };
    }
    const live = liveLocationByWeekId.get(week.id);
    return {
      weekSequenceNumber: week.sequenceNumber,
      weekStartDate: week.startDate,
      published: false,
      location: live ? { name: live.name, kpiName: KPI_CATALOG[live.kpiCode].name, bonusPercent: live.bonusPercent } : null,
    };
  });

  // Localizacion activa esta semana: solo si el split esta ACTIVE, la semana actual tiene
  // localizacion y esta participacion es aplicable esa semana (mismo criterio que participant-profile.service.ts).
  let activeLocation: CharacterConfigView["activeLocation"] = null;
  if (participation.split.status === "ACTIVE") {
    const now = new Date();
    const currentWeek = weeks.find((week) => now.getTime() >= week.startDate.getTime() && now.getTime() <= week.endDate.getTime());
    if (currentWeek) {
      const live = liveLocationByWeekId.get(currentWeek.id);
      const isApplicable =
        participation.startWeekSequenceNumber <= currentWeek.sequenceNumber &&
        (participation.endWeekSequenceNumber === null || participation.endWeekSequenceNumber >= currentWeek.sequenceNumber);
      if (live && isApplicable) {
        activeLocation = {
          name: live.name,
          kpiName: KPI_CATALOG[live.kpiCode].name,
          bonusLabel: locationBonusLabel(live.bonusPercent),
          startDate: currentWeek.startDate,
          endDate: currentWeek.endDate,
        };
      }
    }
  }

  return {
    splitParticipantId: participation.id,
    splitId: participation.splitId,
    splitName: participation.split.name,
    splitStatus: participation.split.status,
    alias: participation.alias,
    level: participation.level,
    faction: participation.faction,
    profession: participation.profession ? toProfessionView(participation.profession) : null,
    splitUsesProfessions: professionCount > 0,
    avatarVersion: participation.avatar?.sha256 ?? null,
    editable: participation.split.status !== "CLOSED",
    hasPublishedResults: publishedResults.length > 0,
    totalOfficialKpiPoints,
    totalPositionPoints,
    publishedWeekCount: publishedResults.length,
    activeLocation,
    balance,
    marketStatus: economySettings.marketStatus,
    equipment,
    inventory,
    storeCatalog,
    ledger,
    weekLocations: weekLocationRows,
  };
}
