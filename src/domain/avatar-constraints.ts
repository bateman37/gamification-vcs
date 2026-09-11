/**
 * Limites del avatar de participante (`0.8.0` / MVP-2B). Viven en
 * `src/domain` porque los consumen tanto el procesamiento en servidor
 * (`src/server/services/avatar-image.ts`, que usa `sharp`) como el
 * formulario de la ficha, que es un Client Component y no debe arrastrar
 * ninguna dependencia de servidor.
 */

/** Tamano maximo del archivo subido. */
export const AVATAR_MAX_INPUT_BYTES = 5 * 1024 * 1024;

/** Ningun lado de la imagen guardada supera este numero de pixeles. */
export const AVATAR_MAX_DIMENSION = 512;

/** Tamano maximo de la imagen ya procesada que se persiste. */
export const AVATAR_MAX_STORED_BYTES = 1024 * 1024;

/** MIME final real de la imagen guardada. */
export const AVATAR_OUTPUT_MIME = "image/webp";

/** Ayuda de interfaz para el selector de archivo. La validacion real es siempre de servidor. */
export const AVATAR_ACCEPT_ATTRIBUTE = "image/jpeg,image/png,image/webp";

export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
