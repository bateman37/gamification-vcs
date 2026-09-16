import { describe, expect, it } from "vitest";
import { resolveBadgeCodeForCategoryLabel } from "@/domain/badges/badge-catalog";
import { LEGACY_BADGE_GRANTS, LEGACY_BADGES_V1_EXPECTED_TOTALS } from "@/domain/badges/legacy-badges-v1";
import { validateLegacyBadgeDataset } from "@/domain/badges/legacy-badges-validator";
import { selectMvpBadgeWinners, selectTeamMvpBadgeWinners, selectKpiBadgeWinners } from "@/domain/badges/badge-winners";
import { sortBadgeClassification, BADGE_SORT_MVP, BADGE_SORT_TEAM_MVP, BADGE_SORT_TOTAL } from "@/domain/badges/badge-classification";

/**
 * Pruebas puras del dominio de Badges (`1.2.3`, seccion 11 del encargo, ver
 * docs/BADGES.md): dataset historico, resolucion de alias de categoria,
 * seleccion de ganadores y ordenacion de la clasificacion. Sin base de
 * datos ni nombres reales fuera del propio dataset canonico transcrito.
 */

describe("legacy-badges-v1: controles de integridad", () => {
  it("el dataset canonico cuadra exactamente con 18/127/9/30/88 y los totales por categoria", () => {
    const result = validateLegacyBadgeDataset(LEGACY_BADGE_GRANTS, LEGACY_BADGES_V1_EXPECTED_TOTALS);
    expect(result.mismatches).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("detecta un dataset roto (total distinto, categoria sin badge reconocido) y falla explicitamente", () => {
    const broken = [
      { splitLabel: "Split 1", categoryLabel: "Cazador de soluciones", recipientName: "Alguien" },
      { splitLabel: "Split 1", categoryLabel: "Categoria Inventada", recipientName: "Otro" },
    ];
    const result = validateLegacyBadgeDataset(broken, LEGACY_BADGES_V1_EXPECTED_TOTALS);
    expect(result.ok).toBe(false);
    expect(result.unresolvedCategoryLabels).toEqual(["Categoria Inventada"]);
    expect(result.mismatches.some((m) => m.includes("Concesiones totales"))).toBe(true);
    expect(result.mismatches.some((m) => m.includes("Destinatarios históricos") || m.includes("Splits históricos"))).toBe(false);
  });

  it("reejecutar la validacion sobre el mismo dataset da siempre el mismo resultado (determinista)", () => {
    const a = validateLegacyBadgeDataset(LEGACY_BADGE_GRANTS, LEGACY_BADGES_V1_EXPECTED_TOTALS);
    const b = validateLegacyBadgeDataset(LEGACY_BADGE_GRANTS, LEGACY_BADGES_V1_EXPECTED_TOTALS);
    expect(a).toEqual(b);
  });
});

describe("resolucion de categoria historica a badge (alias Team MVP -> MVP Team)", () => {
  it("reconoce el nombre canonico y el alias historico como la misma categoria", () => {
    expect(resolveBadgeCodeForCategoryLabel("MVP Team")).toBe("TEAM_MVP");
    expect(resolveBadgeCodeForCategoryLabel("Team MVP")).toBe("TEAM_MVP");
    expect(resolveBadgeCodeForCategoryLabel("team   mvp")).toBe("TEAM_MVP");
  });

  it("ignora mayusculas, tildes y espacios exteriores al reconocer una categoria", () => {
    expect(resolveBadgeCodeForCategoryLabel("  guardián DE LA estabilidad  ")).toBe("STABILITY_GUARDIAN");
    expect(resolveBadgeCodeForCategoryLabel("guardian de la estabilidad")).toBe("STABILITY_GUARDIAN");
  });

  it("devuelve null para una categoria que no existe en el catalogo", () => {
    expect(resolveBadgeCodeForCategoryLabel("Categoria Inventada")).toBeNull();
  });
});

describe("seleccion de ganadores de badges (seccion 1 del encargo)", () => {
  it("MVP: concede el badge a todas las personas empatadas en el rango 1, nunca a rangos posteriores", () => {
    const winners = selectMvpBadgeWinners([
      { rank: 1, personId: "a" },
      { rank: 1, personId: "b" },
      { rank: 3, personId: "c" },
    ]);
    expect(winners.sort()).toEqual(["a", "b"]);
  });

  it("MVP Team: concede el badge a todos los miembros actuales de la (o las) faccion(es) en rango 1", () => {
    const members = new Map([
      ["faccion-a", ["p1", "p2", "p3"]],
      ["faccion-b", ["p4"]],
    ]);
    const winners = selectTeamMvpBadgeWinners([{ rank: 1, factionId: "faccion-a" }, { rank: 2, factionId: "faccion-b" }], members);
    expect(winners.sort()).toEqual(["p1", "p2", "p3"]);
  });

  it("MVP Team: un empate de facciones en el rango 1 concede el badge a los miembros de todas ellas", () => {
    const members = new Map([
      ["faccion-a", ["p1"]],
      ["faccion-b", ["p2"]],
    ]);
    const winners = selectTeamMvpBadgeWinners([{ rank: 1, factionId: "faccion-a" }, { rank: 1, factionId: "faccion-b" }], members);
    expect(winners.sort()).toEqual(["p1", "p2"]);
  });

  it("MVP Team: sin datos de faccion no se concede nada (comprobado por el llamador, no aqui)", () => {
    const winners = selectTeamMvpBadgeWinners([], new Map());
    expect(winners).toEqual([]);
  });

  it("Badge KPI: todos los empatados en el rango 1 de esa categoria ganan el badge", () => {
    const winners = selectKpiBadgeWinners([
      { rank: 1, personId: "x" },
      { rank: 1, personId: "y" },
      { rank: 2, personId: "z" },
    ]);
    expect(winners.sort()).toEqual(["x", "y"]);
  });
});

describe("ordenacion de la clasificacion general de badges (seccion 6.2 del encargo)", () => {
  const entries = [
    { personId: "a", fullName: "Ana", mvpCount: 2, teamMvpCount: 1, totalCount: 6, countByBadgeCode: new Map([["SOLUTION_HUNTER", 3]]) },
    { personId: "b", fullName: "Bruno", mvpCount: 2, teamMvpCount: 3, totalCount: 8, countByBadgeCode: new Map([["SOLUTION_HUNTER", 1]]) },
    { personId: "c", fullName: "Carla", mvpCount: 0, teamMvpCount: 0, totalCount: 1, countByBadgeCode: new Map() },
  ];

  it("orden por defecto (MVP): mayor MVP, despues mayor total, despues mayor MVP Team, despues nombre", () => {
    const ranked = sortBadgeClassification(entries, BADGE_SORT_MVP);
    // Ana y Bruno empatan a 2 MVP; Bruno tiene mas total (8 > 6), asi que Bruno va primero.
    expect(ranked.map((e) => e.personId)).toEqual(["b", "a", "c"]);
    expect(ranked[0]!.rank).toBe(1);
    expect(ranked[1]!.rank).toBe(2);
    expect(ranked[2]!.rank).toBe(3);
  });

  it("orden por Total de badges", () => {
    const ranked = sortBadgeClassification(entries, BADGE_SORT_TOTAL);
    expect(ranked.map((e) => e.personId)).toEqual(["b", "a", "c"]);
  });

  it("orden por MVP Team", () => {
    const ranked = sortBadgeClassification(entries, BADGE_SORT_TEAM_MVP);
    expect(ranked.map((e) => e.personId)).toEqual(["b", "a", "c"]);
  });

  it("orden por una categoria KPI concreta: las personas con cero siguen apareciendo, al final", () => {
    const ranked = sortBadgeClassification(entries, "SOLUTION_HUNTER");
    expect(ranked.map((e) => e.personId)).toEqual(["a", "b", "c"]);
    expect(ranked[2]!.rank).toBe(3);
  });

  it("un empate exacto en el criterio y en el desempate de total comparte la misma posicion", () => {
    const tied = [
      { personId: "x", fullName: "Zeta", mvpCount: 1, teamMvpCount: 0, totalCount: 1, countByBadgeCode: new Map() },
      { personId: "y", fullName: "Alfa", mvpCount: 1, teamMvpCount: 0, totalCount: 1, countByBadgeCode: new Map() },
    ];
    const ranked = sortBadgeClassification(tied, BADGE_SORT_MVP);
    expect(ranked[0]!.rank).toBe(1);
    expect(ranked[1]!.rank).toBe(1);
    // El desempate visual (nunca de negocio) ordena por nombre: Alfa antes que Zeta.
    expect(ranked.map((e) => e.personId)).toEqual(["y", "x"]);
  });
});
