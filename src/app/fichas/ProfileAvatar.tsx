/**
 * Avatar de una ficha (`0.8.0` / MVP-2B). Cuando no hay imagen, muestra un
 * placeholder con las iniciales del alias. La imagen se pide a la ruta que
 * la sirve, nunca se incrusta en el HTML: los bytes solo viajan cuando el
 * navegador la solicita realmente.
 */
export function ProfileAvatar({
  splitParticipantId,
  alias,
  avatarVersion,
  size = 96,
}: {
  splitParticipantId: string;
  alias: string;
  avatarVersion: string | null;
  size?: number;
}) {
  const initials = alias
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  if (!avatarVersion) {
    return (
      <span
        role="img"
        aria-label={`Sin avatar para ${alias}`}
        className="flex shrink-0 items-center justify-center rounded-full bg-surface-muted font-semibold text-text-muted"
        style={{ width: size, height: size, fontSize: Math.round(size / 2.8) }}
      >
        {initials || "?"}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- la imagen se sirve desde una ruta propia con cache privada; `next/image` optimizaria y cachearia un dato privado.
    <img
      src={`/api/fichas/${splitParticipantId}/avatar?v=${avatarVersion}`}
      alt={`Avatar de ${alias}`}
      width={size}
      height={size}
      className="shrink-0 rounded-full border border-border object-cover"
      style={{ width: size, height: size }}
    />
  );
}
