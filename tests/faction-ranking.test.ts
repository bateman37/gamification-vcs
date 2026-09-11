import { describe, expect, it } from "vitest";
import { selectFactionTopThree, rankFactions, compareDescendingNumberVectors, type FactionMemberScore } from "@/domain/faction-ranking";

function member(splitParticipantId: string, alias: string, positionPoints: number): FactionMemberScore {
  return { splitParticipantId, alias, positionPoints };
}

describe("selectFactionTopThree: top 3 y suma (nunca media)", () => {
  it("con mas de tres miembros, solo suma sus tres mejores positionPoints", () => {
    const result = selectFactionTopThree([
      member("a", "Ana", 15),
      member("b", "Bea", 11),
      member("c", "Coco", 8),
      member("d", "Dani", 100),
      member("e", "Eva", 1),
    ]);
    expect(result).not.toBeNull();
    expect(result!.topContributors.map((c) => c.splitParticipantId)).toEqual(["d", "a", "b"]);
    expect(result!.weeklyScore).toBe(100 + 15 + 11);
  });

  it("la suma es correcta y nunca se calcula una media", () => {
    const result = selectFactionTopThree([member("a", "Ana", 15), member("b", "Bea", 11), member("c", "Coco", 8)]);
    expect(result!.weeklyScore).toBe(34);
  });

  it("con exactamente tres miembros, los tres puntuan y la suma es exacta", () => {
    const result = selectFactionTopThree([member("a", "Ana", 5), member("b", "Bea", 5), member("c", "Coco", 5)]);
    expect(result!.weeklyScore).toBe(15);
    expect(result!.topContributors).toHaveLength(3);
  });

  it("con menos de tres miembros aplicables, devuelve null (bloquea la publicacion)", () => {
    expect(selectFactionTopThree([member("a", "Ana", 15), member("b", "Bea", 11)])).toBeNull();
    expect(selectFactionTopThree([])).toBeNull();
  });

  it("desempata la seleccion del top 3 por alias normalizado y despues id, sin alterar los puntos", () => {
    const result = selectFactionTopThree([member("z", "Zeta", 10), member("a", "Alfa", 10), member("m", "Medio", 5)]);
    expect(result!.topContributors.map((c) => c.splitParticipantId)).toEqual(["a", "z", "m"]);
    expect(result!.weeklyScore).toBe(25);
  });
});

describe("compareDescendingNumberVectors", () => {
  it("compara elemento a elemento, tratando un hueco como cero", () => {
    expect(compareDescendingNumberVectors([15, 11, 8], [15, 11, 8])).toBe(0);
    expect(compareDescendingNumberVectors([15, 11, 8], [15, 10, 8])).toBeLessThan(0);
    expect(compareDescendingNumberVectors([10], [10, 5])).toBeGreaterThan(0);
  });
});

describe("rankFactions: desempate por mejor, segundo, tercero y empate real", () => {
  it("ordena por suma semanal descendente cuando no hay empate", () => {
    const ranked = rankFactions([
      { factionId: "a", factionName: "Alfa", score: 34, contributionVector: [15, 11, 8] },
      { factionId: "b", factionName: "Beta", score: 21, contributionVector: [11, 8, 2] },
    ]);
    expect(ranked.map((entry) => entry.item.factionId)).toEqual(["a", "b"]);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2]);
  });

  it("con la misma suma, gana la faccion cuyo mejor participante puntuo mas", () => {
    const ranked = rankFactions([
      { factionId: "a", factionName: "Alfa", score: 21, contributionVector: [15, 5, 1] },
      { factionId: "b", factionName: "Beta", score: 21, contributionVector: [11, 8, 2] },
    ]);
    expect(ranked.map((entry) => entry.item.factionId)).toEqual(["a", "b"]);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2]);
  });

  it("si el mejor empata, se compara el segundo", () => {
    const ranked = rankFactions([
      { factionId: "a", factionName: "Alfa", score: 20, contributionVector: [15, 4, 1] },
      { factionId: "b", factionName: "Beta", score: 20, contributionVector: [15, 3, 2] },
    ]);
    expect(ranked.map((entry) => entry.item.factionId)).toEqual(["a", "b"]);
  });

  it("si primero, segundo y tercero empatan, ambas facciones reciben la misma posicion (empate real)", () => {
    const ranked = rankFactions([
      { factionId: "a", factionName: "Alfa", score: 24, contributionVector: [15, 8, 1] },
      { factionId: "b", factionName: "Beta", score: 24, contributionVector: [15, 8, 1] },
      { factionId: "c", factionName: "Gama", score: 10, contributionVector: [5, 4, 1] },
    ]);
    expect(ranked.find((entry) => entry.item.factionId === "a")!.rank).toBe(1);
    expect(ranked.find((entry) => entry.item.factionId === "b")!.rank).toBe(1);
    expect(ranked.find((entry) => entry.item.factionId === "c")!.rank).toBe(3);
  });

  it("el nombre de la faccion nunca rompe el empate, solo estabiliza el orden visual", () => {
    const ranked = rankFactions([
      { factionId: "z-id", factionName: "Zeta", score: 10, contributionVector: [5, 3, 2] },
      { factionId: "a-id", factionName: "Alfa", score: 10, contributionVector: [5, 3, 2] },
    ]);
    expect(ranked.every((entry) => entry.rank === 1)).toBe(true);
    // Orden visual estable: Alfa antes que Zeta, pero ambas en la posicion 1.
    expect(ranked.map((entry) => entry.item.factionId)).toEqual(["a-id", "z-id"]);
  });
});
