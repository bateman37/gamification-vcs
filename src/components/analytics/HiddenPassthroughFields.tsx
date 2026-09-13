import type { RawSearchParams } from "@/app/analitica/filters";

/**
 * Campos ocultos que conservan el resto de `searchParams` en un formulario
 * GET nativo (parte D3: "guarda en URL los filtros... para que funcionen
 * recarga, atras y enlaces internos"). `excludeKeys` evita duplicar una
 * clave que el propio formulario ya declara con su nombre real.
 */
export function HiddenPassthroughFields({ searchParams, excludeKeys = [] }: { searchParams: RawSearchParams; excludeKeys?: string[] }) {
  const excluded = new Set(excludeKeys);
  const entries: [string, string][] = [];
  for (const [key, value] of Object.entries(searchParams)) {
    if (excluded.has(key)) continue;
    for (const entry of Array.isArray(value) ? value : value !== undefined ? [value] : []) {
      entries.push([key, entry]);
    }
  }
  return (
    <>
      {entries.map(([key, value], index) => (
        <input key={`${key}-${index}`} type="hidden" name={key} value={value} />
      ))}
    </>
  );
}
