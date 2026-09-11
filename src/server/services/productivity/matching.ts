import {
  isAmbiguousMatch as isAmbiguousMatchShared,
  isFoundMatch as isFoundMatchShared,
  isIgnoredMatch as isIgnoredMatchShared,
  matchRowsToParticipants,
  type MatchResult,
  type RowMatch,
} from "@/server/services/shared/matching";
import type { ParticipantWithPerson } from "@/server/services/participant.service";
import type { ProductivitySourceRow } from "./excel-reader";

/**
 * Emparejamiento por nombre real (`Person.fullName`), nunca por alias (ver
 * docs/IMPORT_PRODUCTIVITY.md). Delega en el algoritmo compartido
 * (`src/server/services/shared/matching.ts`, reutilizado tambien por
 * Escalados, Calidad y Llamadas): distingue encontrado, ignorado, sin dato
 * y ambiguo.
 */

export type ProductivityRowMatch = RowMatch<ProductivitySourceRow>;
export type ProductivityMatchResult = MatchResult<ProductivitySourceRow>;

export function matchProductivityRows(
  applicableParticipants: ParticipantWithPerson[],
  rows: ProductivitySourceRow[],
): ProductivityMatchResult {
  return matchRowsToParticipants(applicableParticipants, rows);
}

export function isFoundMatch(match: ProductivityRowMatch): match is Extract<ProductivityRowMatch, { status: "found" }> {
  return isFoundMatchShared(match);
}

export function isIgnoredMatch(match: ProductivityRowMatch): match is Extract<ProductivityRowMatch, { status: "ignored" }> {
  return isIgnoredMatchShared(match);
}

export function isAmbiguousMatch(match: ProductivityRowMatch): match is Extract<ProductivityRowMatch, { status: "ambiguous" }> {
  return isAmbiguousMatchShared(match);
}
