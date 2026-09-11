import type { KpiCatalogEntry, KpiCode } from "./catalog";

/**
 * Presentacion de la pantalla semanal de cargas de KPI (ver
 * docs/IMPORT_PRODUCTIVITY.md, docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md y
 * docs/MANUAL_KPI_ENTRY.md). No es un motor generico de importaciones: es
 * una definicion tipada minima para agrupar los KPI activos por origen de
 * carga.
 */

export type LoadGroupStatus = "PENDING" | "PARTIAL" | "LOADED";

/**
 * Estado de cobertura de un origen de carga: el color/texto unico del
 * grupo, mas el contador de participantes aplicables sin dato en ese
 * origen ("n AVISO", hotfix `AVISO`/`0`, ver docs/DECISIONS.md). Una carga
 * confirmada es siempre `LOADED`, aunque `vacCount` sea mayor que cero: el
 * amarillo (`PARTIAL`) queda reservado para una dependencia de carga
 * realmente pendiente (Domador de Escaladas con un solo origen de los
 * dos). Los cinco origenes manuales nunca informan `vacCount` (nunca
 * muestran AVISO de grupo, ver docs/MANUAL_KPI_ENTRY.md) ni usan
 * `PARTIAL`.
 */
export interface LoadCoverageStatus {
  status: LoadGroupStatus;
  vacCount: number;
}

export const PENDING_COVERAGE: LoadCoverageStatus = { status: "PENDING", vacCount: 0 };

/** `FILE`: carga de un Excel (`Cargar`/`Comprobar`). `MANUAL`: formulario (`Introducir datos`/`Comprobar`). */
export type LoadMode = "FILE" | "MANUAL";

export type LoadOrigin =
  | "PRODUCTIVITY"
  | "ESCALATION_TAMER"
  | "MASTER_CRAFTSMAN"
  | "VOICE_AMBASSADOR"
  | "STABILITY_GUARDIAN"
  | "WORK_CHRONOMANCY"
  | "STAR_WRITER"
  | "ENTHUSIASTIC_STUDENT"
  | "EXPERT_APPRENTICE";

const ORIGIN_KPI_CODES: Record<LoadOrigin, KpiCode[]> = {
  PRODUCTIVITY: ["SOLUTION_HUNTER", "DATA_EXPLORER"],
  ESCALATION_TAMER: ["ESCALATION_TAMER"],
  MASTER_CRAFTSMAN: ["MASTER_CRAFTSMAN"],
  VOICE_AMBASSADOR: ["VOICE_AMBASSADOR"],
  STABILITY_GUARDIAN: ["STABILITY_GUARDIAN"],
  WORK_CHRONOMANCY: ["WORK_CHRONOMANCY"],
  STAR_WRITER: ["STAR_WRITER"],
  ENTHUSIASTIC_STUDENT: ["ENTHUSIASTIC_STUDENT"],
  EXPERT_APPRENTICE: ["EXPERT_APPRENTICE"],
};

const ORIGIN_TITLES: Record<LoadOrigin, string> = {
  PRODUCTIVITY: "Productividad",
  ESCALATION_TAMER: "Domador de Escaladas",
  MASTER_CRAFTSMAN: "Maestro Artesano",
  VOICE_AMBASSADOR: "Embajador de voz",
  STABILITY_GUARDIAN: "Guardian de la Estabilidad",
  WORK_CHRONOMANCY: "Cronomagia laboral",
  STAR_WRITER: "Redactor estrella",
  ENTHUSIASTIC_STUDENT: "Estudiante entusiasta",
  EXPERT_APPRENTICE: "Aprendiz experto",
};

const ORIGIN_MODE: Record<LoadOrigin, LoadMode> = {
  PRODUCTIVITY: "FILE",
  ESCALATION_TAMER: "FILE",
  MASTER_CRAFTSMAN: "FILE",
  VOICE_AMBASSADOR: "FILE",
  STABILITY_GUARDIAN: "MANUAL",
  WORK_CHRONOMANCY: "MANUAL",
  STAR_WRITER: "MANUAL",
  ENTHUSIASTIC_STUDENT: "MANUAL",
  EXPERT_APPRENTICE: "MANUAL",
};

/** Segmento de ruta propio de cada origen: nunca se reutiliza la ruta de un origen para otro. */
export const ORIGIN_ROUTE_SLUGS: Record<LoadOrigin, string> = {
  PRODUCTIVITY: "productividad",
  ESCALATION_TAMER: "escalados",
  MASTER_CRAFTSMAN: "calidad",
  VOICE_AMBASSADOR: "llamadas",
  STABILITY_GUARDIAN: "estabilidad",
  WORK_CHRONOMANCY: "cronomagia",
  STAR_WRITER: "articulos",
  ENTHUSIASTIC_STUDENT: "dedicacion",
  EXPERT_APPRENTICE: "formaciones",
};

const ORIGIN_ORDER: LoadOrigin[] = [
  "PRODUCTIVITY",
  "ESCALATION_TAMER",
  "MASTER_CRAFTSMAN",
  "VOICE_AMBASSADOR",
  "STABILITY_GUARDIAN",
  "WORK_CHRONOMANCY",
  "STAR_WRITER",
  "ENTHUSIASTIC_STUDENT",
  "EXPERT_APPRENTICE",
];

export interface LoadGroupView {
  /** El `LoadOrigin` para los grupos implementados, o el `KpiCode` para el resto. */
  key: string;
  title: string;
  kpiNames: string[];
  status: LoadGroupStatus;
  vacCount: number;
  /** Si este grupo tiene carga y comprobacion funcional en esta entrega. */
  implemented: boolean;
  /** `FILE` (Excel) o `MANUAL` (formulario). Solo significativo si `implemented`. */
  mode: LoadMode;
  /** Segmento de ruta bajo `.../kpis/`, o `null` si no esta implementado. */
  routeSlug: string | null;
}

/**
 * Construye los grupos de carga a partir de los KPI activos del split. Cada
 * origen implementado (cuatro de Excel, cinco manuales) aparece si su KPI
 * (o alguno de sus KPI, en el caso de Productividad) esta activo; el resto
 * de KPI activos aparecen como grupos pendientes, uno por KPI (no deberia
 * quedar ninguno mientras el catalogo cerrado actual no crezca).
 */
export function buildWeeklyLoadGroups(
  activeCatalogEntries: KpiCatalogEntry[],
  coverageByOrigin: Partial<Record<LoadOrigin, LoadCoverageStatus>>,
): LoadGroupView[] {
  const groups: LoadGroupView[] = [];
  const handledCodes = new Set<KpiCode>();

  for (const origin of ORIGIN_ORDER) {
    const entries = activeCatalogEntries.filter((entry) => ORIGIN_KPI_CODES[origin].includes(entry.code));
    if (entries.length === 0) continue;
    for (const entry of entries) handledCodes.add(entry.code);
    const coverage = coverageByOrigin[origin] ?? PENDING_COVERAGE;
    groups.push({
      key: origin,
      title: ORIGIN_TITLES[origin],
      kpiNames: entries.map((entry) => entry.name),
      status: coverage.status,
      vacCount: coverage.vacCount,
      implemented: true,
      mode: ORIGIN_MODE[origin],
      routeSlug: ORIGIN_ROUTE_SLUGS[origin],
    });
  }

  for (const entry of activeCatalogEntries) {
    if (handledCodes.has(entry.code)) continue;
    groups.push({
      key: entry.code,
      title: entry.name,
      kpiNames: [entry.name],
      status: "PENDING",
      vacCount: 0,
      implemented: false,
      mode: "FILE",
      routeSlug: null,
    });
  }

  return groups;
}
