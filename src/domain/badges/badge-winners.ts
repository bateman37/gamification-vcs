/**
 * Seleccion de ganadores de badges al finalizar un split (`1.2.3`, seccion 1
 * del encargo, ver docs/BADGES.md). Funciones puras: reciben entradas ya
 * calculadas por las clasificaciones oficiales
 * (`computeSplitClassification`/`computeFactionClassification`/
 * `computeSplitKpiClassification`, nunca reimplementadas aqui), con el
 * `personId` ya resuelto por el servicio que las llama. Los empates se
 * respetan siempre: varias personas pueden compartir el rango 1 y reciben
 * todas el mismo badge.
 */

export interface RankedPerson {
  rank: number;
  personId: string;
}

/** MVP: personas en el rango 1 de la clasificacion general individual oficial (seccion 1.1 del encargo). */
export function selectMvpBadgeWinners(entries: readonly RankedPerson[]): string[] {
  const winners = new Set(entries.filter((entry) => entry.rank === 1).map((entry) => entry.personId));
  return Array.from(winners);
}

export interface RankedFaction {
  rank: number;
  factionId: string;
}

/**
 * MVP Team: todas las personas que pertenezcan actualmente a la (o las, en
 * caso de empate) faccion(es) en el rango 1 de la clasificacion acumulada de
 * facciones (seccion 1.2 del encargo). Sin datos de faccion, no se concede
 * ningun MVP Team.
 */
export function selectTeamMvpBadgeWinners(
  factionEntries: readonly RankedFaction[],
  memberPersonIdsByFactionId: ReadonlyMap<string, readonly string[]>,
): string[] {
  const winningFactionIds = factionEntries.filter((entry) => entry.rank === 1).map((entry) => entry.factionId);
  const winners = new Set<string>();
  for (const factionId of winningFactionIds) {
    for (const personId of memberPersonIdsByFactionId.get(factionId) ?? []) {
      winners.add(personId);
    }
  }
  return Array.from(winners);
}

/** Badge de categoria KPI: personas en el rango 1 de la clasificacion acumulada de ese KPI (seccion 1.3 del encargo). Todos los empates ganan. */
export function selectKpiBadgeWinners(entries: readonly RankedPerson[]): string[] {
  const winners = new Set(entries.filter((entry) => entry.rank === 1).map((entry) => entry.personId));
  return Array.from(winners);
}
