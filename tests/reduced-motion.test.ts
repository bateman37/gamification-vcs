import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Comprobacion acotada de accesibilidad/movimiento (`1.0.1`, parte I y K
 * del encargo): sin Testing Library ni jsdom en este proyecto, se
 * verifica el contrato real en `globals.css` en vez de renderizar
 * componentes: la regla global `prefers-reduced-motion` sigue existiendo
 * y sigue aplicandose a toda animacion/transicion (incluida la de
 * "Presentar resultados"), y la animacion de revelacion esta definida.
 */
describe("prefers-reduced-motion en globals.css", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf-8");

  it("reduce la duracion de animaciones y transiciones para toda la aplicacion", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(css).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(css).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });

  it("la animacion de revelacion de 'Presentar resultados' esta definida y queda sujeta a la regla anterior", () => {
    expect(css).toMatch(/@keyframes reveal-in/);
    expect(css).toMatch(/\.animate-reveal-in\s*\{[^}]*animation:\s*reveal-in/);
  });
});
