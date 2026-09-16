/**
 * Avatar decorativo por iniciales (`1.2.3`, ver docs/BADGES.md): el modulo
 * Badges es publico entre todos los usuarios autenticados y no reutiliza la
 * ruta de avatar de ficha, pensada solo para que un participante vea su
 * propio avatar. Puramente CSS/texto, sin depender de ninguna imagen.
 */
function initialsFor(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  const initials = `${first}${last}`.toUpperCase();
  return initials || "?";
}

export function InitialsAvatar({ fullName, className = "h-9 w-9 text-sm" }: { fullName: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-game-soft font-semibold text-game-ink ${className}`}
    >
      {initialsFor(fullName)}
    </span>
  );
}
