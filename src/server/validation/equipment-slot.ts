import { z } from "zod";

/**
 * Validacion del formulario de ranuras de equipo (`0.9.0` / MVP-2D, ver
 * docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md). El numero y el nombre de las
 * ranuras los decide siempre el administrador: no hay ranuras codificadas.
 */

const MAX_SLOT_NAME_LENGTH = 60;

export const equipmentSlotFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre de la ranura es obligatorio.")
    .max(MAX_SLOT_NAME_LENGTH, `El nombre no puede superar los ${MAX_SLOT_NAME_LENGTH} caracteres.`),
});

export type EquipmentSlotFormInput = z.infer<typeof equipmentSlotFormSchema>;
