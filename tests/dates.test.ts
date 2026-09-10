import { describe, expect, it } from "vitest";
import { formatCalendarDate, generateSplitWeeks, parseCalendarDate } from "@/lib/dates";

describe("generateSplitWeeks", () => {
  it("genera semanas correctas empezando en lunes, de lunes a domingo", () => {
    const start = parseCalendarDate("2025-10-06"); // lunes
    const weeks = generateSplitWeeks(start, 3);

    expect(weeks).toHaveLength(3);
    expect(weeks.map((w) => w.sequenceNumber)).toEqual([1, 2, 3]);

    expect(formatCalendarDate(weeks[0]!.startDate)).toBe("2025-10-06");
    expect(formatCalendarDate(weeks[0]!.endDate)).toBe("2025-10-12");

    expect(formatCalendarDate(weeks[1]!.startDate)).toBe("2025-10-13");
    expect(formatCalendarDate(weeks[1]!.endDate)).toBe("2025-10-19");

    expect(formatCalendarDate(weeks[2]!.startDate)).toBe("2025-10-20");
    expect(formatCalendarDate(weeks[2]!.endDate)).toBe("2025-10-26");
  });

  it("rechaza una fecha inicial que no sea lunes", () => {
    const tuesday = parseCalendarDate("2025-10-07");
    expect(() => generateSplitWeeks(tuesday, 3)).toThrow(/lunes/i);
  });

  it("rechaza un numero de semanas no positivo", () => {
    const monday = parseCalendarDate("2025-10-06");
    expect(() => generateSplitWeeks(monday, 0)).toThrow();
  });
});
