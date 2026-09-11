import { rankByComparator, compareNormalizedAlias, type RankedEntry } from "@/domain/ranking";

/**
 * Reglas puras de clasificacion de facciones (`0.7.0` / MVP-2A, ver
 * docs/FACTIONS.md). El aporte de cada participante es exactamente su
 * `positionPoints` ya publicado: no existe una segunda formula ni un
 * "renombre" independiente. Funciones puras y comprobables, reutilizadas
 * tanto por la previsualizacion/publicacion semanal como por la
 * clasificacion detallada (semanal y acumulada).
 */

export interface FactionMemberScore {
  splitParticipantId: string;
  alias: string;
  positionPoints: number;
}

export interface FactionTopThree {
  /** Los tres mejores, ya ordenados de mayor a menor `positionPoints`. */
  topContributors: FactionMemberScore[];
  /** Suma de los tres mejores. Nunca una media. */
  weeklyScore: number;
}

/**
 * Ordena los miembros de una faccion por `positionPoints` descendente
 * (desempatado solo por alias normalizado y despues id, sin conceder
 * ninguna ventaja de negocio) y selecciona exactamente los tres primeros.
 * Devuelve `null` si hay menos de tres miembros: la regla del top 3 exige
 * exactamente tres contribuciones (seccion 6 del encargo `0.7.0`), y esa
 * insuficiencia debe bloquear la publicacion, nunca rellenarse con ceros.
 */
export function selectFactionTopThree(members: readonly FactionMemberScore[]): FactionTopThree | null {
  if (members.length < 3) return null;

  const sorted = [...members].sort((a, b) => {
    if (a.positionPoints !== b.positionPoints) return b.positionPoints - a.positionPoints;
    return (
      compareNormalizedAlias(a.alias.trim().toLowerCase(), b.alias.trim().toLowerCase()) ||
      a.splitParticipantId.localeCompare(b.splitParticipantId)
    );
  });

  const topContributors = sorted.slice(0, 3);
  const weeklyScore = topContributors.reduce((sum, member) => sum + member.positionPoints, 0);
  return { topContributors, weeklyScore };
}

/**
 * Compara dos vectores numericos ya ordenados de mayor a menor,
 * elemento a elemento (un hueco se trata como `0`): usado tanto para
 * desempatar facciones con la misma suma semanal (comparando sus tres
 * aportaciones) como para desempatar el acumulado (comparando las
 * aportaciones acumuladas de sus miembros que puntuaron).
 */
export function compareDescendingNumberVectors(a: readonly number[], b: readonly number[]): number {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (b[index] ?? 0) - (a[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export interface FactionScoreEntry {
  factionId: string;
  factionName: string;
  score: number;
  /** Vector ya ordenado de mayor a menor: las tres aportaciones semanales, o las aportaciones acumuladas por miembro. */
  contributionVector: readonly number[];
}

/**
 * Clasifica facciones por puntuacion descendente y, en caso de empate, por
 * el vector de aportaciones (mejor, segundo, tercero...). Un empate real
 * (puntuacion y vector identicos) usa ranking de competicion (`1, 2, 2, 4`),
 * igual que la clasificacion individual. El nombre de la faccion nunca
 * rompe el empate: solo estabiliza el orden visual entre iguales.
 */
export function rankFactions(entries: readonly FactionScoreEntry[]): RankedEntry<FactionScoreEntry>[] {
  return rankByComparator(
    entries,
    (a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return compareDescendingNumberVectors(a.contributionVector, b.contributionVector);
    },
    (a, b) =>
      compareNormalizedAlias(a.factionName.trim().toLowerCase(), b.factionName.trim().toLowerCase()) ||
      a.factionId.localeCompare(b.factionId),
  );
}
