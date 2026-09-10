import { z } from "zod";
import { KPI_CATALOG, type KpiCode } from "@/domain/kpis/catalog";

/**
 * Convierte texto de un campo numerico (acepta coma o punto decimal) en un
 * numero, o `undefined` si esta vacio/ausente. Los valores no numericos se
 * convierten en `NaN` para que la validacion posterior los rechace con un
 * mensaje claro.
 */
function coerceDecimalInput(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  return Number(trimmed.replace(",", "."));
}

const baseMaxSchema = z.preprocess(
  coerceDecimalInput,
  z
    .number({
      required_error: "El maximo base es obligatorio.",
      invalid_type_error: "El maximo base debe ser un numero.",
    })
    .finite("El maximo base debe ser un numero finito.")
    .positive("El maximo base debe ser mayor que cero."),
);

/**
 * Multiplicador de nivel: opcional (vacio = nivel no aplicable) y, cuando
 * se informa, mayor o igual que cero.
 */
const multiplierSchema = z.preprocess(
  coerceDecimalInput,
  z
    .number({ invalid_type_error: "El multiplicador debe ser un numero." })
    .finite("El multiplicador debe ser un numero finito.")
    .min(0, "El multiplicador debe ser mayor o igual que cero.")
    .optional(),
);

/** Construye el esquema de validacion completo del formulario de un KPI concreto. */
export function buildKpiConfigSchema(kpiCode: KpiCode) {
  const catalogEntry = KPI_CATALOG[kpiCode];
  return z
    .object({
      isActive: z.boolean(),
      baseMax: baseMaxSchema,
      multiplierN0: multiplierSchema,
      multiplierN1: multiplierSchema,
      multiplierN2: multiplierSchema,
      parameters: catalogEntry.parametersSchema,
    })
    .refine(
      (value) =>
        !value.isActive ||
        value.multiplierN0 !== undefined ||
        value.multiplierN1 !== undefined ||
        value.multiplierN2 !== undefined,
      {
        message: `Para activar "${catalogEntry.name}" debe informarse al menos un multiplicador de nivel aplicable.`,
        path: ["isActive"],
      },
    );
}

export type UpdateKpiConfigInput = z.infer<ReturnType<typeof buildKpiConfigSchema>>;
