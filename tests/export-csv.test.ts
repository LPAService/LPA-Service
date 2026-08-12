import { describe, expect, it } from "vitest";
import {
  csvRow,
  exportOpportunities,
  opportunityCsvRow
} from "@/lib/export/csv";
import type { OpportunitySource } from "@/lib/data/source";

describe("CSV export", () => {
  it("escapa vírgulas, aspas e quebras de linha", () => {
    expect(csvRow(["texto, com vírgula", 'fala "citada"', "duas\nlinhas"])).toBe(
      '"texto, com vírgula","fala ""citada""","duas\nlinhas"\r\n'
    );
  });

  it("gera linha legível, com nulos vazios e valor brasileiro", () => {
    expect(opportunityCsvRow({
      orderId: "P-1",
      category: null,
      expenseGroup: "Grupo",
      headline: "Título",
      summary: "Resumo, com quebra\nde linha",
      school: "Escola",
      city: null,
      regional: null,
      purchaseDate: "2026-08-12T00:00:00.000Z",
      proposalDate: null,
      deliveryDate: null,
      totalValue: 12.5,
      itemCount: 0,
      topItems: [],
      supplierName: null,
      supplierDocument: null,
      purchaseOrderStatus: null,
      sourceUrl: "https://example.test",
      externalId: "x",
      idSubprogram: 1,
      idSchool: 1,
      idBudget: 1,
      idSupplier: null,
      subprogram: "x",
      year: "2026",
      accountabilityStatus: null,
      initiativeDescription: null,
      items: [],
      attachments: [],
      rawJson: {}
    })).toContain('P-1,,Grupo,Título,"Resumo, com quebra\nde linha",Escola,,,2026-08-12,,,"12,50",0,,,,,https://example.test');
  });

  it("percorre todas páginas filtradas", async () => {
    const calls: number[] = [];
    const source: OpportunitySource = {
      async listOpportunities(filters, page) {
        calls.push(page?.page ?? 0);
        expect(filters).toEqual({ city: "Ibirité" });
        const data = page?.page === 1 ? [opportunity("1"), opportunity("2")] : [opportunity("3")];
        return {
          data,
          total: 3,
          totalAvailable: 4,
          page: page?.page ?? 1,
          pageSize: page?.pageSize ?? 48,
          totalPages: 2,
          facets: { cities: [], categories: [], expenseGroups: [], schools: [] }
        };
      },
      async getOpportunity() { return null; }
    };
    const rows = [];
    for await (const row of exportOpportunities(source, { city: "Ibirité" })) rows.push(row);
    expect(rows).toHaveLength(3);
    expect(calls).toEqual([1, 2]);
  });
});

function opportunity(orderId: string) {
  return {
    externalId: orderId, orderId, sourceUrl: "", idSubprogram: 1, idSchool: 1, idBudget: 1,
    idSupplier: null, school: "", city: null, regional: null, expenseGroup: "", subprogram: "",
    year: "", purchaseDate: null, proposalDate: null, deliveryDate: null, purchaseOrderStatus: null,
    accountabilityStatus: null, supplierName: null, supplierDocument: null, initiativeDescription: null,
    items: [], attachments: [], totalValue: null, itemCount: 0, category: null, headline: "", summary: "",
    topItems: [], rawJson: {}
  };
}
