/**
 * Limites de la imagen opcional de un objeto del catalogo (`1.2.0`, seccion
 * 7.3 del encargo). Viven en `src/domain` por el mismo motivo que
 * `avatar-constraints.ts`: los consumen tanto el procesamiento en servidor
 * (`src/server/services/store-item-image.service.ts`, que usa `sharp`) como
 * el formulario administrativo, que es un Client Component y no debe
 * arrastrar ninguna dependencia de servidor.
 *
 * Se reutilizan deliberadamente los mismos valores que el avatar: mismo
 * tamano maximo de entrada, misma dimension maxima, mismo formato de salida
 * y el mismo tope de bytes almacenados. Una sola regla que explicar al
 * administrador y un solo comportamiento que mantener.
 */

import {
  AVATAR_ACCEPT_ATTRIBUTE,
  AVATAR_MAX_DIMENSION,
  AVATAR_MAX_INPUT_BYTES,
  AVATAR_MAX_STORED_BYTES,
  AVATAR_OUTPUT_MIME,
} from "@/domain/avatar-constraints";

export const STORE_ITEM_IMAGE_MAX_INPUT_BYTES = AVATAR_MAX_INPUT_BYTES;
export const STORE_ITEM_IMAGE_MAX_DIMENSION = AVATAR_MAX_DIMENSION;
export const STORE_ITEM_IMAGE_MAX_STORED_BYTES = AVATAR_MAX_STORED_BYTES;
export const STORE_ITEM_IMAGE_OUTPUT_MIME = AVATAR_OUTPUT_MIME;

/** Ayuda de interfaz para el selector de archivo. La validacion real es siempre de servidor. */
export const STORE_ITEM_IMAGE_ACCEPT_ATTRIBUTE = AVATAR_ACCEPT_ATTRIBUTE;

/** Nombre del campo del formulario, compartido por la accion y el componente. */
export const STORE_ITEM_IMAGE_FIELD = "image";

/** Ruta publica (autenticada) desde la que el navegador pide la imagen ya procesada. */
export function storeItemImagePath(splitId: string, storeItemId: string, imageVersion: string | null): string {
  const base = `/api/splits/${splitId}/objetos/${storeItemId}/imagen`;
  // El `sha256` en la URL permite cachear de forma agresiva por version sin servir nunca una imagen antigua.
  return imageVersion ? `${base}?v=${imageVersion}` : base;
}
