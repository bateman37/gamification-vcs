import Link from "next/link";
import { GAMIFICATION_MODE_PARAM, type GamificationMode } from "@/domain/gamification-view";

/**
 * Control "Con gamificacion | Sin gamificacion" de `/resultados` (`0.9.0` /
 * MVP-2D, seccion 35 del encargo). Conserva el resto de parametros de la URL
 * (persona, vista, split, año, agrupacion...) al cambiar de modo: nunca
 * depende solo del color para indicar el estado activo.
 */
export function GamificationToggle({
  mode,
  searchParams,
}: {
  mode: GamificationMode;
  searchParams: Record<string, string | undefined>;
}) {
  function hrefFor(value: GamificationMode): string {
    const params = new URLSearchParams();
    for (const [key, rawValue] of Object.entries(searchParams)) {
      if (rawValue !== undefined && key !== GAMIFICATION_MODE_PARAM) params.set(key, rawValue);
    }
    params.set(GAMIFICATION_MODE_PARAM, value);
    return `/resultados?${params.toString()}`;
  }

  function optionClass(value: GamificationMode): string {
    const active = mode === value;
    return `rounded-md px-3 py-1.5 text-sm font-medium ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`;
  }

  return (
    <div role="group" aria-label="Modo de visualizacion de resultados" className="inline-flex gap-1 rounded-lg border border-slate-300 bg-white p-1">
      <Link href={hrefFor("con")} aria-current={mode === "con" ? "true" : undefined} className={optionClass("con")}>
        Con gamificacion
      </Link>
      <Link href={hrefFor("sin")} aria-current={mode === "sin" ? "true" : undefined} className={optionClass("sin")}>
        Sin gamificacion
      </Link>
    </div>
  );
}
