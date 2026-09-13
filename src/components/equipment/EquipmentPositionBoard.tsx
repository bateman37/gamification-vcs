import type { ReactNode } from "react";
import type { EquipmentVisualPosition } from "@prisma/client";
import { EQUIPMENT_VISUAL_POSITIONS } from "@/domain/equipment-visual-positions";

/**
 * Cuadricula `1-3-3-3` del tablero de equipo (hotfix `1.2.1`), unica fuente
 * compartida entre Administracion (`AdminSlotPositionEditor`) y Configurar
 * personaje (`EquipmentEditor`).
 *
 * Cada celda recibe su fila y columna reales de forma explicita
 * (`col-start-*`/`row-start-*`), nunca del orden de aparicion en el DOM ni
 * de `grid-auto-flow`: una posicion libre y una ranura activa comparten
 * siempre la misma celda, y activar, desactivar, mover o quitar un objeto
 * nunca desplaza las demas.
 */
const POSITION_GRID_CLASS: Record<EquipmentVisualPosition, string> = {
  HEAD: "col-start-2 row-start-1",
  LEFT_HAND: "col-start-1 row-start-2",
  TORSO: "col-start-2 row-start-2",
  RIGHT_HAND: "col-start-3 row-start-2",
  HANDS: "col-start-1 row-start-3",
  LEGS: "col-start-2 row-start-3",
  CAPE: "col-start-3 row-start-3",
  ARTIFACT: "col-start-1 row-start-4",
  FEET: "col-start-2 row-start-4",
  RELIC: "col-start-3 row-start-4",
};

/**
 * Misma cuadricula, aplicada solo desde el punto de ruptura `sm`. Por debajo
 * de `sm` no se fuerza ninguna celda: las diez posiciones siguen el orden
 * logico del catalogo (`Cabeza`, segunda fila, tercera fila, cuarta fila) en
 * una rejilla de dos columnas sin scroll horizontal (seccion 7 del hotfix).
 */
const POSITION_GRID_CLASS_FROM_SM: Record<EquipmentVisualPosition, string> = {
  HEAD: "sm:col-start-2 sm:row-start-1",
  LEFT_HAND: "sm:col-start-1 sm:row-start-2",
  TORSO: "sm:col-start-2 sm:row-start-2",
  RIGHT_HAND: "sm:col-start-3 sm:row-start-2",
  HANDS: "sm:col-start-1 sm:row-start-3",
  LEGS: "sm:col-start-2 sm:row-start-3",
  CAPE: "sm:col-start-3 sm:row-start-3",
  ARTIFACT: "sm:col-start-1 sm:row-start-4",
  FEET: "sm:col-start-2 sm:row-start-4",
  RELIC: "sm:col-start-3 sm:row-start-4",
};

export function EquipmentPositionBoard({
  renderCell,
  responsive,
  className,
}: {
  renderCell: (position: EquipmentVisualPosition) => ReactNode;
  /** `true`: dos columnas en movil, cuadricula `1-3-3-3` desde `sm`. `false`: `1-3-3-3` siempre (Administracion). */
  responsive: boolean;
  className?: string;
}) {
  const gridClass = responsive ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3";
  const positionClass = responsive ? POSITION_GRID_CLASS_FROM_SM : POSITION_GRID_CLASS;
  return (
    <div className={`grid gap-2 ${gridClass} ${className ?? ""}`}>
      {EQUIPMENT_VISUAL_POSITIONS.map((definition) => (
        <div key={definition.position} className={positionClass[definition.position]}>
          {renderCell(definition.position)}
        </div>
      ))}
    </div>
  );
}
