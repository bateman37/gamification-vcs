import { normalizeForMatching } from "@/lib/normalize";
import type { ParticipantWithPerson } from "@/server/services/participant.service";

/**
 * Emparejamiento por nombre real (`Person.fullName`), nunca por alias,
 * compartido por los cuatro origenes de carga semanal (Productividad,
 * Escalados, Calidad, Llamadas; ver docs/IMPORT_PRODUCTIVITY.md y
 * docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md). Distingue explicitamente
 * encontrado, ignorado, sin dato y ambiguo. El emparejamiento de
 * Productividad (`src/server/services/productivity/matching.ts`), ya
 * validado manualmente, delega en este modulo en vez de duplicar el
 * algoritmo (ver docs/DECISIONS.md).
 */

export interface SourceRowLike {
  rowNumber: number;
  sourceAgentName: string;
}

export type RowMatch<TRow extends SourceRowLike> =
  | { status: "found"; row: TRow; participant: ParticipantWithPerson }
  | { status: "ignored"; row: TRow }
  | { status: "ambiguous"; row: TRow; participants: ParticipantWithPerson[] };

export interface MatchResult<TRow extends SourceRowLike> {
  /** Un elemento por cada fila fuente del Excel, en el mismo orden. */
  matches: RowMatch<TRow>[];
  /** Participantes aplicables que no aparecen (de forma no ambigua) en el Excel. */
  missingParticipants: ParticipantWithPerson[];
  /** Si hay algun nombre que podria corresponder a mas de un participante aplicable. */
  hasAmbiguity: boolean;
}

export function matchRowsToParticipants<TRow extends SourceRowLike>(
  applicableParticipants: ParticipantWithPerson[],
  rows: TRow[],
): MatchResult<TRow> {
  const participantsByNormalizedName = new Map<string, ParticipantWithPerson[]>();
  for (const participant of applicableParticipants) {
    const normalized = normalizeForMatching(participant.person.fullName);
    const group = participantsByNormalizedName.get(normalized) ?? [];
    group.push(participant);
    participantsByNormalizedName.set(normalized, group);
  }

  const matches: RowMatch<TRow>[] = [];
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

export function isFoundMatch<TRow extends SourceRowLike>(
  match: RowMatch<TRow>,
): match is Extract<RowMatch<TRow>, { status: "found" }> {
  return match.status === "found";
}

export function isIgnoredMatch<TRow extends SourceRowLike>(
  match: RowMatch<TRow>,
): match is Extract<RowMatch<TRow>, { status: "ignored" }> {
  return match.status === "ignored";
}

export function isAmbiguousMatch<TRow extends SourceRowLike>(
  match: RowMatch<TRow>,
): match is Extract<RowMatch<TRow>, { status: "ambiguous" }> {
  return match.status === "ambiguous";
}
