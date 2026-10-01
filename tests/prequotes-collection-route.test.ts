import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/prequotes/route";

const mocks = vi.hoisted(() => ({
  createPreQuote: vi.fn(),
  getPreQuote: vi.fn(),
  persistChosenBrands: vi.fn()
}));

vi.mock("@/lib/data/catalog", () => ({
  catalogSource: {
    createPreQuote: mocks.createPreQuote,
    getPreQuote: mocks.getPreQuote
  }
}));

vi.mock("@/app/api/prequotes/[id]/chosen-brand", () => ({
  persistChosenBrands: mocks.persistChosenBrands
}));

describe("prequotes collection route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST persiste a marca escolhida antes de reler o pré-orçamento", async () => {
    const input = {
      quotationExternalId: "quote-x",
      items: [{ itemOrder: 1, chosenBrand: "Qualy" }]
    };
    const preQuote = { id: 7, ...input };
    mocks.createPreQuote.mockResolvedValue(7);
    mocks.getPreQuote.mockResolvedValue(preQuote);

    const response = await POST(
      new Request("https://lpa.test/api/prequotes", {
        method: "POST",
        body: JSON.stringify(input)
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.createPreQuote).toHaveBeenCalledWith(input);
    expect(mocks.persistChosenBrands).toHaveBeenCalledWith(7, input.items);
    expect(mocks.persistChosenBrands.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getPreQuote.mock.invocationCallOrder[0]
    );
    await expect(response.json()).resolves.toEqual({ preQuote });
  });
});
