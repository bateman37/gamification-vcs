import { z, ZodError } from "zod";
import { KPI_CATALOG, KPI_CATALOG_LIST, type KpiCode } from "@/domain/kpis/catalog";

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

export interface BulkKpiConfigUpdate {
  kpiCode: KpiCode;
  input: UpdateKpiConfigInput;
}

export type BulkKpiConfigParseResult =
  | { ok: true; updates: BulkKpiConfigUpdate[] }
  | { ok: false; fieldErrors: Record<string, string> };

/**
 * Lee y valida los diez KPI de una unica `FormData` compartida por el
 * guardado individual y el guardado conjunto (`1.0.1`, parte H del
 * encargo): cada campo se nombra con el prefijo `${kpiCode}__` para no
 * colisionar entre KPI dentro del mismo `<form>`. Funcion pura (sin
 * acceso a base de datos ni a la sesion) para poder probarla sin mockear
 * autenticacion: valida cada KPI con el mismo esquema que el guardado
 * individual y, si cualquiera falla, no devuelve ninguna actualizacion
 * (el llamador nunca debe persistir un lote parcial).
 */
export function parseAllKpiConfigsFromFormData(formData: FormData): BulkKpiConfigParseResult {
  const updates: BulkKpiConfigUpdate[] = [];
  const fieldErrors: Record<string, string> = {};

  for (const catalogEntry of KPI_CATALOG_LIST) {
    const prefix = `${catalogEntry.code}__`;
    const rawParameters: Record<string, FormDataEntryValue | null> = {};
    for (const parameter of catalogEntry.parameters) {
      rawParameters[parameter.key] = formData.get(`${prefix}${parameter.key}`);
    }

    try {
      const input = buildKpiConfigSchema(catalogEntry.code).parse({
        isActive: formData.get(`${prefix}isActive`) === "on",
        baseMax: formData.get(`${prefix}baseMax`),
        multiplierN0: formData.get(`${prefix}multiplierN0`),
        multiplierN1: formData.get(`${prefix}multiplierN1`),
        multiplierN2: formData.get(`${prefix}multiplierN2`),
        parameters: rawParameters,
      });
      updates.push({ kpiCode: catalogEntry.code, input });
    } catch (error) {
      if (!(error instanceof ZodError)) throw error;
      for (const issue of error.issues) {
        const key = `${catalogEntry.code}.${issue.path.join(".")}`;
        if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }
  return { ok: true, updates };
}
