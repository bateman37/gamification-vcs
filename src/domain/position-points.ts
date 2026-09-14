/**
 * Puntos por posicion semanal (`BUGFIX-1 / UX-SPLIT-1`, ver
 * docs/POSITION_POINTS_CONFIGURATION.md). Valores predeterminados: la tabla
 * historica exacta auditada en `Guia!B57:C71` del Excel de Split 8. Se usan
 * al crear un split nuevo y en el backfill de la migracion
 * `add_position_points`; no se leen del Excel en tiempo de ejecucion.
 *
 * Esta tabla es configuracion, no un KPI: no cuenta como "KPI cargado" y no
 * se mezcla con `SplitKpiConfig` ni con el catalogo de `src/domain/kpis`.
 */

export const TOTAL_POSITION_COUNT = 15;

export interface PositionPointDefault {
  position: number;
  points: number;
}

/**
 * Rango dinamico de posiciones desde `1.2.2` (ver
 * docs/POSITION_POINTS_CONFIGURATION.md, seccion "Posiciones superiores a
 * 15"): cada split debe tener reglas individuales `1..N`, donde `N` cubre
 * como minimo las quince posiciones historicas, el numero actual de
 * participantes del split y la mayor posicion ya persistida (para no
 * recortar nunca una regla guardada previamente). Funcion pura: no consulta
 * la base de datos, solo combina los tres numeros ya obtenidos por quien la
 * llama.
 */
export function resolveRequiredPositionCount(participantCount: number, maxPersistedPosition: number): number {
  return Math.max(TOTAL_POSITION_COUNT, participantCount, maxPersistedPosition);
}

export const DEFAULT_POSITION_POINTS: readonly PositionPointDefault[] = [
  { position: 1, points: 15 },
  { position: 2, points: 11 },
  { position: 3, points: 8 },
  { position: 4, points: 5 },
  { position: 5, points: 3 },
  { position: 6, points: 2 },
  { position: 7, points: 1 },
  { position: 8, points: 1 },
  { position: 9, points: 1 },
  { position: 10, points: 1 },
  { position: 11, points: 1 },
  { position: 12, points: 1 },
  { position: 13, points: 1 },
  { position: 14, points: 1 },
  { position: 15, points: 1 },
];
