import type { Split } from "@prisma/client";
import { DomainError } from "@/lib/errors";

/**
 * Helpers compartidos por los cinco servicios de entrada manual (Guardian
 * de la Estabilidad, Cronomagia laboral, Redactor estrella, Estudiante
 * entusiasta, Aprendiz experto; ver docs/MANUAL_KPI_ENTRY.md). No es un
 * motor generico de formularios: cada servicio sigue declarando sus propios
 * campos, validaciones y calculo.
 */

export type ManualEntryLoadStatus = "PENDING" | "LOADED";

/**
 * `PENDING` mientras falte algun participante requerido; `LOADED` cuando
 * todos tienen fila guardada. Si no hay ningun participante requerido
 * (por ejemplo, Guardian sin N2 aplicable esta semana), se considera
 * `LOADED`: de lo contrario nunca se podria alcanzar `X/X`.
 */
export function computeManualEntryStatus(
  requiredParticipantIds: string[],
  savedParticipantIds: ReadonlySet<string>,
): ManualEntryLoadStatus {
  if (requiredParticipantIds.length === 0) return "LOADED";
  return requiredParticipantIds.every((id) => savedParticipantIds.has(id)) ? "LOADED" : "PENDING";
}

/** Solo un split `ACTIVE` permite introducir o actualizar una entrada manual; se comprueba en el servicio, no solo en la interfaz. */
export function assertSplitAcceptsManualEntries(split: Split, originLabel: string): void {
  if (split.status !== "ACTIVE") {
    throw new DomainError(`Solo se puede introducir o actualizar datos de ${originLabel} en un split activo.`);
  }
}
