/** Normaliza un correo electronico para comparaciones e indice unico. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normaliza un alias de participante para comprobar unicidad dentro de un
 * split: sin distinguir mayusculas/minusculas ni espacios exteriores.
 */
export function normalizeAlias(alias: string): string {
  return alias.trim().toLowerCase();
}
