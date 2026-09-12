import { describe, expect, it } from "vitest";
import { groupAndOrderProfileCards, type ProfileOrderInput } from "@/domain/profile-order";

/**
 * Pruebas acotadas del orden de `/fichas` (`1.0.1`, parte F del encargo):
 * ACTIVE y DRAFT ascendente por fecha de inicio, CLOSED descendente (el mas
 * reciente finalizado primero), nunca mezclados entre grupos, y empate por
 * nombre alfabetico en castellano.
 */
function card(overrides: Partial<ProfileOrderInput> & { id: string }): ProfileOrderInput & { id: string } {
  return {
    splitStatus: "ACTIVE",
    splitStartDate: new Date("2026-01-05T00:00:00Z"),
    splitName: "Split",
    ...overrides,
  };
}

describe("groupAndOrderProfileCards", () => {
  it("separa por estado sin mezclar un split finalizado entre los activos", () => {
    const cards = [
      card({ id: "closed-1", splitStatus: "CLOSED" }),
      card({ id: "active-1", splitStatus: "ACTIVE" }),
      card({ id: "draft-1", splitStatus: "DRAFT" }),
    ];
    const { active, upcoming, closed } = groupAndOrderProfileCards(cards);
    expect(active.map((c) => c.id)).toEqual(["active-1"]);
    expect(upcoming.map((c) => c.id)).toEqual(["draft-1"]);
    expect(closed.map((c) => c.id)).toEqual(["closed-1"]);
  });

  it("varios splits ACTIVE se ordenan por fecha de inicio ascendente", () => {
    const cards = [
      card({ id: "later", splitStatus: "ACTIVE", splitStartDate: new Date("2026-03-01T00:00:00Z") }),
      card({ id: "earlier", splitStatus: "ACTIVE", splitStartDate: new Date("2026-01-01T00:00:00Z") }),
    ];
    const { active } = groupAndOrderProfileCards(cards);
    expect(active.map((c) => c.id)).toEqual(["earlier", "later"]);
  });

  it("los splits CLOSED se ordenan por fecha de inicio descendente (el mas reciente finalizado primero)", () => {
    const cards = [
      card({ id: "old", splitStatus: "CLOSED", splitStartDate: new Date("2026-01-01T00:00:00Z") }),
      card({ id: "recent", splitStatus: "CLOSED", splitStartDate: new Date("2026-06-01T00:00:00Z") }),
    ];
    const { closed } = groupAndOrderProfileCards(cards);
    expect(closed.map((c) => c.id)).toEqual(["recent", "old"]);
  });

  it("un empate de fecha se desempata por nombre alfabetico", () => {
    const sameDate = new Date("2026-01-01T00:00:00Z");
    const cards = [
      card({ id: "b", splitStatus: "ACTIVE", splitStartDate: sameDate, splitName: "Split B" }),
      card({ id: "a", splitStatus: "ACTIVE", splitStartDate: sameDate, splitName: "Split A" }),
    ];
    const { active } = groupAndOrderProfileCards(cards);
    expect(active.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("un split DRAFT (proximo) no se omite: se ordena igual que ACTIVE, ascendente por fecha", () => {
    const cards = [
      card({ id: "later", splitStatus: "DRAFT", splitStartDate: new Date("2026-05-01T00:00:00Z") }),
      card({ id: "earlier", splitStatus: "DRAFT", splitStartDate: new Date("2026-02-01T00:00:00Z") }),
    ];
    const { upcoming } = groupAndOrderProfileCards(cards);
    expect(upcoming.map((c) => c.id)).toEqual(["earlier", "later"]);
  });
});
