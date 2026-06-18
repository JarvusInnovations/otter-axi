import { describe, expect, it } from "vitest";
import { normalizeDate } from "../src/dates.js";

const now = new Date("2026-06-18T12:00:00Z");

describe("normalizeDate", () => {
  it("normalizes ISO dates to YYYY/MM/DD", () => {
    expect(normalizeDate("2026-05-01", now)).toBe("2026/05/01");
    expect(normalizeDate("2026/5/1", now)).toBe("2026/05/01");
  });

  it("resolves relative day windows anchored to now", () => {
    expect(normalizeDate("7d", now)).toBe("2026/06/11");
    expect(normalizeDate("30d", now)).toBe("2026/05/19");
  });

  it("resolves weeks, months, and years", () => {
    expect(normalizeDate("2w", now)).toBe("2026/06/04");
    expect(normalizeDate("3m", now)).toBe("2026/03/18");
    expect(normalizeDate("1y", now)).toBe("2025/06/18");
  });

  it("throws a VALIDATION_ERROR on unparseable input", () => {
    expect(() => normalizeDate("last tuesday", now)).toThrowError(/Unrecognized date/);
  });
});
