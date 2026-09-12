import { z } from "zod";
import { KPI_CODES } from "@/domain/kpis/catalog";
import { LOCATION_BONUS_PERCENTS } from "@/domain/location-bonus";

/**
 * Validacion del formulario de localizacion semanal (`0.8.5` / MVP-2C, ver
 * docs/WEEKLY_LOCATIONS.md). Nunca se acepta un porcentaje libre, decimal o
 * fuera del conjunto cerrado, ni formulas, expresiones o JSON libre: solo un
 * nombre, un codigo del catalogo cerrado de KPI y un porcentaje de la lista
 * cerrada.
 */

const MAX_LOCATION_NAME_LENGTH = 80;

export const weekLocationFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre de la localización es obligatorio.")
    .max(MAX_LOCATION_NAME_LENGTH, `El nombre no puede superar los ${MAX_LOCATION_NAME_LENGTH} caracteres.`),
  kpiCode: z.enum(KPI_CODES, {
    required_error: "Selecciona el KPI que potencia la localización.",
    invalid_type_error: "El KPI seleccionado no pertenece al catalogo.",
  }),
  bonusPercent: z.coerce
    .number({ invalid_type_error: "Selecciona un porcentaje de bonus." })
    .refine((value) => (LOCATION_BONUS_PERCENTS as readonly number[]).includes(value), {
      message: "El bonus debe ser 10 %, 20 %, 30 %, 40 % o 50 %.",
    }),
});

export type WeekLocationFormInput = z.infer<typeof weekLocationFormSchema>;
