/**
 * Asistencia semanal (`1.1.1`, ver docs/WEEKLY_ATTENDANCE_AND_HOURS.md): se
 * determina exclusivamente por `totalHours` de la captura semanal de horas
 * (compartida con Cronomagia laboral, `ChronomancyWeeklyEntry`), nunca por
 * otro KPI, `VAC`, creditos o el nivel del participante. `totalHours > 0`
 * significa presente (cualquier valor positivo, no solo 40); `totalHours = 0`
 * (o una fila guardada vacia, normalizada a 0) significa ausente. Si el
 * bloque de horas no se ha guardado todavia para un participante, la
 * asistencia es desconocida y la semana no es publicable.
 */

export type WeeklyAttendanceStatus = "PRESENT" | "ABSENT";

/** Resultado de resolver la asistencia de un participante para una semana. */
export type WeeklyAttendanceResolution =
  /** El bloque de horas no se ha guardado (todavia) para este participante. */
  | { recorded: false }
  | { recorded: true; status: WeeklyAttendanceStatus; totalHours: number; productiveHours: number | null };

/**
 * Funcion pura y unica que decide la asistencia semanal. `entry` es la fila
 * guardada de horas para ese participante y semana (`undefined` si no
 * existe). No usa ningun otro dato (KPI, VAC, nivel) para decidir.
 */
export function resolveWeeklyAttendance(
  entry: { totalHours: number; productiveHours: number | null } | undefined,
): WeeklyAttendanceResolution {
  if (entry === undefined) return { recorded: false };
  const status: WeeklyAttendanceStatus = entry.totalHours === 0 ? "ABSENT" : "PRESENT";
  return { recorded: true, status, totalHours: entry.totalHours, productiveHours: entry.productiveHours };
}

/** Texto funcional unico para una ausencia confirmada (ver docs/DECISIONS.md: nunca "VAC"/"Vacaciones"). */
export const ABSENCE_LABEL = "Ausencia · Sin datos semanales";

/** Texto funcional unico para un bloque de horas todavia no guardado. */
export const HOURS_NOT_RECORDED_LABEL = "Pendiente de registrar horas semanales";
