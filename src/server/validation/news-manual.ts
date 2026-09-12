import { z } from "zod";
import { MANUAL_NEWS_DESTINATIONS } from "@/domain/news-links";

/**
 * Validacion del envio manual de noticias (seccion 41 del encargo): titulo
 * y cuerpo son texto plano acotado; el destino solo puede ser uno de los
 * cuatro cerrados (nunca una URL libre).
 */
export const manualNewsFormSchema = z
  .object({
    splitId: z.string().min(1, "Selecciona un split."),
    audienceType: z.enum(["SPLIT", "FACTION", "PERSON"], { errorMap: () => ({ message: "Selecciona un publico." }) }),
    factionId: z.string().optional(),
    splitParticipantId: z.string().optional(),
    priority: z.enum(["NORMAL", "IMPORTANT"]),
    title: z
      .string()
      .trim()
      .min(1, "El titulo es obligatorio.")
      .max(120, "El titulo no puede superar 120 caracteres."),
    body: z
      .string()
      .trim()
      .min(1, "El mensaje es obligatorio.")
      .max(600, "El mensaje no puede superar 600 caracteres."),
    destination: z.enum(MANUAL_NEWS_DESTINATIONS, { errorMap: () => ({ message: "Destino no valido." }) }),
    idempotencyKey: z.string().min(1, "Falta la clave de envio."),
  })
  .refine((data) => data.audienceType !== "FACTION" || Boolean(data.factionId), {
    message: "Selecciona una faccion.",
    path: ["factionId"],
  })
  .refine((data) => data.audienceType !== "PERSON" || Boolean(data.splitParticipantId), {
    message: "Selecciona una persona.",
    path: ["splitParticipantId"],
  });

export type ManualNewsFormInput = z.infer<typeof manualNewsFormSchema>;
