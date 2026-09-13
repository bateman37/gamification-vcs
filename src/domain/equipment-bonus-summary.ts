import type { KpiCode } from "@/domain/kpis/catalog";
import { KPI_CATALOG } from "@/domain/kpis/catalog";
import { PROFESSION_BONUS_PERCENT } from "@/domain/profession-bonus";
import { equipmentVisualPositionOrder } from "@/domain/equipment-visual-positions";
import type { EquipmentVisualPosition } from "@prisma/client";

/**
 * Panel "Bonificadores activos" de la ficha (`1.2.0`, seccion 10 del
 * encargo). Funcion **pura y declarativa**: agrega los porcentajes
 * configurados de las tres fuentes (profesion, localizacion y equipo) por
 * KPI, para que el jugador entienda que potencia a su personaje sin hacer
 * cuentas mentales.
 *
 * Lo que este modulo NO es:
 *
 * - no es una calculadora de resultados semanales: no conoce datos de KPI,
 *   maximos, `Prisma.Decimal` ni puntos reales;
 * - no reimplementa el motor de resultados
 *   (`src/server/services/weekly-results.service.ts`), que sigue siendo el
 *   unico sitio donde se calculan puntos oficiales;
 * - nunca encadena porcentajes. Las tres capas actuan sobre el mismo
 *   `baseFinalPoints` y se suman una sola vez, asi que agregarlas aqui es
 *   tambien una suma aritmetica: `20 % + 50 % + 40 % + 40 % = 150 %`, nunca
 *   `1,2 x 1,5 x 1,4 x 1,4`.
 */

export type BonusSourceKind = "PROFESSION" | "LOCATION" | "EQUIPMENT";

/** Un objeto del borrador (o del equipo confirmado) que aporta bonus. */
export interface EquipmentBonusSummaryItem {
  ownedItemId: string;
  storeItemId: string;
  itemName: string;
  equipmentSlotId: string;
  equipmentSlotName: string;
  visualPosition: EquipmentVisualPosition | null;
  /** Orden de la ranura historica sin ubicar; solo se usa cuando `visualPosition` es `null`. */
  slotDisplayOrder: number;
  kpiCode: KpiCode;
  bonusPercent: number;
  /** Version (`sha256`) de la imagen del objeto, o `null` si no tiene. Nunca los bytes. */
  imageVersion: string | null;
}

export interface BonusSummaryProfession {
  name: string;
  kpiCodeA: KpiCode;
  kpiCodeB: KpiCode;
}

export interface BonusSummaryLocation {
  name: string;
  kpiCode: KpiCode;
  bonusPercent: number;
}

export interface BonusSummaryInput {
  /** Objetos del borrador actual (no del equipo confirmado, mientras haya cambios sin confirmar). */
  equippedItems: readonly EquipmentBonusSummaryItem[];
  profession: BonusSummaryProfession | null;
  location: BonusSummaryLocation | null;
}

export interface BonusSummaryEquipmentEntry {
  ownedItemId: string;
  itemName: string;
  equipmentSlotName: string;
  bonusPercent: number;
  imageVersion: string | null;
  storeItemId: string;
}

export interface BonusSummaryKpiRow {
  kpiCode: KpiCode;
  kpiName: string;
  /** `+20 %` de la profesion cuando potencia este KPI; `0` en caso contrario. */
  professionPercent: number;
  professionName: string | null;
  /** Porcentaje de la localizacion activa cuando afecta a este KPI; `0` en caso contrario. */
  locationPercent: number;
  locationName: string | null;
  /** Suma aritmetica de los porcentajes de todos los objetos del borrador que afectan a este KPI. */
  equipmentPercent: number;
  /** Desglose por objeto, para poder ver que un `+80 %` procede de dos objetos de `+40 %`. */
  equipmentEntries: BonusSummaryEquipmentEntry[];
  /** Suma aritmetica de las tres fuentes: nunca un producto de factores. */
  totalPotentialPercent: number;
}

export interface BonusSummary {
  rows: BonusSummaryKpiRow[];
  /** `true` cuando no hay ninguna fuente de bonus aplicable: la ficha muestra el estado vacio. */
  isEmpty: boolean;
}

