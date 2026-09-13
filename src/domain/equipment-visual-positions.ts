import type { EquipmentVisualPosition } from "@prisma/client";

/**
 * Catalogo cerrado de posiciones visuales del tablero de equipo (`1.2.0`,
 * ver docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md).
 *
 * Tres conceptos distintos que esta entrega separa a proposito:
 *
 * - **identidad tecnica**: `SplitEquipmentSlot.id`, estable para siempre. Es
 *   lo unico que relaciona objetos, compras, inventario, equipo y snapshots;
 * - **posicion visual**: una de las diez claves de este catalogo. Decide
 *   donde se dibuja la ranura, nunca a que objetos pertenece;
 * - **nombre visible**: texto libre que el administrador puede renombrar
 *   (`Cabeza` -> `Casco`, `Mano izquierda` -> `Arma`) sin mover la ranura ni
 *   romper ninguna relacion.
 *
 * Las claves son persistentes y no traducibles; los nombres base solo son el
 * valor inicial visible al activar una posicion.
 *
 * La rejilla prioriza la comprension del usuario, no la anatomia del
 * personaje: `Mano izquierda` se dibuja en la columna izquierda de la
 * pantalla y `Mano derecha` en la derecha (seccion 4.2 del encargo).
 */

export interface EquipmentVisualPositionDefinition {
  position: EquipmentVisualPosition;
  /** Nombre base en castellano: solo el valor inicial visible, nunca una clave. */
  baseName: string;
  /** Fila de la composicion (1 = superior). */
  row: 1 | 2 | 3 | 4;
  /** Columna de la composicion (1 = izquierda de la pantalla). */
  column: 1 | 2 | 3;
  /** Orden de presentacion cuando la rejilla se aplana (movil, listados, desglose). */
  order: number;
}

/**
 * Orden y rejilla fijos del catalogo:
 *
 * ```text
 *                  Cabeza
 * Mano izquierda   Torso      Mano derecha
 * Manos            Piernas    Capa
 * Artefacto        Pies       Reliquia
 * ```
 */
export const EQUIPMENT_VISUAL_POSITIONS: readonly EquipmentVisualPositionDefinition[] = [
  { position: "HEAD", baseName: "Cabeza", row: 1, column: 2, order: 0 },
  { position: "LEFT_HAND", baseName: "Mano izquierda", row: 2, column: 1, order: 1 },
  { position: "TORSO", baseName: "Torso", row: 2, column: 2, order: 2 },
  { position: "RIGHT_HAND", baseName: "Mano derecha", row: 2, column: 3, order: 3 },
  { position: "HANDS", baseName: "Manos", row: 3, column: 1, order: 4 },
  { position: "LEGS", baseName: "Piernas", row: 3, column: 2, order: 5 },
  { position: "CAPE", baseName: "Capa", row: 3, column: 3, order: 6 },
  { position: "ARTIFACT", baseName: "Artefacto", row: 4, column: 1, order: 7 },
  { position: "FEET", baseName: "Pies", row: 4, column: 2, order: 8 },
  { position: "RELIC", baseName: "Reliquia", row: 4, column: 3, order: 9 },
] as const;

/** Las diez claves del catalogo, en orden visual. */
export const EQUIPMENT_VISUAL_POSITION_KEYS: readonly EquipmentVisualPosition[] = EQUIPMENT_VISUAL_POSITIONS.map(
  (definition) => definition.position,
);

/**
 * Maximo funcional de ranuras ubicadas por split: exactamente las diez
 * posiciones del catalogo. No es un limite sobre las filas existentes: una
 * base historica puede tener mas ranuras sin ubicar y nunca debe fallar,
 * truncarse ni perder datos por ello (seccion 5.3 del encargo).
 */
export const MAX_PLACED_EQUIPMENT_SLOTS_PER_SPLIT = EQUIPMENT_VISUAL_POSITIONS.length;

const DEFINITION_BY_POSITION = new Map<EquipmentVisualPosition, EquipmentVisualPositionDefinition>(
  EQUIPMENT_VISUAL_POSITIONS.map((definition) => [definition.position, definition]),
);

export function equipmentVisualPositionDefinition(
  position: EquipmentVisualPosition,
): EquipmentVisualPositionDefinition {
  const definition = DEFINITION_BY_POSITION.get(position);
  // El tipo ya lo garantiza; la comprobacion protege de un valor llegado de datos antiguos.
  if (!definition) throw new Error(`Posicion visual desconocida: ${position}`);
  return definition;
}

/** Nombre base en castellano de una posicion. Solo es el valor inicial visible de una ranura nueva. */
export function equipmentVisualPositionBaseName(position: EquipmentVisualPosition): string {
  return equipmentVisualPositionDefinition(position).baseName;
}

/** Orden visual de una posicion. Las ranuras sin posicion se ordenan despues, por su `displayOrder`. */
export function equipmentVisualPositionOrder(position: EquipmentVisualPosition): number {
  return equipmentVisualPositionDefinition(position).order;
}

/**
 * Convierte un valor recibido del navegador en una clave del catalogo, o
 * `null`. Nunca se aceptan claves libres: la validacion real vive siempre en
 * servidor, ademas de la restriccion de base de datos.
 */
export function parseEquipmentVisualPosition(value: unknown): EquipmentVisualPosition | null {
  if (typeof value !== "string") return null;
  const match = EQUIPMENT_VISUAL_POSITIONS.find((definition) => definition.position === value);
  return match ? match.position : null;
}

/**
 * Nombre base normalizado -> posicion. Unica tabla usada para el mapeo
 * automatico conservador de la migracion y para detectar la colision de
 * nombre al activar una posicion. Nunca se infiere una posicion a partir de
 * un nombre libre (`Arma`, `Escudo`, `Anillo`...).
 */
export const EQUIPMENT_VISUAL_POSITION_BY_NORMALIZED_BASE_NAME: ReadonlyMap<string, EquipmentVisualPosition> =
  new Map(EQUIPMENT_VISUAL_POSITIONS.map((definition) => [definition.baseName.toLowerCase(), definition.position]));
