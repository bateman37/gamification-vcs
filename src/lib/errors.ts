/**
 * Error de negocio con un mensaje pensado para mostrarse directamente al
 * usuario administrador (en castellano). Los errores inesperados (fallos
 * de base de datos, bugs, etc.) no deben usar esta clase: deben
 * propagarse y mostrarse como "error de servidor" generico.
 */
export class DomainError extends Error {
  /** Campo de formulario al que se asocia el error, si aplica. */
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "DomainError";
    this.field = field;
  }
}
