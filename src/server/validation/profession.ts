import { z } from "zod";
import { KPI_CODES } from "@/domain/kpis/catalog";

/**
 * Validacion del formulario de profesiones (`0.8.0` / MVP-2B, ver
 * docs/PROFESSIONS_AND_PROFILES.md). El porcentaje de bonus no forma parte
 * del formulario: es siempre `+20 %` (constante unica del dominio,
 * `src/domain/profession-bonus.ts`) y el administrador no puede editarlo.
 * Nunca se aceptan formulas, expresiones ni JSON libre: solo un nombre, dos
 * codigos del catalogo cerrado y tres casillas de disponibilidad por nivel.
 */

const kpiCodeSchema = z.enum(KPI_CODES, {
  required_error: "Selecciona un KPI del catalogo.",
  invalid_type_error: "El KPI seleccionado no pertenece al catalogo.",
});

export const professionFormSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio.").max(60, "El nombre es demasiado largo."),
    kpiCodeA: kpiCodeSchema,
    kpiCodeB: kpiCodeSchema,
    availableN0: z.boolean(),
    availableN1: z.boolean(),
    availableN2: z.boolean(),
  })
  .refine((input) => input.kpiCodeA !== input.kpiCodeB, {
    message: "Una profesion debe potenciar dos KPI distintos.",
    path: ["kpiCodeB"],
  })
  .refine((input) => input.availableN0 || input.availableN1 || input.availableN2, {
    message: "Selecciona al menos un nivel disponible (N0, N1 o N2).",
    path: ["availableN0"],
  });

export type ProfessionFormInput = z.infer<typeof professionFormSchema>;

/** Lee una casilla de un `FormData` (`"on"`/ausente) como booleano. */
export function readCheckbox(formData: FormData, field: string): boolean {
  const value = formData.get(field);
  return value !== null && value !== "" && value !== "false";
}
