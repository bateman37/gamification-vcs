import type { ResolvedObservation } from "./observation";

/**
 * Impacto de la gamificacion (bloque 6, parte H7/I del encargo). El bonus
 * mide el efecto matematico de las reglas sobre los puntos: nunca demuestra
 * causalidad sobre el rendimiento. Respeta los mismos filtros de splits,
 * periodo, nivel y exclusion de posibles ausencias que el resto del motor
 * (los totales de bonus son "puntos anadidos en publicaciones analizadas",
 * no una media normalizada por persona).
 */

export interface KpiBonusBreakdownRow {
  kpiCode: string;
  kpiName: string;
  basePointsSum: number;
  finalPointsSum: number;
  professionBonusSum: number;
  locationBonusSum: number;
  equipmentBonusSum: number;
  measurementCount: number;
}

export interface PersonBonusRow {
  personId: string;
  personFullName: string;
  basePointsSum: number;
  finalPointsSum: number;
  professionBonusSum: number;
  locationBonusSum: number;
  equipmentBonusSum: number;
}

export interface EquippedItemAggregate {
  storeItemId: string | null;
  itemName: string;
  equippedCount: number;
  totalBonusPoints: number;
}

export interface GamificationBonusSnapshot {
  basePointsSum: number;
  finalPointsSum: number;
  professionBonusSum: number;
  locationBonusSum: number;
  equipmentBonusSum: number;
  bonusPercentOverBase: number | null;
  observationCount: number;
  perKpi: KpiBonusBreakdownRow[];
  perPerson: PersonBonusRow[];
  averageBonusPerObservation: number | null;
}

export interface KpiCatalogRefLike {
  code: string;
  name: string;
}

/**
 * Puntos base/finales y desglose de bonus (parte H7, "Puntos y bonus
 * publicados"). Usa solo celdas `COMPUTED` con base disponible (nunca copia
 * el total bonificado como base cuando la base es una inconsistencia).
 *
 * Precondicion: `observations` debe venir resuelto en modo `"sin"`
 * (`resolveObservation(..., { mode: "sin", ... })`), para que `cell.x`
 * contenga la base ya resuelta (con el fallback legado incluido) y
 * `cell.finalPoints` siga siendo el total oficial con gamificacion. Este
 * bloque muestra siempre ambos valores, sin importar el selector principal
 * de la pagina (parte H7: "muestra ambos valores... no esconde el desglose").
 */
export function buildGamificationBonusSnapshot(
  observations: readonly ResolvedObservation[],
  kpiCatalog: readonly KpiCatalogRefLike[],
): GamificationBonusSnapshot {
  const included = observations.filter((o) => !o.excluded);

  let basePointsSum = 0;
  let finalPointsSum = 0;
  let professionBonusSum = 0;
  let locationBonusSum = 0;
  let equipmentBonusSum = 0;
  let observationCellCount = 0;

  const perKpiMap = new Map<string, KpiBonusBreakdownRow>();
  for (const kpi of kpiCatalog) {
    perKpiMap.set(kpi.code, {
      kpiCode: kpi.code,
      kpiName: kpi.name,
      basePointsSum: 0,
      finalPointsSum: 0,
      professionBonusSum: 0,
      locationBonusSum: 0,
      equipmentBonusSum: 0,
      measurementCount: 0,
    });
  }

  const perPersonMap = new Map<string, PersonBonusRow>();

  for (const observation of included) {
    for (const cell of observation.cells) {
      // `cell.x` ya es la base resuelta en modo "sin" (con el fallback legado a `finalPoints`
      // para publicaciones sin ningun bonus): las observaciones pasadas a esta funcion deben
      // venir resueltas en ese modo. `cell.included` ya descarta VAC/No aplica/inconsistencias.
      if (cell.status !== "COMPUTED" || !cell.included || cell.x === null || cell.finalPoints === null) continue;
      const base = cell.x;

      basePointsSum += base;
      finalPointsSum += cell.finalPoints;
      professionBonusSum += cell.professionBonusPoints;
      locationBonusSum += cell.locationBonusPoints;
      equipmentBonusSum += cell.equipmentBonusPoints;
      observationCellCount += 1;

      const kpiRow = perKpiMap.get(cell.kpiCode);
      if (kpiRow) {
        kpiRow.basePointsSum += base;
        kpiRow.finalPointsSum += cell.finalPoints;
        kpiRow.professionBonusSum += cell.professionBonusPoints;
        kpiRow.locationBonusSum += cell.locationBonusPoints;
        kpiRow.equipmentBonusSum += cell.equipmentBonusPoints;
        kpiRow.measurementCount += 1;
      }

      const personRow = perPersonMap.get(observation.personId) ?? {
        personId: observation.personId,
        personFullName: observation.personFullName,
        basePointsSum: 0,
        finalPointsSum: 0,
        professionBonusSum: 0,
        locationBonusSum: 0,
        equipmentBonusSum: 0,
      };
      personRow.basePointsSum += base;
      personRow.finalPointsSum += cell.finalPoints;
      personRow.professionBonusSum += cell.professionBonusPoints;
      personRow.locationBonusSum += cell.locationBonusPoints;
      personRow.equipmentBonusSum += cell.equipmentBonusPoints;
      perPersonMap.set(observation.personId, personRow);
    }
  }

  const totalBonus = professionBonusSum + locationBonusSum + equipmentBonusSum;

  return {
    basePointsSum,
    finalPointsSum,
    professionBonusSum,
    locationBonusSum,
    equipmentBonusSum,
    bonusPercentOverBase: basePointsSum > 0 ? (100 * totalBonus) / basePointsSum : null,
    observationCount: observationCellCount,
    perKpi: [...perKpiMap.values()],
    perPerson: [...perPersonMap.values()].sort((a, b) => b.finalPointsSum - b.basePointsSum - (a.finalPointsSum - a.basePointsSum)),
    averageBonusPerObservation: observationCellCount > 0 ? totalBonus / observationCellCount : null,
  };
}

export interface PublishedEquippedItemLike {
  storeItemId: string | null;
  itemNameSnapshot: string;
  kpiCodeSnapshot: string;
  bonusPercentSnapshot: number;
  bonusPointsForKpi: number | null;
}

/**
 * Objetos equipados en publicaciones (parte I1): "veces equipado" cuenta
 * observaciones persona-split-semana originales (no dias de uso), y la
 * aportacion de puntos es una medida distinta (un objeto sin bonus puede
 * contar en equipamientos y sumar 0 en puntos).
 */
export function buildEquippedItemAggregates(items: readonly PublishedEquippedItemLike[]): {
  mostEquipped: EquippedItemAggregate[];
  mostValuable: EquippedItemAggregate[];
} {
  const byItem = new Map<string, EquippedItemAggregate>();
  for (const item of items) {
    const key = item.storeItemId ?? `snapshot:${item.itemNameSnapshot}`;
    const entry = byItem.get(key) ?? { storeItemId: item.storeItemId, itemName: item.itemNameSnapshot, equippedCount: 0, totalBonusPoints: 0 };
    entry.equippedCount += 1;
    entry.totalBonusPoints += item.bonusPointsForKpi ?? 0;
    byItem.set(key, entry);
  }
  const all = [...byItem.values()];
  return {
    mostEquipped: [...all].sort((a, b) => b.equippedCount - a.equippedCount).slice(0, 10),
    mostValuable: [...all].sort((a, b) => b.totalBonusPoints - a.totalBonusPoints).slice(0, 10),
  };
}
