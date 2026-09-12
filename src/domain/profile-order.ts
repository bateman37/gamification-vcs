import type { SplitStatus } from "@prisma/client";

/**
 * Orden y agrupacion de las fichas de `/fichas` (`1.0.1`, parte F del
 * encargo): funcion pura y probada, para no repartir la misma comparacion
 * entre el servicio y la pagina. No decide nada de negocio (elegibilidad,
 * permisos...), solo el orden de presentacion de tarjetas ya resueltas.
 */
export interface ProfileOrderInput {
  splitStatus: SplitStatus;
  splitStartDate: Date;
  splitName: string;
}

export interface GroupedProfileCards<T extends ProfileOrderInput> {
  /** Splits `ACTIVE`, por fecha de inicio ascendente (empate: nombre alfabetico). */
  active: T[];
  /** Splits `DRAFT` (proximos), por fecha de inicio ascendente (empate: nombre alfabetico). */
  upcoming: T[];
  /** Splits `CLOSED` (finalizados), por fecha de inicio descendente: el mas reciente primero (empate: nombre alfabetico). */
  closed: T[];
}

function byNameEs(a: string, b: string): number {
  return a.localeCompare(b, "es");
}

export function groupAndOrderProfileCards<T extends ProfileOrderInput>(cards: T[]): GroupedProfileCards<T> {
  const active = cards
    .filter((card) => card.splitStatus === "ACTIVE")
    .sort((a, b) => a.splitStartDate.getTime() - b.splitStartDate.getTime() || byNameEs(a.splitName, b.splitName));
  const upcoming = cards
    .filter((card) => card.splitStatus === "DRAFT")
    .sort((a, b) => a.splitStartDate.getTime() - b.splitStartDate.getTime() || byNameEs(a.splitName, b.splitName));
  const closed = cards
    .filter((card) => card.splitStatus === "CLOSED")
    .sort((a, b) => b.splitStartDate.getTime() - a.splitStartDate.getTime() || byNameEs(a.splitName, b.splitName));
  return { active, upcoming, closed };
}
