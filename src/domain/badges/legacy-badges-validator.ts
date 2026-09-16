import { normalizeForMatching } from "@/lib/normalize";
import { resolveBadgeCodeForCategoryLabel } from "@/domain/badges/badge-catalog";
import type { LegacyBadgeGrant } from "@/domain/badges/legacy-badges-v1";

/**
 * Validador puro de un dataset historico de badges (seccion 4.3 del
 * encargo): recalcula todos los totales exigidos a partir de las
 * concesiones individuales (nunca de un contador aparte que pudiera
 * desincronizarse) y devuelve la lista de discrepancias, si las hay. El
 * importador debe fallar de forma explicita y no confirmar nada si esta
 * lista no esta vacia. Puro y sin acceso a base de datos: se puede probar
 * con cualquier dataset, no solo con `legacy-badges-v1`.
 */

export interface LegacyBadgeExpectedTotals {
  splitCount: number;
  recipientCount: number;
  grantCount: number;
  mvpCount: number;
  teamMvpCount: number;
  kpiCount: number;
  byCategory: Record<string, number>;
}

export interface LegacyBadgeValidationResult {
  ok: boolean;
  mismatches: string[];
  unresolvedCategoryLabels: string[];
}

export function validateLegacyBadgeDataset(
  grants: readonly LegacyBadgeGrant[],
  expected: LegacyBadgeExpectedTotals,
): LegacyBadgeValidationResult {
  const mismatches: string[] = [];
  const unresolvedCategoryLabels = new Set<string>();

  const splitLabels = new Set<string>();
  const recipientNormalizedNames = new Set<string>();
  const countByCategory = new Map<string, number>();
  let mvpCount = 0;
  let teamMvpCount = 0;
  let kpiCount = 0;

  for (const grant of grants) {
    splitLabels.add(grant.splitLabel);
    recipientNormalizedNames.add(normalizeForMatching(grant.recipientName));
    countByCategory.set(grant.categoryLabel, (countByCategory.get(grant.categoryLabel) ?? 0) + 1);

    const badgeCode = resolveBadgeCodeForCategoryLabel(grant.categoryLabel);
    if (!badgeCode) {
      unresolvedCategoryLabels.add(grant.categoryLabel);
      continue;
    }
    if (badgeCode === "MVP") mvpCount += 1;
    else if (badgeCode === "TEAM_MVP") teamMvpCount += 1;
    else kpiCount += 1;
  }

  if (splitLabels.size !== expected.splitCount) {
    mismatches.push(`Splits historicos: ${splitLabels.size} (esperado ${expected.splitCount}).`);
  }
  if (recipientNormalizedNames.size !== expected.recipientCount) {
    mismatches.push(`Destinatarios historicos: ${recipientNormalizedNames.size} (esperado ${expected.recipientCount}).`);
  }
  if (grants.length !== expected.grantCount) {
    mismatches.push(`Concesiones totales: ${grants.length} (esperado ${expected.grantCount}).`);
  }
  if (mvpCount !== expected.mvpCount) {
    mismatches.push(`MVP: ${mvpCount} (esperado ${expected.mvpCount}).`);
  }
  if (teamMvpCount !== expected.teamMvpCount) {
    mismatches.push(`MVP Team: ${teamMvpCount} (esperado ${expected.teamMvpCount}).`);
  }
  if (kpiCount !== expected.kpiCount) {
    mismatches.push(`Badges KPI: ${kpiCount} (esperado ${expected.kpiCount}).`);
  }
  for (const [category, expectedCount] of Object.entries(expected.byCategory)) {
    const actual = countByCategory.get(category) ?? 0;
    if (actual !== expectedCount) {
      mismatches.push(`${category}: ${actual} (esperado ${expectedCount}).`);
    }
  }
  if (unresolvedCategoryLabels.size > 0) {
    mismatches.push(`Categorias sin badge reconocido: ${Array.from(unresolvedCategoryLabels).join(", ")}.`);
  }

  return { ok: mismatches.length === 0, mismatches, unresolvedCategoryLabels: Array.from(unresolvedCategoryLabels) };
}
