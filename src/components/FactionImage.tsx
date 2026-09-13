import { factionImagePath } from "@/domain/faction-image-constraints";

/**
 * Emblema consistente de una faccion (`1.2.2`, ver docs/FACTIONS.md). Mismo
 * patron que `StoreItemImage`: sin imagen se muestra un icono neutro local
 * (nunca una imagen remota ni un servicio de terceros), y con imagen un
 * `<img>` nativo apuntando a la ruta autenticada que sirve los bytes desde
 * PostgreSQL.
 *
 * Accesibilidad: cuando el nombre de la faccion ya esta inmediatamente al
 * lado (el caso habitual en tarjetas y clasificaciones), la miniatura es
 * redundante y se marca `decorative` para que use `alt=""`.
 */

const SIZE_CLASSES = {
  sm: "h-6 w-6",
  md: "h-9 w-9",
  lg: "h-16 w-16",
} as const;

function FallbackGlyph({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="h-2/3 w-2/3"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 20 9v6l-8 6-8-6V9z" />
    </svg>
  );
}

export function FactionImage({
  splitId,
  factionId,
  imageVersion,
  factionName,
  color,
  size = "md",
  decorative = false,
}: {
  splitId: string;
  factionId: string;
  imageVersion: string | null;
  factionName: string;
  color: string;
  size?: keyof typeof SIZE_CLASSES;
  decorative?: boolean;
}) {
  const frame = `flex shrink-0 items-center justify-center overflow-hidden rounded-control border border-border bg-surface-muted ${SIZE_CLASSES[size]}`;

  if (!imageVersion) {
    return (
      <span
        className={frame}
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : `Emblema de ${factionName} (sin imagen)`}
      >
        <FallbackGlyph color={color} />
      </span>
    );
  }

  return (
    <span className={frame}>
      {/* `<img>` nativo a proposito: la ruta es una API autenticada que sirve los bytes
          desde PostgreSQL con su propio `ETag`, no un recurso estatico optimizable. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={factionImagePath(splitId, factionId, imageVersion)}
        alt={decorative ? "" : `Emblema de ${factionName}`}
        width={64}
        height={64}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    </span>
  );
}
