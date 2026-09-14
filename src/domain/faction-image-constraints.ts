/**
 * Limites de la imagen opcional de una faccion (`1.2.2`, ver
 * docs/FACTIONS.md). Viven en `src/domain` por el mismo motivo que
 * `store-item-image-constraints.ts`: los consumen tanto el procesamiento en
 * servidor (`src/server/services/faction-image.service.ts`, que usa `sharp`)
 * como los formularios administrativos, que son Client Components y no
 * deben arrastrar ninguna dependencia de servidor.
 *
 * Se reutilizan deliberadamente los mismos valores que el avatar y la
 * imagen de objeto: mismo tamano maximo de entrada, misma dimension
 * maxima, mismo formato de salida y el mismo tope de bytes almacenados.
 */

import {
  AVATAR_ACCEPT_ATTRIBUTE,
  AVATAR_MAX_DIMENSION,
  AVATAR_MAX_INPUT_BYTES,
  AVATAR_MAX_STORED_BYTES,
  AVATAR_OUTPUT_MIME,
} from "@/domain/avatar-constraints";

export const FACTION_IMAGE_MAX_INPUT_BYTES = AVATAR_MAX_INPUT_BYTES;
export const FACTION_IMAGE_MAX_DIMENSION = AVATAR_MAX_DIMENSION;
export const FACTION_IMAGE_MAX_STORED_BYTES = AVATAR_MAX_STORED_BYTES;
export const FACTION_IMAGE_OUTPUT_MIME = AVATAR_OUTPUT_MIME;

/** Ayuda de interfaz para el selector de archivo. La validacion real es siempre de servidor. */
export const FACTION_IMAGE_ACCEPT_ATTRIBUTE = AVATAR_ACCEPT_ATTRIBUTE;

/** Nombre del campo del formulario, compartido por la accion y el componente. */
export const FACTION_IMAGE_FIELD = "image";

/** Ruta publica (autenticada) desde la que el navegador pide el emblema ya procesado. */
export function factionImagePath(splitId: string, factionId: string, imageVersion: string | null): string {
  const base = `/api/splits/${splitId}/facciones/${factionId}/imagen`;
  // El `sha256` en la URL permite cachear de forma agresiva por version sin servir nunca una imagen antigua.
  return imageVersion ? `${base}?v=${imageVersion}` : base;
}
