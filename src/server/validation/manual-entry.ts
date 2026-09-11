import { DomainError } from "@/lib/errors";

/**
 * Parseo y validacion en servidor de los formularios manuales de KPI (ver
 * docs/MANUAL_KPI_ENTRY.md). Nunca confia en `min`/`max`/`step` del
 * navegador. Convencion de nombres de campo en el `FormData`:
 * `<campo>__<splitParticipantId>`.
 *
 * Por defecto, un campo vacio o ausente se rechaza como obligatorio (ver
 * `parseRequiredNonNegativeNumber`) y nunca se convierte en cero. Redactor
 * estrella, Estudiante entusiasta y Aprendiz experto son la excepcion
 * explicita (`BUGFIX-1 / UX-SPLIT-1`, ver docs/DECISIONES.md): usan
 * `parseNonNegativeNumberDefaultZero`, que interpreta vacio/ausente como
 * `0` reutilizando las mismas validaciones numericas (ver
 * docs/DECISIONS.md).
 */

export interface ManualEntryFieldError {
  participantId: string;
  field: string;
  message: string;
}

/** Error de validacion con todos los errores detectables, asociados a persona y campo. */
export class ManualEntryValidationError extends DomainError {
  readonly fieldErrors: ManualEntryFieldError[];

  constructor(fieldErrors: ManualEntryFieldError[]) {
    super("Hay errores en el formulario. Revisalos antes de guardar.");
    this.name = "ManualEntryValidationError";
    this.fieldErrors = fieldErrors;
  }
}

/** Acepta coma o punto como separador decimal. `undefined` si esta vacio o ausente (nunca se convierte en cero). */
function coerceDecimalInput(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  return Number(trimmed.replace(",", "."));
}

export function getManualEntryFieldRaw(formData: FormData, field: string, participantId: string): string | undefined {
  const raw = formData.get(`${field}__${participantId}`);
  return typeof raw === "string" ? raw : undefined;
}

export interface NonNegativeNumberOptions {
  integer?: boolean;
  max?: number;
  maxMessage?: string;
}

export type FieldParseResult = { ok: true; value: number } | { ok: false; error: ManualEntryFieldError };

/**
 * Nucleo compartido de validacion (numero, no negativo, entero opcional,
 * maximo opcional e inclusivo) para un valor ya resuelto (nunca vacio en
 * este punto). No decide que hacer con un campo vacio: eso lo deciden
 * `parseRequiredNonNegativeNumber` (lo rechaza) y
 * `parseNonNegativeNumberDefaultZero` (lo convierte en cero) antes de
 * llamar aqui.
 */
function parseNonNegativeNumberValue(
  raw: string,
  field: string,
  fieldLabel: string,
  participantId: string,
  options: NonNegativeNumberOptions,
): FieldParseResult {
  const value = coerceDecimalInput(raw);
  if (value === undefined || Number.isNaN(value) || !Number.isFinite(value)) {
    return { ok: false, error: { participantId, field, message: `${fieldLabel} debe ser un numero.` } };
  }
  if (value < 0) {
    return { ok: false, error: { participantId, field, message: `${fieldLabel} debe ser mayor o igual que cero.` } };
  }
  if (options.integer && !Number.isInteger(value)) {
    return { ok: false, error: { participantId, field, message: `${fieldLabel} debe ser un numero entero.` } };
  }
  // Inclusivo: un valor igual a `options.max` es valido, solo se rechaza al superarlo.
  if (options.max !== undefined && value > options.max) {
    return {
      ok: false,
      error: { participantId, field, message: options.maxMessage ?? `${fieldLabel} no puede superar ${options.max}.` },
    };
  }
  return { ok: true, value };
}

/**
 * Valida un campo numerico obligatorio y no negativo (opcionalmente entero
 * y/o con un maximo inclusivo). Un campo vacio o ausente nunca se convierte
 * en cero: se rechaza como obligatorio. Usado por Guardian de la
 * Estabilidad y Cronomagia laboral.
 */
export function parseRequiredNonNegativeNumber(
  formData: FormData,
  field: string,
  fieldLabel: string,
  participantId: string,
  options: NonNegativeNumberOptions = {},
): FieldParseResult {
  const raw = getManualEntryFieldRaw(formData, field, participantId);
  if (raw === undefined || raw.trim() === "") {
    return { ok: false, error: { participantId, field, message: `${fieldLabel} es obligatorio.` } };
  }
  return parseNonNegativeNumberValue(raw, field, fieldLabel, participantId, options);
}

/**
 * Igual que `parseRequiredNonNegativeNumber`, pero un campo vacio o ausente
 * se interpreta y persiste como `0` en vez de rechazarse. Excepcion
 * explicita para Redactor estrella, Estudiante entusiasta y Aprendiz
 * experto (`BUGFIX-1 / UX-SPLIT-1`, ver docs/DECISIONS.md): no se aplica a
 * ningun otro consumidor.
 */
export function parseNonNegativeNumberDefaultZero(
  formData: FormData,
  field: string,
  fieldLabel: string,
  participantId: string,
  options: NonNegativeNumberOptions = {},
): FieldParseResult {
  const raw = getManualEntryFieldRaw(formData, field, participantId);
  const effectiveRaw = raw === undefined || raw.trim() === "" ? "0" : raw;
  return parseNonNegativeNumberValue(effectiveRaw, field, fieldLabel, participantId, options);
}
