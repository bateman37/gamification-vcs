import { z } from "zod";

/**
 * Catalogo cerrado de KPI de Split 8. Unica fuente de verdad tipada:
 * nombres, descripciones, orden de presentacion, valores predeterminados y
 * esquema de validacion de los parametros propios de cada KPI. No se
 * duplican estos valores en componentes, servicios ni validadores.
 *
 * El administrador no puede crear KPI nuevos ni introducir formulas
 * libres: la forma de cada calculo es fija y esta descrita aqui solo a
 * modo de documentacion legible para la interfaz. El motor de calculo en
 * si mismo no se implementa en MVP-1B.
 */

export const KPI_CODES = [
  "SOLUTION_HUNTER",
  "DATA_EXPLORER",
  "VOICE_AMBASSADOR",
  "MASTER_CRAFTSMAN",
  "ESCALATION_TAMER",
  "STABILITY_GUARDIAN",
  "WORK_CHRONOMANCY",
  "STAR_WRITER",
  "ENTHUSIASTIC_STUDENT",
  "EXPERT_APPRENTICE",
] as const;

export type KpiCode = (typeof KPI_CODES)[number];

export interface KpiParameterDefinition {
  /** Nombre tecnico del campo, usado como clave en `parameters` (JSON). */
  key: string;
  /** Etiqueta legible en castellano para el formulario y los mensajes de error. */
  label: string;
  /** Valor predeterminado de Split 8. */
  defaultValue: number;
}

export interface KpiCatalogEntry {
  code: KpiCode;
  /** Orden de presentacion en pantalla y en los listados. */
  order: number;
  name: string;
  description: string;
  /** Explicacion legible de la forma futura del calculo (todavia no implementado). */
  calculationExplanation: string;
  defaultBaseMax: number;
  defaultMultipliers: {
    N0: number | null;
    N1: number | null;
    N2: number | null;
  };
  parameters: KpiParameterDefinition[];
  /** Esquema de validacion de `parameters` para este KPI: solo los campos conocidos, todos numeros finitos mayores que cero. */
  parametersSchema: z.ZodTypeAny;
  defaultParameters: Record<string, number>;
}

/**
 * Convierte texto de un campo numerico (acepta coma o punto decimal) en un
 * numero, o `undefined` si esta vacio. Los valores no numericos se
 * convierten en `NaN` para que la validacion posterior los rechace con un
 * mensaje claro, en lugar de pasar silenciosamente como "vacio".
 */
function coerceDecimalInput(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  return Number(trimmed.replace(",", "."));
}

/** Campo numerico obligatorio, finito y mayor que cero. */
function positiveNumberField(fieldLabel: string): z.ZodTypeAny {
  return z.preprocess(
    coerceDecimalInput,
    z
      .number({
        required_error: `${fieldLabel} es obligatorio.`,
        invalid_type_error: `${fieldLabel} debe ser un número.`,
      })
      .finite(`${fieldLabel} debe ser un número finito.`)
      .positive(`${fieldLabel} debe ser mayor que cero.`),
  );
}

function buildParametersSchema(
  kpiName: string,
  parameters: KpiParameterDefinition[],
): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const parameter of parameters) {
    shape[parameter.key] = positiveNumberField(`"${parameter.label}" (${kpiName})`);
  }
  return z.object(shape).strict(`Parametros desconocidos para el KPI "${kpiName}".`);
}

function defaultParametersOf(parameters: KpiParameterDefinition[]): Record<string, number> {
  return Object.fromEntries(parameters.map((parameter) => [parameter.key, parameter.defaultValue]));
}

function entry(
  input: Omit<KpiCatalogEntry, "parametersSchema" | "defaultParameters">,
): KpiCatalogEntry {
  return {
    ...input,
    parametersSchema: buildParametersSchema(input.name, input.parameters),
    defaultParameters: defaultParametersOf(input.parameters),
  };
}

