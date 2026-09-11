/**
 * Utilidades de fechas de calendario.
 *
 * Todas las fechas de negocio (inicio de split, inicio/fin de semana) se
 * tratan como fechas de calendario "puras" (sin hora ni zona horaria).
 * Se representan internamente como `Date` a medianoche UTC para que el
 * valor que se guarda y se lee de PostgreSQL (columna `DATE`) sea siempre
 * el mismo dia, sin importar la zona horaria del proceso que ejecuta el
 * codigo. Nunca se debe usar `new Date(year, month, day)` (hora local) ni
 * `Date.now()` para estos valores.
 */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Convierte una fecha "YYYY-MM-DD" en un `Date` a medianoche UTC. */
export function parseCalendarDate(isoDate: string): Date {
  if (!ISO_DATE_PATTERN.test(isoDate)) {
    throw new Error(`Formato de fecha invalido: "${isoDate}". Se esperaba AAAA-MM-DD.`);
  }
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year as number, (month as number) - 1, day as number));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== (month as number) - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Fecha inexistente en el calendario: "${isoDate}".`);
  }
  return date;
}

/** Formatea un `Date` (medianoche UTC) como "YYYY-MM-DD". */
export function formatCalendarDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formatea un `Date` (medianoche UTC) como "DD/MM/AAAA", el formato legible
 * en castellano. Lee siempre los componentes en UTC, igual que
 * `formatCalendarDate`, para que una fecha de negocio nunca se desplace un
 * dia por la zona horaria del proceso (`0.8.0` / MVP-2B: rotulo semanal del
 * historico general).
 */
export function formatCalendarDateEs(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${day}/${month}/${year}`;
}

/** Devuelve el dia ISO de la semana: 1 = lunes ... 7 = domingo. */
export function isoWeekday(date: Date): number {
  const jsDay = date.getUTCDay(); // 0 = domingo ... 6 = sabado
  return jsDay === 0 ? 7 : jsDay;
}

export function isMonday(date: Date): boolean {
  return isoWeekday(date) === 1;
}

/** Suma (o resta) dias de calendario a una fecha UTC de medianoche. */
export function addCalendarDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

export interface GeneratedWeek {
  sequenceNumber: number;
  startDate: Date;
  endDate: Date;
}

/**
 * Genera las semanas de un split a partir de su lunes inicial y su numero
 * de semanas. La semana `n` empieza `7 * (n - 1)` dias despues del inicio
 * del split y termina el domingo siguiente.
 */
export function generateSplitWeeks(startDate: Date, numberOfWeeks: number): GeneratedWeek[] {
  if (!isMonday(startDate)) {
    throw new Error("La fecha de inicio del split debe ser un lunes.");
  }
  if (!Number.isInteger(numberOfWeeks) || numberOfWeeks < 1) {
    throw new Error("El numero de semanas debe ser un entero positivo.");
  }

  const weeks: GeneratedWeek[] = [];
  for (let sequenceNumber = 1; sequenceNumber <= numberOfWeeks; sequenceNumber += 1) {
    const weekStart = addCalendarDays(startDate, 7 * (sequenceNumber - 1));
    const weekEnd = addCalendarDays(weekStart, 6);
    weeks.push({ sequenceNumber, startDate: weekStart, endDate: weekEnd });
  }
  return weeks;
}
