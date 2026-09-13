import type { EquipmentVisualPosition } from "@prisma/client";
import { storeItemImagePath } from "@/domain/store-item-image-constraints";

/**
 * Miniatura consistente de un objeto del catalogo (`1.2.0`, secciones 7.5 y
 * 7.6 del encargo). Se usa igual en administracion, mercado, inventario,
 * equipo y desglose de bonificadores.
 *
 * Sin imagen se muestra un icono neutro **local** asociado a la posicion
 * visual de su ranura: nunca una imagen remota, un servicio de terceros ni
 * contenido tematico predeterminado.
 *
 * Accesibilidad: cuando el nombre del objeto ya esta inmediatamente al lado
 * (el caso habitual en tarjetas y listas), la miniatura es redundante y se
 * marca `decorative` para que use `alt=""` en vez de repetir el nombre.
 */

/**
 * Glifo neutro por posicion. Formas geometricas simples, no ilustraciones
 * tematicas: nada de piedra, pergamino, fuego, runas ni metal medieval.
 */
const POSITION_GLYPH: Record<EquipmentVisualPosition, string> = {
  HEAD: "M6 13a6 6 0 0 1 12 0v4H6z M4 17h16",
  LEFT_HAND: "M7 4v9 M7 13l5 7 M17 6v14",
  TORSO: "M6 7h12v10H6z M9 4h6v3H9z",
  RIGHT_HAND: "M17 4v9 M17 13l-5 7 M7 6v14",
  HANDS: "M5 8h5v10H5z M14 8h5v10h-5z",
  LEGS: "M8 4h8v6l-2 10H10L8 10z",
  CAPE: "M12 4 5 20h14z",
  ARTIFACT: "M12 3 20 9v6l-8 6-8-6V9z",
  FEET: "M6 5h5v10H6z M13 5h5v10h-5z M4 19h16",
  RELIC: "M12 4v16 M4 12h16 M7 7l10 10 M17 7 7 17",
};

function FallbackIcon({ visualPosition }: { visualPosition: EquipmentVisualPosition | null }) {
  // Una ranura historica sin ubicar no tiene glifo propio: se usa un marcador neutro.
  const path = visualPosition ? POSITION_GLYPH[visualPosition] : "M5 5h14v14H5z M9 9h6v6H9z";
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="h-2/3 w-2/3 text-text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

const SIZE_CLASSES = {
  sm: "h-9 w-9",
  md: "h-12 w-12",
  lg: "h-16 w-16",
} as const;

export function StoreItemImage({
  splitId,
  storeItemId,
  imageVersion,
  itemName,
  visualPosition = null,
  size = "md",
  decorative = false,
}: {
  splitId: string;
  storeItemId: string;
  imageVersion: string | null;
  itemName: string;
  visualPosition?: EquipmentVisualPosition | null;
  size?: keyof typeof SIZE_CLASSES;
  decorative?: boolean;
}) {
  const frame = `flex shrink-0 items-center justify-center overflow-hidden rounded-control border border-border bg-surface-muted ${SIZE_CLASSES[size]}`;

  if (!imageVersion) {
    return (
      <span className={frame} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : `${itemName} (sin imagen)`}>
        <FallbackIcon visualPosition={visualPosition} />
      </span>
    );
  }

  return (
    <span className={frame}>
      {/* `<img>` nativo a proposito: la ruta es una API autenticada que sirve los bytes
          desde PostgreSQL con su propio `ETag`, no un recurso estatico optimizable. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={storeItemImagePath(splitId, storeItemId, imageVersion)}
        alt={decorative ? "" : itemName}
        width={96}
        height={96}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    </span>
  );
}
