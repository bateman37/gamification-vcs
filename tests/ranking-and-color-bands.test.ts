import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { rankByScoreDescending, rankByComparator, compareDecimalDescending, compareNormalizedAlias } from "@/domain/ranking";
import { colorBandForPercentage } from "@/domain/color-bands";

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

describe("rankByScoreDescending: ranking de competicion", () => {
  it("asigna 1, 2, 2, 4 cuando hay un empate exacto", () => {
    const items = [
      { id: "a", score: 100 },
      { id: "b", score: 90 },
      { id: "c", score: 90 },
      { id: "d", score: 80 },
    ];
    const ranked = rankByScoreDescending(
      items,
      (item) => decimal(item.score),
      (a, b) => compareNormalizedAlias(a.id, b.id),
    );
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 2, 4]);
    expect(ranked.map((entry) => entry.item.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("no considera empate una diferencia decimal minima (sin redondeo)", () => {
    const items = [
      { id: "a", score: 90.001 },
      { id: "b", score: 90 },
    ];
    const ranked = rankByScoreDescending(
      items,
      (item) => decimal(item.score),
      (a, b) => compareNormalizedAlias(a.id, b.id),
    );
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2]);
  });

  it("desempata visualmente por alias normalizado sin cambiar la posicion", () => {
    const items = [
      { id: "1", alias: "zeta", score: 50 },
      { id: "2", alias: "alfa", score: 50 },
    ];
    const ranked = rankByScoreDescending(
      items,
      (item) => decimal(item.score),
      (a, b) => compareNormalizedAlias(a.alias, b.alias),
    );
    expect(ranked.map((entry) => entry.item.alias)).toEqual(["alfa", "zeta"]);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 1]);
  });
});

describe("rankByComparator: dos criterios (clasificacion acumulada)", () => {
  it("solo empata cuando ambos criterios coinciden; el alias nunca decide el empate", () => {
    const items = [
      { id: "a", position: 10, kpi: 5, alias: "bravo" },
      { id: "b", position: 10, kpi: 8, alias: "alfa" },
      { id: "c", position: 10, kpi: 8, alias: "charlie" },
    ];
    const ranked = rankByComparator(
      items,
      (x, y) => {
        const byPosition = compareDecimalDescending(decimal(x.position), decimal(y.position));
        if (byPosition !== 0) return byPosition;
        return compareDecimalDescending(decimal(x.kpi), decimal(y.kpi));
      },
      (x, y) => compareNormalizedAlias(x.alias, y.alias),
    );
    // b y c empatan en posicion Y kpi -> mismo rango 1; a tiene menos kpi -> rango 3 (salta el 2).
    expect(ranked.find((entry) => entry.item.id === "b")!.rank).toBe(1);
    expect(ranked.find((entry) => entry.item.id === "c")!.rank).toBe(1);
    expect(ranked.find((entry) => entry.item.id === "a")!.rank).toBe(3);
  });
});

describe("colorBandForPercentage: bandas en los limites exactos", () => {
  it.each([
    [-0.01, "below-zero"],
    [0, "very-low"],
    [24.999, "very-low"],
    [25, "low"],
    [49.999, "low"],
    [50, "mid"],
    [74.999, "mid"],
    [75, "good"],
    [89.999, "good"],
    [90, "excellent"],
    [150, "excellent"],
  ] as const)("%s%% -> %s", (percentage, expectedBand) => {
    expect(colorBandForPercentage(percentage).band).toBe(expectedBand);
  });
});
