/**
 * Fecha relativa en castellano para noticias (seccion 23 del encargo):
 * "hace 5 minutos", "hace 3 horas", "hace 2 dias"... Funcion pura con `now`
 * inyectable para poder probarla sin depender del reloj real.
 */
export function formatRelativeTimeEs(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSeconds < 60) return "hace un momento";

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return diffMinutes === 1 ? "hace 1 minuto" : `hace ${diffMinutes} minutos`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return diffHours === 1 ? "hace 1 hora" : `hace ${diffHours} horas`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return diffDays === 1 ? "hace 1 dia" : `hace ${diffDays} dias`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return diffMonths === 1 ? "hace 1 mes" : `hace ${diffMonths} meses`;

  const diffYears = Math.floor(diffMonths / 12);
  return diffYears === 1 ? "hace 1 ano" : `hace ${diffYears} anos`;
}
