import { z } from "zod";

export const participantLevelSchema = z.enum(["N0", "N1", "N2"]);

export const addParticipantSchema = z.object({
  personId: z.string().trim().min(1, "Selecciona una persona."),
  alias: z.string().trim().min(1, "El alias es obligatorio.").max(100),
  level: participantLevelSchema,
  startWeekSequenceNumber: z.coerce
    .number()
    .int("La semana inicial debe ser un numero entero.")
    .min(1, "La semana inicial debe ser al menos 1."),
});

export type AddParticipantInput = z.infer<typeof addParticipantSchema>;

export const updateParticipantSchema = z.object({
  alias: z.string().trim().min(1, "El alias es obligatorio.").max(100),
  level: participantLevelSchema,
});

export type UpdateParticipantInput = z.infer<typeof updateParticipantSchema>;
