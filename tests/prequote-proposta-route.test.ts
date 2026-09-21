import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/prequotes/[id]/proposta/route";

const mocks = vi.hoisted(() => ({
  getPreQuote: vi.fn(),
  dbExecute: vi.fn()
}));

vi.mock("@/lib/data/catalog", () => ({
  catalogSource: {
    getPreQuote: mocks.getPreQuote
  }
}));

vi.mock("@/lib/db", () => ({
  db: {
    execute: mocks.dbExecute
  }
}));

const preQuote = (patch: Record<string, unknown> = {}) => ({
  id: 7,
  quotationExternalId: "quote-open-soon",
  orderId: "2026166001",
  marginPercent: 20,
  freightCost: 0,
  items: [
    {
      itemOrder: 1,
      name: "Açúcar cristal",
      description: "Açúcar cristal, pacote de 5 KG.",
      quantity: 100,
      unit: "KG",
      unitCost: 5,
      notes: "Açúcar cristal, 100 KG.",
      warranty: "Produto lacrado, validade mínima de 6 meses."
    }
  ],
  ...patch
});

describe("prequote proposta route", () => {
  beforeEach(() => {
    mocks.getPreQuote.mockReset();
    mocks.dbExecute.mockReset();
    mocks.dbExecute.mockResolvedValue({ rows: [] });
  });

  it("devolve proposta e dados de navegação do portal", async () => {
    mocks.getPreQuote.mockResolvedValue(preQuote());

    const response = await GET(new Request("https://lpa.test/api/prequotes/7/proposta"), {
      params: Promise.resolve({ id: "7" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.portal).toEqual({
      proposalUrl: "/api/quotations/quote-open-soon/proposal",
      orderId: "2026166001",
      quotationExternalId: "quote-open-soon"
    });
    expect(body.proposta).toMatchObject({
      quotationExternalId: "quote-open-soon",
      preQuoteId: 7,
      itemCount: 1
    });
  });

  it("mantém 409 com blockers quando pré-orçamento não está pronto", async () => {
    mocks.getPreQuote.mockResolvedValue(
      preQuote({
        items: [
          {
            itemOrder: 1,
            name: "Açúcar cristal",
            description: "Açúcar cristal, pacote de 5 KG.",
            quantity: 100,
            unit: "KG",
            unitCost: null,
            notes: "Açúcar cristal, 100 KG.",
            warranty: ""
          }
        ]
      })
    );

    const response = await GET(new Request("https://lpa.test/api/prequotes/7/proposta"), {
      params: Promise.resolve({ id: "7" })
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: "Pré-orçamento ainda não está pronto para virar proposta.",
      blockers: ["Item 1 (Açúcar cristal): sem preço."]
    });
  });

  it("bloqueia proposta quando item exige marca e nenhuma foi escolhida", async () => {
    mocks.getPreQuote.mockResolvedValue(
      preQuote({
        items: [
          {
            itemOrder: 1,
            name: "Margarina",
            description: "MARCAS EXIGIDAS : QUALY,DORIANA,DELICIA",
            quantity: 10,
            unit: "UN",
            unitCost: 8,
            notes: "Margarina 500g.",
            warranty: "Validade adequada."
          }
        ]
      })
    );

    const response = await GET(new Request("https://lpa.test/api/prequotes/7/proposta"), {
      params: Promise.resolve({ id: "7" })
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.blockers).toEqual([
      "Item 1 (Margarina): exige marca ofertada e nenhuma foi escolhida."
    ]);
  });

  it("usa marca escolhida salva na proposta", async () => {
    mocks.dbExecute.mockResolvedValue({ rows: [{ item_order: 1, chosen_brand: "Qualy" }] });
    mocks.getPreQuote.mockResolvedValue(
      preQuote({
        items: [
          {
            itemOrder: 1,
            name: "Margarina",
            description: "MARCAS EXIGIDAS : QUALY,DORIANA,DELICIA",
            quantity: 10,
            unit: "UN",
            unitCost: 8,
            notes: "Margarina 500g.",
            warranty: "Validade adequada."
          }
        ]
      })
    );

    const response = await GET(new Request("https://lpa.test/api/prequotes/7/proposta"), {
      params: Promise.resolve({ id: "7" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.proposta.items[0]).toMatchObject({
      brandOptions: ["Qualy", "Doriana", "Delicia"],
      chosenBrand: "Qualy",
      txWarrantyDescription: "Marca ofertada: Qualy. Validade adequada."
    });
  });
});
