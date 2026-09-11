import { KPI_CATALOG, type KpiCode } from "@/domain/kpis/catalog";
import { PROFESSION_BONUS_LABEL } from "@/domain/profession-bonus";

/**
 * Presentacion compartida de una profesion (`0.8.0` / MVP-2B). Vive en
 * `src/domain` porque la consumen tanto Server Components como Client
 * Components: nunca debe importarse un servicio de `src/server` desde un
 * componente cliente.
 */

/** Vista serializable de una profesion, apta para pasar a un Client Component. */
export interface ProfessionView {
  id: string;
  name: string;
  kpiCodeA: KpiCode;
  kpiCodeB: KpiCode;
  kpiNameA: string;
  kpiNameB: string;
  availableN0: boolean;
  availableN1: boolean;
  availableN2: boolean;
}

export interface ProfessionShape {
  id: string;
  name: string;
  kpiCodeA: KpiCode;
  kpiCodeB: KpiCode;
  availableN0: boolean;
  availableN1: boolean;
  availableN2: boolean;
}

export function toProfessionView(profession: ProfessionShape): ProfessionView {
  return {
    id: profession.id,
    name: profession.name,
    kpiCodeA: profession.kpiCodeA,
    kpiCodeB: profession.kpiCodeB,
    kpiNameA: KPI_CATALOG[profession.kpiCodeA].name,
    kpiNameB: KPI_CATALOG[profession.kpiCodeB].name,
    availableN0: profession.availableN0,
    availableN1: profession.availableN1,
    availableN2: profession.availableN2,
  };
}

/** Lista legible de los niveles disponibles de una profesion (`"N0, N1"`). */
export function formatAvailableLevels(
  profession: Pick<ProfessionShape, "availableN0" | "availableN1" | "availableN2">,
): string {
  const levels: string[] = [];
  if (profession.availableN0) levels.push("N0");
  if (profession.availableN1) levels.push("N1");
  if (profession.availableN2) levels.push("N2");
  return levels.join(", ");
}

/** Resumen corto de los dos KPI potenciados (`"Cazador de soluciones + Explorador de datos"`). */
export function formatPoweredKpis(profession: Pick<ProfessionView, "kpiNameA" | "kpiNameB">): string {
  return `${profession.kpiNameA} + ${profession.kpiNameB}`;
}

/**
 * Resumen visual completo pedido por el encargo (seccion 3):
 *
 * ```text
 * Mecanico
 * Disponible para: N0, N1
 * Potencia: Cazador de soluciones + Explorador de datos
 * Bonus: +20 % despues del maximo base
 * ```
 */
export function formatProfessionSummary(profession: ProfessionView): string {
  return [
    profession.name,
    `Disponible para: ${formatAvailableLevels(profession)}`,
    `Potencia: ${formatPoweredKpis(profession)}`,
    `Bonus: ${PROFESSION_BONUS_LABEL}`,
  ].join("\n");
}
