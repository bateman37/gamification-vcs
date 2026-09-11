import type { KpiCatalogEntry, KpiCode } from "./catalog";

/**
 * Presentacion de la pantalla semanal de cargas de KPI (ver
 * docs/IMPORT_PRODUCTIVITY.md). No es un motor generico de importaciones:
 * es una definicion tipada minima para agrupar los KPI activos por origen
 * de carga. En esta entrega solo el grupo de Productividad tiene carga y
 * comprobacion funcional.
 */

export type LoadGroupStatus = "PENDING" | "PARTIAL" | "LOADED";

export const PRODUCTIVITY_KPI_CODES: KpiCode[] = ["SOLUTION_HUNTER", "DATA_EXPLORER"];

export interface LoadGroupView {
  /** "PRODUCTIVITY" para el grupo implementado, o el `KpiCode` para los demas. */
  key: string;
  title: string;
  kpiNames: string[];
  status: LoadGroupStatus;
  /** Si este grupo tiene carga y comprobacion funcional en esta entrega. */
  implemented: boolean;
}

/**
 * Construye los grupos de carga a partir de los KPI activos del split. El
 * grupo de Productividad aparece si Cazador de soluciones o Explorador de
 * datos (o ambos) estan activos; el resto de KPI activos aparecen como
 * grupos pendientes, uno por KPI, mientras no se audite que comparten
 * origen con otro.
 */
export function buildWeeklyLoadGroups(
  activeCatalogEntries: KpiCatalogEntry[],
  productivityStatus: LoadGroupStatus,
): LoadGroupView[] {
  const groups: LoadGroupView[] = [];

  const productivityEntries = activeCatalogEntries.filter((entry) => PRODUCTIVITY_KPI_CODES.includes(entry.code));
  if (productivityEntries.length > 0) {
    groups.push({
      key: "PRODUCTIVITY",
      title: "Productividad",
      kpiNames: productivityEntries.map((entry) => entry.name),
      status: productivityStatus,
      implemented: true,
    });
  }

  for (const entry of activeCatalogEntries) {
    if (PRODUCTIVITY_KPI_CODES.includes(entry.code)) continue;
    groups.push({
      key: entry.code,
      title: entry.name,
      kpiNames: [entry.name],
      status: "PENDING",
      implemented: false,
    });
  }

  return groups;
}
