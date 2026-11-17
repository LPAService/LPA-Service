import { describe, expect, it } from "vitest";
import {
  splitQuotations,
  isQuotationOpen,
  type SchoolQuotationRow,
} from "@/lib/data/schools";

function makeRow(
  overrides: Partial<SchoolQuotationRow> = {}
): SchoolQuotationRow {
  return {
    id: 1,
    external_id: "ext-1",
    nu_budget_order: "12345",
    school_name: "EE TESTE",
    county_name: "Contagem",
    expense_group: "Material de Consumo",
    headline: "Materiais para escola",
    summary: "Resumo de teste",
    proposal_deadline: null,
    delivery_date: null,
    item_count: 3,
    total_reference_value: 1500.0,
    proposal_blocked: false,
    no_longer_listed_at: null,
    collected_at: new Date().toISOString(),
    category_name: "Alimentação",
    ...overrides,
  };
}

describe("isQuotationOpen", () => {
  it("returns true when deadline is in the future and not delisted", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const row = makeRow({ proposal_deadline: future.toISOString() });
    expect(isQuotationOpen(row)).toBe(true);
  });

  it("returns false when deadline is in the past", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const row = makeRow({ proposal_deadline: past.toISOString() });
    expect(isQuotationOpen(row)).toBe(false);
  });

  it("returns false when no_longer_listed_at is set even if deadline is future", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const row = makeRow({
      proposal_deadline: future.toISOString(),
      no_longer_listed_at: new Date().toISOString(),
    });
    expect(isQuotationOpen(row)).toBe(false);
  });

  it("returns false when deadline is null", () => {
    const row = makeRow({ proposal_deadline: null });
    expect(isQuotationOpen(row)).toBe(false);
  });

  it("handles Date objects in deadline", () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const row = makeRow({ proposal_deadline: future });
    expect(isQuotationOpen(row)).toBe(true);
  });
});

describe("splitQuotations", () => {
  it("splits quotations into open and closed", () => {
    const now = new Date();
    const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const past = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

    const rows: SchoolQuotationRow[] = [
      makeRow({ id: 1, proposal_deadline: future.toISOString() }),
      makeRow({ id: 2, proposal_deadline: past.toISOString() }),
      makeRow({ id: 3, proposal_deadline: future.toISOString() }),
      makeRow({
        id: 4,
        proposal_deadline: future.toISOString(),
        no_longer_listed_at: now.toISOString(),
      }),
      makeRow({ id: 5, proposal_deadline: null }),
    ];

    const { open, closed } = splitQuotations(rows);

    expect(open.map((r) => r.id)).toEqual([1, 3]);
    expect(closed.map((r) => r.id)).toEqual([2, 4, 5]);
  });

  it("returns all open if all are open", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const rows = [
      makeRow({ id: 1, proposal_deadline: future.toISOString() }),
      makeRow({ id: 2, proposal_deadline: future.toISOString() }),
    ];
    const { open, closed } = splitQuotations(rows);
    expect(open).toHaveLength(2);
    expect(closed).toHaveLength(0);
  });

  it("returns all closed if all are past deadline", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = [
      makeRow({ id: 1, proposal_deadline: past.toISOString() }),
      makeRow({ id: 2, proposal_deadline: past.toISOString() }),
    ];
    const { open, closed } = splitQuotations(rows);
    expect(open).toHaveLength(0);
    expect(closed).toHaveLength(2);
  });

  it("handles empty array", () => {
    const { open, closed } = splitQuotations([]);
    expect(open).toHaveLength(0);
    expect(closed).toHaveLength(0);
  });
});
