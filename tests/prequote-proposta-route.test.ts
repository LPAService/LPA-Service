import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/prequotes/[id]/proposta/route";

const mocks = vi.hoisted(() => ({
  getPreQuote: vi.fn()
}));

vi.mock("@/lib/data/catalog", () => ({
  catalogSource: {
    getPreQuote: mocks.getPreQuote
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
});
