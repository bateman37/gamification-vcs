/**
 * Silueta humana neutra del tablero de equipo (`1.2.0`, seccion 8.3 del
 * encargo).
 *
 * Es puramente decorativa: `aria-hidden` y `focusable="false"`, porque no
 * contiene ninguna informacion funcional (los nombres de ranura, estados y
 * controles son siempre HTML accesible junto a ella). No es una imagen
 * rasterizada, no depende de ningun archivo externo y es independiente del
 * avatar del jugador.
 *
 * Deliberadamente generica: geometrica, sin rostro, sin genero marcado, sin
 * raza, edad, uniforme ni tematica, y con opacidad baja en tinta (`ink`) para
 * no competir nunca con las etiquetas ni con los controles que la rodean.
 */
export function EquipmentSilhouette({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 220"
      aria-hidden="true"
      focusable="false"
      className={`pointer-events-none select-none text-ink ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Cabeza */}
      <circle cx="60" cy="26" r="16" />
      {/* Torso */}
      <path d="M60 42v58" />
      <path d="M38 62c0-11 10-20 22-20s22 9 22 20v30c0 8-5 12-11 12H49c-6 0-11-4-11-12Z" />
      {/* Brazos */}
      <path d="M38 66 22 96l-4 26" />
      <path d="M82 66l16 30 4 26" />
      {/* Piernas */}
      <path d="M50 104v44l-6 44" />
      <path d="M70 104v44l6 44" />
      {/* Pies */}
      <path d="M38 196h14" />
      <path d="M68 196h14" />
    </svg>
  );
}
