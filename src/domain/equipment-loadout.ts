/**
 * Conjunto de equipo ("loadout") del participante (`1.2.0`, ver
 * docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md).
 *
 * Funciones puras compartidas por el editor de la ficha (cliente) y por el
 * guardado atomico (`saveEquipmentLoadout`, servidor). El cliente solo las
 * usa para la experiencia de uso: **todas** las comprobaciones se repiten en
 * servidor, que nunca confia en un borrador del navegador.
 *
 * La fuente de verdad persistida sigue siendo `SplitParticipantEquippedItem`:
 * aqui no hay estado, ni acceso a base de datos, ni formula de resultados.
 */

/** Una asignacion del borrador: que objeto poseido ocupa que ranura. */
export interface LoadoutAssignment {
  equipmentSlotId: string;
  ownedItemId: string;
}

/** Lo minimo que el editor necesita saber de un objeto poseido para validar una asignacion. */
export interface LoadoutOwnedItemRef {
  ownedItemId: string;
  /** Ranura del catalogo a la que pertenece el objeto. Es la unica compatibilidad posible. */
  equipmentSlotId: string;
}

export type LoadoutValidationCode =
  | "SLOT_DUPLICADA"
  | "OBJETO_DUPLICADO"
  | "OBJETO_NO_POSEIDO"
  | "RANURA_DESCONOCIDA"
  | "RANURA_INACTIVA"
  | "RANURA_INCOMPATIBLE"
  | "DEMASIADAS_RANURAS";

export interface LoadoutValidationIssue {
  code: LoadoutValidationCode;
  message: string;
  equipmentSlotId?: string;
  ownedItemId?: string;
}

export interface LoadoutValidationContext {
  /** Ranuras del split que admiten equipo nuevo (activas, del mismo split). */
  activeSlotIds: readonly string[];
  /** Ranuras que existen en el split, activas o no. Sirve para distinguir "inactiva" de "desconocida". */
  knownSlotIds: readonly string[];
  /** Objetos realmente poseidos por esta participacion. */
  ownedItems: readonly LoadoutOwnedItemRef[];
  /** Tope tecnico de filas aceptadas en una sola confirmacion. */
  maxAssignments: number;
}

/**
 * Ordena y deduplica una lista de asignaciones para poder compararlas y
 * firmarlas de forma estable. No valida nada: eso es
 * `validateLoadoutAssignments`.
 */
export function normalizeLoadoutAssignments(assignments: readonly LoadoutAssignment[]): LoadoutAssignment[] {
  const bySlot = new Map<string, LoadoutAssignment>();
  for (const assignment of assignments) {
    // La ultima asignacion de una ranura gana: una lista con la misma ranura repetida
    // se rechaza igualmente en la validacion, pero la firma nunca depende del orden de llegada.
    bySlot.set(assignment.equipmentSlotId, {
      equipmentSlotId: assignment.equipmentSlotId,
      ownedItemId: assignment.ownedItemId,
    });
  }
  return [...bySlot.values()].sort((a, b) => a.equipmentSlotId.localeCompare(b.equipmentSlotId));
}

/**
 * Todas las reglas del borrador, en un unico sitio (seccion 9.4 del
 * encargo). Devuelve la lista completa de problemas, nunca se detiene en el
 * primero: la interfaz puede explicarlos todos a la vez.
 */
export function validateLoadoutAssignments(
  assignments: readonly LoadoutAssignment[],
  context: LoadoutValidationContext,
): LoadoutValidationIssue[] {
  const issues: LoadoutValidationIssue[] = [];

  if (assignments.length > context.maxAssignments) {
    issues.push({
      code: "DEMASIADAS_RANURAS",
      message: `No se pueden equipar mas de ${context.maxAssignments} ranuras a la vez.`,
    });
    return issues;
  }

  const activeSlots = new Set(context.activeSlotIds);
  const knownSlots = new Set(context.knownSlotIds);
  const ownedBySlotItem = new Map(context.ownedItems.map((item) => [item.ownedItemId, item]));

  const seenSlots = new Set<string>();
  const seenItems = new Set<string>();

  for (const assignment of assignments) {
    if (seenSlots.has(assignment.equipmentSlotId)) {
      issues.push({
        code: "SLOT_DUPLICADA",
        message: "Cada ranura solo puede tener un objeto equipado.",
        equipmentSlotId: assignment.equipmentSlotId,
      });
    }
    seenSlots.add(assignment.equipmentSlotId);

    if (seenItems.has(assignment.ownedItemId)) {
      issues.push({
        code: "OBJETO_DUPLICADO",
        message: "Un mismo objeto no puede ocupar dos ranuras.",
        ownedItemId: assignment.ownedItemId,
      });
    }
    seenItems.add(assignment.ownedItemId);

    const owned = ownedBySlotItem.get(assignment.ownedItemId);
    if (!owned) {
      issues.push({
        code: "OBJETO_NO_POSEIDO",
        message: "No posees ese objeto en este split.",
        ownedItemId: assignment.ownedItemId,
      });
      continue;
    }

    if (!knownSlots.has(assignment.equipmentSlotId)) {
      issues.push({
        code: "RANURA_DESCONOCIDA",
        message: "La ranura indicada no pertenece a este split.",
        equipmentSlotId: assignment.equipmentSlotId,
      });
      continue;
    }

    if (owned.equipmentSlotId !== assignment.equipmentSlotId) {
      issues.push({
        code: "RANURA_INCOMPATIBLE",
        message: "Ese objeto pertenece a otra ranura.",
        equipmentSlotId: assignment.equipmentSlotId,
        ownedItemId: assignment.ownedItemId,
      });
      continue;
    }

    if (!activeSlots.has(assignment.equipmentSlotId)) {
      issues.push({
        code: "RANURA_INACTIVA",
        message: "Esa ranura esta desactivada: no admite equipo nuevo.",
        equipmentSlotId: assignment.equipmentSlotId,
      });
    }
  }

  return issues;
}

/**
 * Revision estable del equipo confirmado (seccion 9.7 del encargo). Es una
 * firma textual determinista del conjunto (ranura + objeto), no un secreto ni
 * un identificador de seguridad: solo sirve para detectar que el equipo ha
 * cambiado en otra pestaña y no sobrescribirlo en silencio.
 *
 * Deliberadamente no usa `updatedAt`: dos confirmaciones que dejan el mismo
 * conjunto producen la misma revision, que es exactamente lo que se quiere.
 */
export function computeLoadoutRevision(assignments: readonly LoadoutAssignment[]): string {
  const normalized = normalizeLoadoutAssignments(assignments);
  if (normalized.length === 0) return "vacio";
  return normalized.map((assignment) => `${assignment.equipmentSlotId}:${assignment.ownedItemId}`).join("|");
}

/** `true` si dos conjuntos contienen exactamente las mismas parejas ranura/objeto. */
export function areLoadoutsEqual(a: readonly LoadoutAssignment[], b: readonly LoadoutAssignment[]): boolean {
  return computeLoadoutRevision(a) === computeLoadoutRevision(b);
}
