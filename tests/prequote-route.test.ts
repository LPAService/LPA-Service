import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/prequotes/[id]/route";

const mocks = vi.hoisted(() => ({
  getPreQuote: vi.fn(),
  savePreQuote: vi.fn(),
  deletePreQuote: vi.fn(),
  dbExecute: vi.fn()
}));

vi.mock("@/lib/data/catalog", () => ({
  catalogSource: {
    getPreQuote: mocks.getPreQuote,
    savePreQuote: mocks.savePreQuote,
    deletePreQuote: mocks.deletePreQuote
  }
}));

vi.mock("@/lib/db", () => ({
  db: {
    execute: mocks.dbExecute
  }
}));

const preQuote = () => ({
  id: 7,
  quotationExternalId: "quote-x",
  orderId: "2026202245",
  marginPercent: 20,
  freightCost: 0,
  items: [
    {
      id: 1,
      itemOrder: 1,
      name: "Margarina",
      description: "MARCAS EXIGIDAS : QUALY,DORIANA,DELICIA",
      quantity: 10,
      unit: "UN",
      referenceValue: null,
      supplierId: null,
      catalogItemId: null,
      unitCost: 8,
      totalCost: 80,
      source: "manual",
      webTitle: null,
      webPrice: null,
      webUrl: null,
      webSearchedAt: null,
      notes: "Margarina 500g.",
      warranty: "Validade adequada."
    }
  ]
});

describe("prequote route", () => {
  beforeEach(() => {
    mocks.getPreQuote.mockReset();
    mocks.savePreQuote.mockReset();
    mocks.deletePreQuote.mockReset();
    mocks.dbExecute.mockReset();
  });

  it("GET expõe brandOptions e chosenBrand", async () => {
    mocks.getPreQuote.mockResolvedValue(preQuote());
    mocks.dbExecute.mockResolvedValue({ rows: [{ item_order: 1, chosen_brand: "Qualy" }] });

    const response = await GET(new Request("https://lpa.test/api/prequotes/7"), {
      params: Promise.resolve({ id: "7" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.preQuote.items[0]).toMatchObject({
      brandOptions: ["Qualy", "Doriana", "Delicia"],
      chosenBrand: "Qualy"
    });
  });

  it("PUT salva chosenBrand e devolve o campo no item", async () => {
    const input = {
      quotationExternalId: "quote-x",
      items: [{ itemOrder: 1, chosenBrand: "Doriana" }]
    };

    mocks.dbExecute
      .mockResolvedValueOnce({ rows: [{ item_order: 1, chosen_brand: "Qualy" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ item_order: 1, chosen_brand: "Doriana" }] });
    mocks.savePreQuote.mockResolvedValue(7);
    mocks.getPreQuote.mockResolvedValue(preQuote());

    const response = await PUT(
      new Request("https://lpa.test/api/prequotes/7", {
        method: "PUT",
        body: JSON.stringify(input)
      }),
      { params: Promise.resolve({ id: "7" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.savePreQuote).toHaveBeenCalledWith(7, input);
    expect(mocks.dbExecute).toHaveBeenCalledTimes(3);
    expect(body.preQuote.items[0].chosenBrand).toBe("Doriana");
  });
});