function slotOrder(item: EquipmentBonusSummaryItem): number {
  // Las ranuras ubicadas se ordenan por el orden fijo del catalogo; las historicas sin
  // ubicar van despues, por su `displayOrder`, igual que en el tablero.
  return item.visualPosition === null
    ? 1000 + item.slotDisplayOrder
    : equipmentVisualPositionOrder(item.visualPosition);
}

/**
 * Agrega por KPI los porcentajes de las tres fuentes. Solo aparecen los KPI
 * realmente afectados por alguna fuente: nunca se muestran ceros repetidos
 * para todo el catalogo (seccion 10.6 del encargo).
 */
export function buildBonusSummary(input: BonusSummaryInput): BonusSummary {
  const rows = new Map<KpiCode, BonusSummaryKpiRow>();

  function rowFor(kpiCode: KpiCode): BonusSummaryKpiRow {
    const existing = rows.get(kpiCode);
    if (existing) return existing;
    const created: BonusSummaryKpiRow = {
      kpiCode,
      kpiName: KPI_CATALOG[kpiCode].name,
      professionPercent: 0,
      professionName: null,
      locationPercent: 0,
      locationName: null,
      equipmentPercent: 0,
      equipmentEntries: [],
      totalPotentialPercent: 0,
    };
    rows.set(kpiCode, created);
    return created;
  }

  if (input.profession) {
    // Los dos KPI de una profesion son siempre distintos (restriccion de base de datos).
    for (const kpiCode of [input.profession.kpiCodeA, input.profession.kpiCodeB]) {
      const row = rowFor(kpiCode);
      row.professionPercent = PROFESSION_BONUS_PERCENT;
      row.professionName = input.profession.name;
    }
  }

  if (input.location) {
    const row = rowFor(input.location.kpiCode);
    row.locationPercent = input.location.bonusPercent;
    row.locationName = input.location.name;
  }

  for (const item of [...input.equippedItems].sort((a, b) => slotOrder(a) - slotOrder(b))) {
    const row = rowFor(item.kpiCode);
    // Aditivo: varios objetos sobre el mismo KPI suman sus porcentajes (nunca se multiplican).
    row.equipmentPercent += item.bonusPercent;
    row.equipmentEntries.push({
      ownedItemId: item.ownedItemId,
      storeItemId: item.storeItemId,
      itemName: item.itemName,
      equipmentSlotName: item.equipmentSlotName,
      bonusPercent: item.bonusPercent,
      imageVersion: item.imageVersion,
    });
  }

  const result = [...rows.values()];
  for (const row of result) {
    row.totalPotentialPercent = row.professionPercent + row.locationPercent + row.equipmentPercent;
  }
  result.sort((a, b) => b.totalPotentialPercent - a.totalPotentialPercent || a.kpiName.localeCompare(b.kpiName));

  return { rows: result, isEmpty: result.every((row) => row.totalPotentialPercent === 0) };
}

/**
 * Diferencia por KPI entre el borrador y el equipo confirmado, para que el
 * panel pueda indicar que sube y que baja antes de confirmar (seccion 10.5).
 * Solo compara la capa de equipo: profesion y localizacion son de solo
 * lectura y siempre se leen del servidor.
 */
export interface BonusSummaryDelta {
  kpiCode: KpiCode;
  kpiName: string;
  confirmedPercent: number;
  draftPercent: number;
  differencePercent: number;
}

export function computeEquipmentBonusDeltas(
  confirmed: readonly EquipmentBonusSummaryItem[],
  draft: readonly EquipmentBonusSummaryItem[],
): BonusSummaryDelta[] {
  const totals = new Map<KpiCode, { confirmed: number; draft: number }>();
  function bucket(kpiCode: KpiCode) {
    const existing = totals.get(kpiCode);
    if (existing) return existing;
    const created = { confirmed: 0, draft: 0 };
    totals.set(kpiCode, created);
    return created;
  }

  for (const item of confirmed) bucket(item.kpiCode).confirmed += item.bonusPercent;
  for (const item of draft) bucket(item.kpiCode).draft += item.bonusPercent;

  return [...totals.entries()]
    .map(([kpiCode, value]) => ({
      kpiCode,
      kpiName: KPI_CATALOG[kpiCode].name,
      confirmedPercent: value.confirmed,
      draftPercent: value.draft,
      differencePercent: value.draft - value.confirmed,
    }))
    .filter((row) => row.differencePercent !== 0)
    .sort((a, b) => b.differencePercent - a.differencePercent || a.kpiName.localeCompare(b.kpiName));
}
