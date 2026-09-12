/**
 * Marca abstracta de "Prisma competitivo" (seccion 12 del encargo): cuatro
 * piezas modulares en progresion, sin referencia a ninguna tematica
 * concreta. `variant="light"` (por defecto) es para fondos claros;
 * `variant="dark"` para la barra lateral tinta.
 */
export function BrandMark({ variant = "light", className = "" }: { variant?: "light" | "dark"; className?: string }) {
  const colors =
    variant === "dark"
      ? ["#2563EB", "#6D4AFF", "#0F9D8A", "#F4B740"]
      : ["#2563EB", "#6D4AFF", "#0F9D8A", "#F4B740"];
  return (
    <svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true" className={className}>
      <rect x="2" y="16" width="12" height="12" rx="3" fill={colors[0]} />
      <rect x="16" y="10" width="12" height="12" rx="3" fill={colors[1]} opacity="0.95" />
      <rect x="2" y="2" width="12" height="12" rx="3" fill={colors[2]} opacity="0.9" />
      <rect x="18" y="24" width="10" height="6" rx="3" fill={colors[3]} />
    </svg>
  );
}
