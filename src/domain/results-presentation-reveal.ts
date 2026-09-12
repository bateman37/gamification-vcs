/**
 * Agrupacion de posiciones para la revelacion de "Presentar resultados"
 * (`1.0.1`, parte I del encargo): funcion pura, sin acceso a datos, para
 * poder probarla sin levantar el servicio de presentacion. Nunca decide el
 * ranking (eso ya lo hacen `rankByScoreDescending`/`rankByComparator`,
 * reutilizados por los servicios que llaman a esta funcion); solo decide,
 * dado un ranking ya calculado, en que orden y agrupados como se revelan
 * las primeras seis posiciones.
 */
export interface RankedForReveal {
  rank: number;
}

/**
 * Filtra las entradas con `rank <= 6`, las agrupa por posicion exacta
 * (un empate real comparte grupo y se revela a la vez) y devuelve los
 * grupos en **orden de revelacion**: de la peor posicion incluida hacia la
 * primera (descendente por `rank`). Dentro de un grupo, el orden de las
 * entradas es el mismo que traian de entrada (nunca se inventa un
 * desempate visual adicional: eso es responsabilidad exclusiva del
 * ranking ya calculado por el servicio que llama a esta funcion).
 *
 * Soporta menos de seis participantes (se revelan todos los que haya) y
 * saltos de posicion por empate (`1, 2, 2, 4`: la posicion `3` sencillamente
 * no existe, y eso no rompe nada). Un empate justo en la posicion de corte
 * (varias personas en la posicion `6`) se incluye entero: la posicion `7`
 * nunca entra, aunque comparta puntuacion con la `6` en el dato de origen
 * (el ranking de competicion ya le habria asignado `7`, no `6`, en ese
 * caso: esta funcion no reinterpreta rankings, solo agrupa por el `rank`
 * que recibe).
 */
export function buildRevealGroups<T extends RankedForReveal>(entries: T[]): T[][] {
  const eligible = entries.filter((entry) => entry.rank <= 6);

  const groupsByRank = new Map<number, T[]>();
  for (const entry of eligible) {
    const group = groupsByRank.get(entry.rank);
    if (group) {
      group.push(entry);
    } else {
      groupsByRank.set(entry.rank, [entry]);
    }
  }

  return Array.from(groupsByRank.entries())
    .sort(([rankA], [rankB]) => rankB - rankA)
    .map(([, group]) => group);
}
