/**
 * Ventana temporal de edicion de la localizacion semanal (`0.8.5` / MVP-2C,
 * ver docs/WEEKLY_LOCATIONS.md, seccion 4 del encargo). Funciones puras que
 * reciben siempre la fecha actual como argumento: los servicios llaman con
 * la fecha real del servidor (`currentCalendarDate()`), y las pruebas
 * inyectan una fecha fija, sin depender del reloj real ni de `sleep`.
 *
 * Regla exacta: se puede crear, editar o eliminar la localizacion de una
 * semana solo antes de que llegue su `startDate`. Desde ese primer dia
 * queda bloqueada, este publicada o no; una semana publicada es siempre de
 * solo lectura, aunque por un error de fechas se intentara editar antes.
 */

export type WeekLocationTemporalStatus = "PROXIMA" | "ACTIVA" | "FINALIZADA" | "PUBLICADA";

export interface WeekLocationWindow {
  status: WeekLocationTemporalStatus;
  /** `true` si ahora mismo se puede crear, editar o eliminar la localizacion de esta semana. */
  editable: boolean;
}

/**
 * Resuelve el estado temporal de la localizacion de una semana. `now`,
 * `week.startDate` y `week.endDate` deben ser fechas de calendario (medianoche
 * UTC), igual que el resto de fechas de negocio del proyecto.
 */
export function resolveWeekLocationWindow(
  now: Date,
  week: { startDate: Date; endDate: Date },
  isPublished: boolean,
): WeekLocationWindow {
  if (isPublished) {
    return { status: "PUBLICADA", editable: false };
  }
  if (now.getTime() < week.startDate.getTime()) {
    return { status: "PROXIMA", editable: true };
  }
  if (now.getTime() <= week.endDate.getTime()) {
    return { status: "ACTIVA", editable: false };
  }
  return { status: "FINALIZADA", editable: false };
}

/**
 * `true` si la fecha actual de calendario cae dentro de `[startDate, endDate]`
 * (ambos incluidos). Usado tanto por la ventana temporal como por la
 * localizacion "activa esta semana" de fichas y del motor de calculo.
 */
export function isWeekCurrentlyActive(now: Date, week: { startDate: Date; endDate: Date }): boolean {
  return now.getTime() >= week.startDate.getTime() && now.getTime() <= week.endDate.getTime();
}

/**
 * Primera semana del split cuya fecha de inicio es posterior a `now`
 * (seccion 5 del encargo). `orderedWeeks` debe venir ordenada por
 * `sequenceNumber`/`startDate` ascendente (como devuelve
 * `listSplitWeeks`); nunca inventa una semana fuera de las ya creadas.
 */
export function findNextWeek<T extends { startDate: Date }>(orderedWeeks: readonly T[], now: Date): T | null {
  return orderedWeeks.find((week) => week.startDate.getTime() > now.getTime()) ?? null;
}
