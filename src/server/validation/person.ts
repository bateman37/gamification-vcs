import { z } from "zod";

export const createPersonSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "El nombre completo es obligatorio.")
    .max(200, "El nombre completo es demasiado largo."),
  email: z
    .union([z.literal(""), z.string().trim().toLowerCase().email("El correo no tiene un formato valido.")])
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export type CreatePersonInput = z.infer<typeof createPersonSchema>;

export const updatePersonSchema = createPersonSchema;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
