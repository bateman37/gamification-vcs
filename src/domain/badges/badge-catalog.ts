import { normalizeForMatching } from "@/lib/normalize";
import { KPI_CATALOG, type KpiCode } from "@/domain/kpis/catalog";

/**
 * Catalogo cerrado de badges (`1.2.3`, seccion 2 del encargo, ver
 * docs/BADGES.md). Fuente unica de verdad tipada, igual que
 * `src/domain/kpis/catalog.ts`: no existe CRUD que permita crear o borrar
 * categorias desde la interfaz. `code` es el identificador interno estable
 * (nunca el nombre visible); las diez categorias que corresponden a un KPI
 * activo del catalogo reutilizan exactamente ese `KpiCode` como `code`, para
 * que un badge nuevo se derive automaticamente
 * (`ensureBadgeCatalogSeeded`) sin anadir una fila a mano cada vez que se
 * active un KPI. "Travesia del Padawan" y "Guardian del conocimiento" son
 * categorias historicas sin KPI activo actual: conservan su badge aunque no
 * exista ningun `KpiCode` correspondiente.
 */

export type BadgeType = "MVP" | "TEAM_MVP" | "KPI";

export interface BadgeCatalogEntry {
  /** Identificador interno estable. Para las categorias KPI del catalogo activo, coincide con `KpiCode`. */
  code: string;
  name: string;
  type: BadgeType;
  /** `KpiCode` del catalogo activo que deriva este badge, o `null` (MVP, MVP Team, categorias historicas sin KPI activo). */
  kpiCode: KpiCode | null;
  /** Orden de presentacion (seccion 2 del encargo: los diez KPI del catalogo, despues las dos categorias historicas, despues MVP y MVP Team). */
  sortOrder: number;
}

/** Codigos propios de las dos categorias historicas sin `KpiCode` activo. */
export const LEGACY_PADAWAN_JOURNEY_CODE = "LEGACY_PADAWAN_JOURNEY";
export const LEGACY_KNOWLEDGE_GUARDIAN_CODE = "LEGACY_KNOWLEDGE_GUARDIAN";
export const MVP_BADGE_CODE = "MVP";
export const TEAM_MVP_BADGE_CODE = "TEAM_MVP";

const KPI_BADGE_CODES: readonly KpiCode[] = [
  "SOLUTION_HUNTER",
  "DATA_EXPLORER",
  "VOICE_AMBASSADOR",
  "MASTER_CRAFTSMAN",
  "ESCALATION_TAMER",
  "WORK_CHRONOMANCY",
  "STABILITY_GUARDIAN",
  "STAR_WRITER",
  "ENTHUSIASTIC_STUDENT",
  "EXPERT_APPRENTICE",
];

/** Catalogo inicial exacto de las 14 categorias (seccion 2 del encargo), en su orden de presentacion. */
export const BADGE_CATALOG: readonly BadgeCatalogEntry[] = [
  { code: "SOLUTION_HUNTER", name: KPI_CATALOG.SOLUTION_HUNTER.name, type: "KPI", kpiCode: "SOLUTION_HUNTER", sortOrder: 1 },
  { code: "DATA_EXPLORER", name: KPI_CATALOG.DATA_EXPLORER.name, type: "KPI", kpiCode: "DATA_EXPLORER", sortOrder: 2 },
  { code: "VOICE_AMBASSADOR", name: KPI_CATALOG.VOICE_AMBASSADOR.name, type: "KPI", kpiCode: "VOICE_AMBASSADOR", sortOrder: 3 },
  { code: "MASTER_CRAFTSMAN", name: KPI_CATALOG.MASTER_CRAFTSMAN.name, type: "KPI", kpiCode: "MASTER_CRAFTSMAN", sortOrder: 4 },
  { code: "ESCALATION_TAMER", name: KPI_CATALOG.ESCALATION_TAMER.name, type: "KPI", kpiCode: "ESCALATION_TAMER", sortOrder: 5 },
  { code: "WORK_CHRONOMANCY", name: KPI_CATALOG.WORK_CHRONOMANCY.name, type: "KPI", kpiCode: "WORK_CHRONOMANCY", sortOrder: 6 },
  { code: LEGACY_PADAWAN_JOURNEY_CODE, name: "Travesía del Padawan", type: "KPI", kpiCode: null, sortOrder: 7 },
  { code: "STABILITY_GUARDIAN", name: KPI_CATALOG.STABILITY_GUARDIAN.name, type: "KPI", kpiCode: "STABILITY_GUARDIAN", sortOrder: 8 },
  { code: "STAR_WRITER", name: KPI_CATALOG.STAR_WRITER.name, type: "KPI", kpiCode: "STAR_WRITER", sortOrder: 9 },
  { code: "ENTHUSIASTIC_STUDENT", name: KPI_CATALOG.ENTHUSIASTIC_STUDENT.name, type: "KPI", kpiCode: "ENTHUSIASTIC_STUDENT", sortOrder: 10 },
  { code: "EXPERT_APPRENTICE", name: KPI_CATALOG.EXPERT_APPRENTICE.name, type: "KPI", kpiCode: "EXPERT_APPRENTICE", sortOrder: 11 },
  { code: LEGACY_KNOWLEDGE_GUARDIAN_CODE, name: "Guardián del conocimiento", type: "KPI", kpiCode: null, sortOrder: 12 },
  { code: MVP_BADGE_CODE, name: "MVP", type: "MVP", kpiCode: null, sortOrder: 13 },
  { code: TEAM_MVP_BADGE_CODE, name: "MVP Team", type: "TEAM_MVP", kpiCode: null, sortOrder: 14 },
];

const BADGE_CATALOG_BY_CODE = new Map(BADGE_CATALOG.map((entry) => [entry.code, entry]));

export function getBadgeCatalogEntry(code: string): BadgeCatalogEntry | undefined {
  return BADGE_CATALOG_BY_CODE.get(code);
}

/** El `code` de badge derivado por un `KpiCode` del catalogo activo. */
export function badgeCodeForKpi(kpiCode: KpiCode): string {
  return kpiCode;
}

export function isKpiDerivedBadgeCode(code: string): code is KpiCode {
  return (KPI_BADGE_CODES as readonly string[]).includes(code);
}

/**
 * Reconoce el nombre de una categoria tal como aparece en un origen externo
 * (por ejemplo el Excel historico) y devuelve el `code` interno
 * correspondiente. Normaliza mayusculas/tildes/espacios antes de comparar,
 * y reconoce explicitamente el alias `Team MVP` (nombre del Excel historico)
 * como la misma categoria que el nombre canonico visible `MVP Team`
 * (seccion 1.2 del encargo): nunca deben existir dos categorias distintas
 * por este cambio de orden en las palabras.
 */
export function resolveBadgeCodeForCategoryLabel(label: string): string | null {
  const normalized = normalizeForMatching(label);
  if (normalized === normalizeForMatching("Team MVP")) return TEAM_MVP_BADGE_CODE;
  for (const entry of BADGE_CATALOG) {
    if (normalizeForMatching(entry.name) === normalized) return entry.code;
  }
  return null;
}
