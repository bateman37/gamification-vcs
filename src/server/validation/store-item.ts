import { z } from "zod";
import { KPI_CODES } from "@/domain/kpis/catalog";
import { EQUIPMENT_BONUS_PERCENTS } from "@/domain/equipment-bonus";

/**
 * Validacion del formulario de objetos del catalogo (`0.9.0` / MVP-2D, ver
 * docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md, seccion 12 del encargo). Nunca se
 * acepta un precio decimal o no positivo, un porcentaje libre, ni formulas,
 * expresiones o JSON enviado por el navegador: solo nombre, descripcion
 * opcional, precio entero, ranura, un KPI del catalogo cerrado y un
 * porcentaje de la lista cerrada.
 */

const MAX_ITEM_NAME_LENGTH = 80;
const MAX_ITEM_DESCRIPTION_LENGTH = 280;

export const storeItemFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre del objeto es obligatorio.")
    .max(MAX_ITEM_NAME_LENGTH, `El nombre no puede superar los ${MAX_ITEM_NAME_LENGTH} caracteres.`),
  description: z
    .string()
    .trim()
    .max(MAX_ITEM_DESCRIPTION_LENGTH, `La descripcion no puede superar los ${MAX_ITEM_DESCRIPTION_LENGTH} caracteres.`)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  priceCredits: z.coerce
    .number({ invalid_type_error: "Introduce un precio en créditos." })
    .int("El precio debe ser un número entero.")
    .positive("El precio debe ser mayor que cero."),
  equipmentSlotId: z.string().trim().min(1, "Selecciona una ranura."),
  kpiCode: z.enum(KPI_CODES, {
    required_error: "Selecciona el KPI que potencia el objeto.",
    invalid_type_error: "El KPI seleccionado no pertenece al catalogo.",
  }),
  bonusPercent: z.coerce
    .number({ invalid_type_error: "Selecciona un porcentaje de bonus." })
    .refine((value) => (EQUIPMENT_BONUS_PERCENTS as readonly number[]).includes(value), {
      message: "El bonus debe ser 10 %, 20 %, 30 %, 40 % o 50 %.",
    }),
});

export type StoreItemFormInput = z.infer<typeof storeItemFormSchema>;
