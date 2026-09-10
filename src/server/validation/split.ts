import { z } from "zod";

export const MIN_SPLIT_WEEKS = 1;
export const MAX_SPLIT_WEEKS = 52;

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener el formato AAAA-MM-DD.");

export const createSplitSchema = z.object({
  name: z.string().trim().min(1, "El nombre del split es obligatorio.").max(200),
  description: z
    .union([z.literal(""), z.string().trim().max(2000)])
    .optional()
    .transform((value) => (value ? value : undefined)),
  startDate: isoDateSchema,
  numberOfWeeks: z.coerce
    .number()
    .int("El numero de semanas debe ser un numero entero.")
    .min(MIN_SPLIT_WEEKS, `El numero de semanas debe ser al menos ${MIN_SPLIT_WEEKS}.`)
    .max(MAX_SPLIT_WEEKS, `El numero de semanas no puede superar ${MAX_SPLIT_WEEKS}.`),
});

export type CreateSplitInput = z.infer<typeof createSplitSchema>;

export const updateSplitDraftSchema = createSplitSchema;
export type UpdateSplitDraftInput = z.infer<typeof updateSplitDraftSchema>;
