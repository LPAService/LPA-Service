import { describe, expect, it } from "vitest";
import { opportunitySource, sanitizePageParam } from "@/lib/data/source";

describe("opportunitySource pagination", () => {
  it("falls back to the last valid page when filtered page is beyond the end", async () => {
    const result = await opportunitySource.listOpportunities(
      { category: "alimentos" },
      { page: 2, pageSize: 12 }
    );

    expect(result.total).toBe(2);
    expect(result.totalPages).toBe(1);
    expect(result.page).toBe(1);
    expect(result.data).toHaveLength(2);
    expect(result.data.map((opportunity) => opportunity.orderId)).toEqual([
      "2027075592",
      "2027075586"
    ]);
  });

  it("keeps a valid requested page and slices from the same filtered set", async () => {
    const result = await opportunitySource.listOpportunities({}, { page: 2, pageSize: 12 });

    expect(result.total).toBe(40);
    expect(result.totalPages).toBe(4);
    expect(result.page).toBe(2);
    expect(result.data).toHaveLength(12);
    expect(result.data[0]?.orderId).toBe("2027075573");
  });

  it("resolves changed filters from page 2 to page 1 when new filtered set is shorter", async () => {
    const result = await opportunitySource.listOpportunities(
      { category: "manutencao" },
      { page: 2, pageSize: 12 }
    );

    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.page).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.orderId).toBe("2027075587");
  });

  it("keeps empty state only for filters with no matching results", async () => {
    const result = await opportunitySource.listOpportunities(
      { category: "seguranca" },
      { page: 2, pageSize: 12 }
    );

    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
    expect(result.page).toBe(1);
    expect(result.data).toHaveLength(0);
  });
});

describe("page sanitization", () => {
  it.each([
    ["abc", 1],
    ["", 1],
    ["   ", 1],
    ["0", 1],
    ["-2", 1],
    ["1.5", 1],
    ["999999", 999999],
    [["1", "2"], 1],
    [" 2 ", 2]
  ] as const)("sanitizes page value %j", (value, expected) => {
    expect(sanitizePageParam(value)).toBe(expected);
  });

  it.each([
    [Number.NaN, 1],
    [0, 1],
    [-1, 1],
    [1.5, 1],
    [999999, 4]
  ])("keeps source pagination numeric-safe for %j", async (page, expectedPage) => {
    const result = await opportunitySource.listOpportunities({}, { page, pageSize: 12 });

    expect(result.page).toBe(expectedPage);
    expect(Number.isNaN(result.page)).toBe(false);
    expect(Number.isNaN(result.totalPages)).toBe(false);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("degrades garbage filters to empty state without numeric leaks", async () => {
    const result = await opportunitySource.listOpportunities(
      {
        category: "does-not-exist",
        city: "does-not-exist",
        query: "     no-match     ",
        expenseGroup: "does-not-exist",
        school: "does-not-exist",
        periodStart: "not-a-date",
        periodEnd: "also-not-a-date"
      },
      { page: Number.NaN, pageSize: Number.NaN }
    );

    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.data).toHaveLength(0);
    expect(Number.isNaN(result.page)).toBe(false);
    expect(Number.isNaN(result.totalPages)).toBe(false);
  });
});