const CATALOG_ENTRIES: KpiCatalogEntry[] = [
  entry({
    code: "SOLUTION_HUNTER",
    order: 1,
    name: "Cazador de soluciones",
    description: "Puntúa los tickets resueltos por la persona.",
    calculationExplanation: "Tickets resueltos x puntos por ticket x multiplicador del nivel.",
    defaultBaseMax: 70,
    defaultMultipliers: { N0: 2.5, N1: 1, N2: 1.85 },
    parameters: [
      { key: "pointsPerResolvedTicket", label: "Puntos por ticket resuelto", defaultValue: 1 },
    ],
  }),
  entry({
    code: "DATA_EXPLORER",
    order: 2,
    name: "Explorador de datos",
    description: "Puntúa los tickets actualizados con comentario.",
    calculationExplanation:
      "Tickets actualizados con comentario x puntos por ticket x multiplicador del nivel.",
    defaultBaseMax: 70,
    defaultMultipliers: { N0: 0.62, N1: 0.5, N2: 1.5 },
    parameters: [
      { key: "pointsPerCommentedTicket", label: "Puntos por ticket comentado", defaultValue: 1 },
    ],
  }),
  entry({
    code: "VOICE_AMBASSADOR",
    order: 3,
    name: "Embajador de voz",
    description: "Puntúa las llamadas entrantes atendidas y las salientes realizadas.",
    calculationExplanation:
      "(Aceptadas x peso de aceptadas - rechazadas x penalización de rechazadas - no atendidas x penalización de no atendidas) x multiplicador del nivel + salientes x puntos por saliente. El multiplicador solo afecta al bloque de llamadas entrantes, no a las salientes.",
    defaultBaseMax: 50,
    defaultMultipliers: { N0: 1.25, N1: 1.5, N2: 2 },
    parameters: [
      { key: "acceptedWeight", label: "Peso de llamadas aceptadas", defaultValue: 1 },
      { key: "rejectedPenalty", label: "Penalización por llamada rechazada", defaultValue: 1 },
      { key: "unattendedPenalty", label: "Penalización por llamada no atendida", defaultValue: 1 },
      { key: "outboundPoints", label: "Puntos por llamada saliente", defaultValue: 1 },
    ],
  }),
  entry({
    code: "MASTER_CRAFTSMAN",
    order: 4,
    name: "Maestro Artesano",
    description: "Puntúa las valoraciones de calidad positivas y negativas.",
    calculationExplanation:
      "(Positivas x peso de positivas - negativas x penalizacion de negativas) x escala x multiplicador del nivel.",
    defaultBaseMax: 100,
    defaultMultipliers: { N0: 3, N1: 2, N2: 2 },
    parameters: [
      { key: "positiveWeight", label: "Peso de valoraciones positivas", defaultValue: 1 },
      { key: "negativePenalty", label: "Penalización por valoración negativa", defaultValue: 4 },
      { key: "scale", label: "Escala", defaultValue: 10 },
    ],
  }),
  entry({
    code: "ESCALATION_TAMER",
    order: 5,
    name: "Domador de Escaladas",
    description: "Penaliza la proporción de tickets escalados sobre los tickets gestionados.",
    calculationExplanation:
      "(Puntos base - (escalados / tickets gestionados) x factor de penalización) x multiplicador del nivel.",
    defaultBaseMax: 30,
    defaultMultipliers: { N0: 1, N1: 1, N2: 1 },
    parameters: [
      { key: "basePoints", label: "Puntos base", defaultValue: 30 },
      { key: "ratioPenaltyFactor", label: "Factor de penalización por ratio de escalados", defaultValue: 200 },
    ],
  }),
  entry({
    code: "STABILITY_GUARDIAN",
    order: 6,
    name: "Guardian de la Estabilidad",
    description: "Puntua los resultados de estabilidad de la persona. Por defecto solo aplica a N2.",
    calculationExplanation: "Resultados x puntos por resultado x multiplicador del nivel.",
    defaultBaseMax: 30,
    defaultMultipliers: { N0: null, N1: null, N2: 1 },
    parameters: [{ key: "pointsPerResult", label: "Puntos por resultado", defaultValue: 30 }],
  }),
  entry({
    code: "WORK_CHRONOMANCY",
    order: 7,
    name: "Cronomagia laboral",
    description: "Puntúa la ocupación (occupancy) de la persona durante la semana.",
    calculationExplanation:
      "Ocupación expresada como fracción x puntos a ocupación completa x multiplicador del nivel.",
    defaultBaseMax: 60,
    defaultMultipliers: { N0: 1, N1: 1, N2: 1 },
    parameters: [
      { key: "pointsAtFullOccupancy", label: "Puntos a ocupación completa (100%)", defaultValue: 60 },
    ],
  }),
  entry({
    code: "STAR_WRITER",
    order: 8,
    name: "Redactor estrella",
    description: "Puntúa los artículos aprobados o negativos y las propuestas realizadas.",
    calculationExplanation:
      "Si los artículos aprobados son cero o positivos: artículos x puntos por artículo aprobado x multiplicador del nivel + propuestas x puntos por propuesta. Si los artículos aprobados son negativos: artículos x puntos por artículo negativo + propuestas x puntos por propuesta. El multiplicador no afecta ni a las propuestas ni a los artículos negativos.",
    defaultBaseMax: 60,
    defaultMultipliers: { N0: 4, N1: 1.5, N2: 2 },
    parameters: [
      { key: "approvedArticlePoints", label: "Puntos por artículo aprobado", defaultValue: 10 },
      { key: "negativeArticlePoints", label: "Puntos por artículo negativo", defaultValue: 10 },
      { key: "proposalPoints", label: "Puntos por propuesta", defaultValue: 5 },
    ],
  }),
  entry({
    code: "ENTHUSIASTIC_STUDENT",
    order: 9,
    name: "Estudiante entusiasta",
    description: "Puntúa las horas de dedicación a la formación.",
    calculationExplanation: "Horas de dedicación x puntos por hora x multiplicador del nivel.",
    defaultBaseMax: 50,
    defaultMultipliers: { N0: 1, N1: 1, N2: 1 },
    parameters: [{ key: "pointsPerHour", label: "Puntos por hora de dedicación", defaultValue: 12.5 }],
  }),
  entry({
    code: "EXPERT_APPRENTICE",
    order: 10,
    name: "Aprendiz experto",
    description: "Puntúa el valor de formación alcanzado respecto de un objetivo.",
    calculationExplanation:
      "Valor de formación / objetivo x puntos al alcanzar el objetivo x multiplicador del nivel.",
    defaultBaseMax: 50,
    defaultMultipliers: { N0: 1, N1: 1, N2: 1.25 },
    parameters: [
      { key: "targetValue", label: "Valor objetivo", defaultValue: 15 },
      { key: "pointsAtTarget", label: "Puntos al alcanzar el objetivo", defaultValue: 50 },
    ],
  }),
];

/** Catalogo indexado por codigo, para acceso directo. */
export const KPI_CATALOG: Record<KpiCode, KpiCatalogEntry> = Object.fromEntries(
  CATALOG_ENTRIES.map((catalogEntry) => [catalogEntry.code, catalogEntry]),
) as Record<KpiCode, KpiCatalogEntry>;

/** Catalogo ordenado tal como debe presentarse en pantalla. */
export const KPI_CATALOG_LIST: KpiCatalogEntry[] = [...CATALOG_ENTRIES].sort((a, b) => a.order - b.order);

export const TOTAL_KPI_COUNT = KPI_CATALOG_LIST.length;
