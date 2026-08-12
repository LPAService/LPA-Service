import { describe, expect, it } from "vitest";
import { opportunitySource } from "@/lib/data/source";

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
