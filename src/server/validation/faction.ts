import { z } from "zod";

/**
 * Validacion de formulario de facciones (`0.7.0` / MVP-2A, ver
 * docs/FACTIONS.md). El color es un hexadecimal `#RRGGBB` (mismo formato
 * exigido por la restriccion de base de datos `SplitFaction_color_format_check`).
 */

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export const factionFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(60, "El nombre es demasiado largo."),
  color: z
    .string()
    .trim()
    .regex(HEX_COLOR_PATTERN, "El color debe ser un hexadecimal con el formato #RRGGBB."),
});

export type FactionFormInput = z.infer<typeof factionFormSchema>;
