import { ZodError } from "zod";
import { DomainError } from "@/lib/errors";

export interface ActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export const initialActionState: ActionState = { ok: false };

/**
 * Ejecuta una accion de servidor capturando los errores esperables
 * (validacion de zod, reglas de negocio) y devolviendo un mensaje en
 * castellano apto para mostrar en la interfaz. Cualquier otro error se
 * relanza: Next.js lo tratara como error de servidor generico.
 */
export async function runAction(fn: () => Promise<void>): Promise<ActionState> {
  try {
    await fn();
    return { ok: true };
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) {
        // Se usa la ruta completa (p.ej. "parameters.pointsPerHour") para
        // poder asociar el error a un campo anidado concreto. Para rutas
        // de un solo nivel (el caso habitual) el resultado es identico a
        // usar solo el primer segmento.
        const key = issue.path.join(".");
        if (key && !(key in fieldErrors)) {
          fieldErrors[key] = issue.message;
        }
      }
      return {
        ok: false,
        error: "Revisa los datos del formulario.",
        fieldErrors,
      };
    }
    if (error instanceof DomainError) {
      return {
        ok: false,
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    throw error;
  }
}
