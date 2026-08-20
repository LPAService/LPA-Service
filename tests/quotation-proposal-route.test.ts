import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/quotations/[externalId]/proposal/route";
import {
  buildQuotationPortalUrl,
  getQuotationProposalTarget
} from "@/lib/data/quotation-source";

vi.mock("@/lib/db", () => ({ db: { execute: vi.fn() } }));
vi.mock("@/lib/data/quotation-source", () => ({
  buildQuotationPortalUrl: vi.fn(() => "https://caixaescolar.educacao.mg.gov.br/compras/orcamento/subprograma/12/escola/34/detalhe-orcamento/6001?nuBudgetOrder=2026166001"),
  getQuotationProposalTarget: vi.fn()
}));

describe("quotation proposal route", () => {
  beforeEach(() => {
    vi.mocked(buildQuotationPortalUrl).mockClear();
    vi.mocked(getQuotationProposalTarget).mockReset();
  });

  it("redireciona cotação conhecida para orçamento no portal", async () => {
    const target = {
      externalId: "quote-open-soon",
      nuBudgetOrder: "2026166001",
      idSubprogram: 12,
      idSchool: 34,
      idBudget: 6001,
      proposalUrl: "https://example.test/quote-open-soon"
    };
    vi.mocked(getQuotationProposalTarget).mockResolvedValue(target);

    const response = await GET(new Request("https://lpa.test/api/quotations/quote-open-soon/proposal"), {
      params: Promise.resolve({ externalId: "quote-open-soon" })
    });

    expect(getQuotationProposalTarget).toHaveBeenCalledWith(expect.anything(), "quote-open-soon");
    expect(buildQuotationPortalUrl).toHaveBeenCalledWith(target);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://caixaescolar.educacao.mg.gov.br/compras/orcamento/subprograma/12/escola/34/detalhe-orcamento/6001?nuBudgetOrder=2026166001"
    );
  });

  it("redireciona cotação inexistente para perfil do portal sem JSON cru", async () => {
    vi.mocked(getQuotationProposalTarget).mockResolvedValue(null);

    const response = await GET(new Request("https://lpa.test/api/quotations/missing/proposal"), {
      params: Promise.resolve({ externalId: "missing" })
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://caixaescolar.educacao.mg.gov.br/selecionar-perfil"
    );
    expect(response.headers.get("content-type")).toBeNull();
  });
});
