import { normalizeForMatching } from "@/lib/normalize";
import type { ParticipantWithPerson } from "@/server/services/participant.service";
import type { ProductivitySourceRow } from "./excel-reader";

/**
 * Emparejamiento por nombre real (`Person.fullName`), nunca por alias (ver
 * docs/IMPORT_PRODUCTIVITY.md). Distingue explicitamente cuatro estados:
 * encontrado, ignorado, sin dato y ambiguo.
 */

export type ProductivityRowMatch =
  | { status: "found"; row: ProductivitySourceRow; participant: ParticipantWithPerson }
  | { status: "ignored"; row: ProductivitySourceRow }
  | { status: "ambiguous"; row: ProductivitySourceRow; participants: ParticipantWithPerson[] };

export interface ProductivityMatchResult {
  /** Un elemento por cada fila fuente del Excel, en el mismo orden. */
  matches: ProductivityRowMatch[];
  /** Participantes aplicables que no aparecen (de forma no ambigua) en el Excel. */
  missingParticipants: ParticipantWithPerson[];
  /** Si hay algun nombre que podria corresponder a mas de un participante aplicable. */
  hasAmbiguity: boolean;
}

export function matchProductivityRows(
  applicableParticipants: ParticipantWithPerson[],
  rows: ProductivitySourceRow[],
): ProductivityMatchResult {
  const participantsByNormalizedName = new Map<string, ParticipantWithPerson[]>();
  for (const participant of applicableParticipants) {
    const normalized = normalizeForMatching(participant.person.fullName);
    const group = participantsByNormalizedName.get(normalized) ?? [];
    group.push(participant);
    participantsByNormalizedName.set(normalized, group);
  }

  const matches: ProductivityRowMatch[] = [];
  const resolvedOrContestedIds = new Set<string>();
  let hasAmbiguity = false;

  for (const row of rows) {
    const normalized = normalizeForMatching(row.sourceAgentName);
    const candidates = participantsByNormalizedName.get(normalized) ?? [];

    if (candidates.length === 0) {
      matches.push({ status: "ignored", row });
      continue;
    }

    if (candidates.length === 1) {
      const [participant] = candidates;
      if (participant) {
        resolvedOrContestedIds.add(participant.id);
        matches.push({ status: "found", row, participant });
      }
      continue;
    }

    hasAmbiguity = true;
    for (const candidate of candidates) resolvedOrContestedIds.add(candidate.id);
    matches.push({ status: "ambiguous", row, participants: candidates });
  }

  const missingParticipants = applicableParticipants.filter(
    (participant) => !resolvedOrContestedIds.has(participant.id),
  );

  return { matches, missingParticipants, hasAmbiguity };
}

export function isFoundMatch(
  match: ProductivityRowMatch,
): match is Extract<ProductivityRowMatch, { status: "found" }> {
  return match.status === "found";
}

export function isIgnoredMatch(
  match: ProductivityRowMatch,
): match is Extract<ProductivityRowMatch, { status: "ignored" }> {
  return match.status === "ignored";
}

export function isAmbiguousMatch(
  match: ProductivityRowMatch,
): match is Extract<ProductivityRowMatch, { status: "ambiguous" }> {
  return match.status === "ambiguous";
}
