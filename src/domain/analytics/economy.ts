/**
 * Economia y uso del mercado (bloque 6 / parte I2-I3 del encargo). Lee
 * exclusivamente el libro de movimientos ya persistido (`CreditLedgerEntry`):
 * nunca regenera creditos a partir de puntos agregados. Aplica fechas de
 * operacion (`purchasedAt`/`createdAt`), no fechas de rendimiento: una
 * compra valida puede caer en una semana todavia no publicada.
 */

export interface LedgerEntryForEconomy {
  type: "WEEKLY_EARNING" | "PURCHASE";
  /** Entero con signo tal como se persiste: `>= 0` para emision, `< 0` para compra. */
  amount: number;
  createdAt: Date;
}

/** Creditos emitidos del intervalo: suma de movimientos de emision (parte I3). */
export function sumCreditsIssued(entriesInInterval: readonly LedgerEntryForEconomy[]): number {
  return entriesInInterval.filter((entry) => entry.type === "WEEKLY_EARNING").reduce((sum, entry) => sum + entry.amount, 0);
}

/** Gasto del intervalo: valor positivo del importe de las compras (parte I3). */
export function sumCreditsSpent(entriesInInterval: readonly LedgerEntryForEconomy[]): number {
  return entriesInInterval.filter((entry) => entry.type === "PURCHASE").reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
}

/** Saldo inicial: suma de todos los movimientos anteriores al inicio del intervalo. */
export function sumOpeningBalance(entriesBeforeInterval: readonly LedgerEntryForEconomy[]): number {
  return entriesBeforeInterval.reduce((sum, entry) => sum + entry.amount, 0);
}

/** Saldo al cierre = saldo inicial + emisiones - gasto del intervalo (parte I3). */
export function computeClosingBalance(openingBalance: number, issued: number, spent: number): number {
  return openingBalance + issued - spent;
}
