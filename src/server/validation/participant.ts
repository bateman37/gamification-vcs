import { z } from "zod";

export const participantLevelSchema = z.enum(["N0", "N1", "N2"]);

export const addParticipantSchema = z.object({
  personId: z.string().trim().min(1, "Selecciona una persona."),
  alias: z.string().trim().min(1, "El alias es obligatorio.").max(100),
  level: participantLevelSchema,
  startWeekSequenceNumber: z.coerce
    .number()
    .int("La semana inicial debe ser un número entero.")
    .min(1, "La semana inicial debe ser al menos 1."),
  /** Obligatoria solo cuando el split ya tiene facciones creadas (ver docs/FACTIONS.md); se valida en el servicio. */
  factionId: z.string().trim().min(1).optional(),
  /**
   * Opcional hasta la primera publicacion del split; obligatoria en el propio
   * alta cuando el split ya usa profesiones y tiene alguna semana publicada
   * (ver docs/PROFESSIONS_AND_PROFILES.md). Se valida siempre en el servicio.
   */
  professionId: z.string().trim().min(1).optional(),
});

export type AddParticipantInput = z.infer<typeof addParticipantSchema>;

export const updateParticipantSchema = z.object({
  alias: z.string().trim().min(1, "El alias es obligatorio.").max(100),
  level: participantLevelSchema,
  factionId: z.string().trim().min(1).optional(),
  professionId: z.string().trim().min(1).optional(),
});

export type UpdateParticipantInput = z.infer<typeof updateParticipantSchema>;
