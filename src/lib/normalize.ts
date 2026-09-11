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

/**
 * Normalizacion comun para emparejar nombres reales (`Person.fullName`
 * frente a la columna "Nombre del actualizador" del Excel de
 * productividad) y para reconocer encabezados de columna: recorta los
 * espacios exteriores, colapsa espacios internos consecutivos, pasa a
 * minusculas y elimina diacriticos. Se conserva siempre el texto original
 * para mostrarlo en la interfaz; esta funcion solo se usa para comparar.
 */
export function normalizeForMatching(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
