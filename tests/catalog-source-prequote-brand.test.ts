import { describe, expect, it, vi } from "vitest";
import { createCatalogSource } from "@/lib/catalog/source";

describe("catalog source prequote brand", () => {
  it("expõe chosen_brand como chosenBrand ao ler o pré-orçamento", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({
        rows: [{
          id: 7,
          quotation_external_id: "quote-x",
          order_id: "2026001",
          school_name: "EE Teste",
          city: "Ibirité",
          expense_group: "Material de Consumo",
          headline: "Compra",
          margin_percent: 10,
          freight_cost: 0,
          status: "draft",
          notes: null,
          created_at: "2026-10-01T12:00:00.000Z",
          updated_at: "2026-10-01T12:00:00.000Z"
        }]
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 11,
          pre_quote_id: 7,
          item_order: 1,
          name: "Margarina",
          description: "Marcas: Qualy e Doriana",
          unit: "UN",
          quantity: 2,
          reference_value: 10,
          supplier_id: null,
          catalog_item_id: null,
          unit_cost: 8,
          total_cost: 16,
          source: "manual",
          web_title: null,
          web_price: null,
          web_url: null,
          web_searched_at: null,
          notes: null,
          warranty: null,
          chosen_brand: "Qualy"
        }]
      });
    const source = createCatalogSource({ execute } as never);

    const preQuote = await source.getPreQuote(7);

    expect(preQuote?.items[0].chosenBrand).toBe("Qualy");
  });
});
