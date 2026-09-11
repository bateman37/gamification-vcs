import { Prisma, type ParticipantLevel } from "@prisma/client";
import type { KpiConfigView } from "./mapping";

/**
 * Helpers compartidos por los calculos de KPI alimentados por una carga
 * semanal (Productividad, Escalados, Calidad, Llamadas): resolucion del
 * multiplicador por nivel y aplicacion del maximo base con aritmetica
 * decimal. No es un motor generico de KPI: cada calculo sigue definiendo
 * su propia formula y sus propios estados especiales en su modulo (ver
 * docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md y docs/DECISIONS.md). El
 * calculo de Productividad (`src/domain/kpis/productivity.ts`), ya
 * validado manualmente, no se ha tocado para no arriesgar una
 * refactorizacion de codigo que ya funciona.
 */

export interface KpiComputation {
  /** Puntos sin aplicar el maximo base. */
  rawPoints: Prisma.Decimal;
  /** Puntos finales, despues de aplicar el maximo base. Sin suelo de cero. */
  finalPoints: Prisma.Decimal;
  /** Si el maximo base ha limitado el resultado. */
  capped: boolean;
}

export function multiplierForLevel(config: KpiConfigView, level: ParticipantLevel): number | null {
  if (level === "N0") return config.multiplierN0;
  if (level === "N1") return config.multiplierN1;
  return config.multiplierN2;
}

/** Aplica el maximo base como techo unico: nunca redondea antes, nunca anade suelo de cero. */
export function applyBaseMax(rawPoints: Prisma.Decimal, baseMax: number): KpiComputation {
  const max = new Prisma.Decimal(baseMax);
  const capped = rawPoints.greaterThan(max);
  return { rawPoints, finalPoints: capped ? max : rawPoints, capped };
}

/** Version serializable de un `KpiComputation` ya resuelto (para una accion de servidor o un componente cliente). */
export function computationToView(computation: KpiComputation): { rawPoints: number; finalPoints: number; capped: boolean } {
  return {
    rawPoints: computation.rawPoints.toNumber(),
    finalPoints: computation.finalPoints.toNumber(),
    capped: computation.capped,
  };
}
