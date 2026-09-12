import { describe, expect, it } from "vitest";
import { buildRevealGroups } from "@/domain/results-presentation-reveal";

/**
 * Pruebas acotadas de la funcion pura de revelacion (`1.0.1`, parte I del
 * encargo, seccion 44): agrupa por posicion real y revela de la peor
 * posicion incluida hacia la primera, sin inventar ningun desempate.
 */
interface Entry {
  id: string;
  rank: number;
}

describe("buildRevealGroups", () => {
  it("con seis posiciones distintas, revela en orden 6,5,4,3,2,1", () => {
    const entries: Entry[] = [1, 2, 3, 4, 5, 6].map((rank) => ({ id: `p${rank}`, rank }));
    const groups = buildRevealGroups(entries);
    expect(groups.map((group) => group.map((entry) => entry.rank))).toEqual([[6], [5], [4], [3], [2], [1]]);
  });

  it("con cuatro participantes, muestra los cuatro", () => {
    const entries: Entry[] = [1, 2, 3, 4].map((rank) => ({ id: `p${rank}`, rank }));
    const groups = buildRevealGroups(entries);
    expect(groups).toHaveLength(4);
    expect(groups.flat().map((entry) => entry.rank)).toEqual([4, 3, 2, 1]);
  });

  it("un empate 2,2 se agrupa y se revela a la vez", () => {
    const entries: Entry[] = [
      { id: "a", rank: 1 },
      { id: "b", rank: 2 },
      { id: "c", rank: 2 },
      { id: "d", rank: 4 },
    ];
    const groups = buildRevealGroups(entries);
    // Orden de revelacion: 4, luego el grupo empatado en 2 (b y c juntos), luego 1.
    expect(groups.map((group) => group.map((entry) => entry.id))).toEqual([["d"], ["b", "c"], ["a"]]);
  });

  it("una secuencia 1,2,2,4 conserva el salto: no existe la posicion 3", () => {
    const entries: Entry[] = [
      { id: "a", rank: 1 },
      { id: "b", rank: 2 },
      { id: "c", rank: 2 },
      { id: "d", rank: 4 },
    ];
    const groups = buildRevealGroups(entries);
    expect(groups.map((group) => group[0]!.rank)).toEqual([4, 2, 1]);
  });

  it("un empate justo en la posicion de corte (rank 6) incluye a todos los empatados", () => {
    const entries: Entry[] = [
      { id: "a", rank: 5 },
      { id: "b", rank: 6 },
      { id: "c", rank: 6 },
      { id: "d", rank: 6 },
    ];
    const groups = buildRevealGroups(entries);
    expect(groups[0]!.map((entry) => entry.id).sort()).toEqual(["b", "c", "d"]);
  });

  it("la posicion 7 nunca entra, aunque exista en la lista de origen", () => {
    const entries: Entry[] = [
      { id: "a", rank: 6 },
      { id: "b", rank: 7 },
    ];
    const groups = buildRevealGroups(entries);
    expect(groups.flat().map((entry) => entry.id)).toEqual(["a"]);
  });

  it("no inventa ningun orden entre empatados: conserva el orden de entrada dentro del grupo", () => {
    const entries: Entry[] = [
      { id: "z-alias", rank: 3 },
      { id: "a-alias", rank: 3 },
    ];
    const groups = buildRevealGroups(entries);
    expect(groups[0]!.map((entry) => entry.id)).toEqual(["z-alias", "a-alias"]);
  });

  it("una lista vacia (sin publicacion) devuelve cero grupos", () => {
    expect(buildRevealGroups<Entry>([])).toEqual([]);
  });
});
