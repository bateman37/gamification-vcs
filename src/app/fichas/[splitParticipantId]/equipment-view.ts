import type { EquipmentVisualPosition } from "@prisma/client";
import type { KpiCode } from "@/domain/kpis/catalog";

/**
 * DTO minima que el servidor entrega al editor de equipo (`1.2.0`, seccion
 * 13.4 del encargo): solo ids opacos, nombre visible, posicion, estado
 * activo/inactivo, datos descriptivos del objeto y `imageVersion`.
 *
 * Nunca viajan aqui bytes de imagen, informacion de otros participantes, ni
 * puntos, formulas o resultados calculados por el navegador.
 */

export interface EditorSlotView {
  equipmentSlotId: string;
  name: string;
  visualPosition: EquipmentVisualPosition | null;
  isActive: boolean;
  displayOrder: number;
}

export interface EditorItemView {
  ownedItemId: string;
  storeItemId: string;
  name: string;
  /** Ranura del catalogo a la que pertenece: es la unica compatibilidad posible. */
  equipmentSlotId: string;
  equipmentSlotName: string;
  visualPosition: EquipmentVisualPosition | null;
  slotIsActive: boolean;
  slotDisplayOrder: number;
  kpiCode: KpiCode;
  kpiName: string;
  bonusPercent: number;
  priceCredits: number;
  /** Fecha de compra ya formateada en servidor: el cliente no formatea fechas de negocio. */
  acquiredAtLabel: string;
  imageVersion: string | null;
}

export interface EditorProfessionView {
  name: string;
  kpiCodeA: KpiCode;
  kpiCodeB: KpiCode;
}

export interface EditorLocationView {
  name: string;
  kpiCode: KpiCode;
  bonusPercent: number;
}
