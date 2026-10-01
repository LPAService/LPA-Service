// @vitest-environment happy-dom
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PreOrcamentoPage from "@/app/preorcamento/page";
import { catalogSource } from "@/lib/data/catalog";
import { quotationSource } from "@/lib/data/source";
import type { OpportunityListResult } from "@/lib/data/source";
import type { PreQuoteListResult } from "@/lib/catalog/source";
import type { NormalizedOpportunity } from "@/lib/contracts/opportunity";

vi.mock("@/lib/data/catalog", () => ({
  catalogSource: {
    listPreQuotes: vi.fn()
  }
}));

vi.mock("@/lib/data/source", () => ({
  quotationSource: {
    listOpportunities: vi.fn()
  },
  sanitizePageParam: vi.fn((val) => {
    const num = Number(val);
    return Number.isInteger(num) && num > 0 ? num : 1;
  })
}));

vi.mock("@/components/notification-bell", () => ({
  NotificationBell: () => React.createElement("span", null, "Notificações")
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => React.createElement("button", { type: "button" }, "Tema")
}));

vi.mock("@/components/prequote/prequote-delete-button", () => ({
  PrequoteDeleteButton: () => React.createElement("button", { type: "button" }, "Excluir")
}));

describe("PreOrcamentoPage", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    vi.clearAllMocks();
  });

  it("chama quotationSource e catalogSource com parâmetros de paginação e renderiza a navegação", async () => {
    const mockOpportunity: NormalizedOpportunity = {
      kind: "quotation",
      externalId: "quote-1",
      orderId: "2026166001",
      sourceUrl: "https://example.test/quote-1",
      proposalUrl: "https://example.test/quote-1",
      canSubmitProposal: true,
      idSubprogram: 12,
      idSchool: 34,
      idBudget: 6001,
      idSupplier: null,
      school: "EE Teste",
      city: "Belo Horizonte",
      regional: null,
      expenseGroup: "Material de Consumo",
      subprogram: "Não informado",
      year: "2026",
      purchaseDate: null,
      proposalDate: "2026-10-10",
      proposalDeadline: "2026-10-10",
      deliveryDate: "2026-10-20",
      purchaseOrderStatus: "ENVI",
      accountabilityStatus: null,
      supplierName: null,
      supplierDocument: null,
      initiativeDescription: null,
      headline: "Compra de teste",
      summary: "Resumo",
      itemCount: 1,
      totalValue: 100,
      category: { name: "Geral", slug: "geral", confidence: 1, needsFallback: false },
      attachments: [],
      topItems: [],
      rawJson: {},
      items: [
        {
          order: 1,
          name: "Item 1",
          description: "",
          unit: "UN",
          quantity: 1,
          unitValue: 100,
          totalValue: 100,
          isPermanent: false,
          expenseCategory: "Custeio"
        }
      ]
    };

    const mockOpportunityResult: OpportunityListResult = {
      data: [mockOpportunity],
      total: 96,
      totalAvailable: 96,
      page: 2,
      pageSize: 48,
      totalPages: 2,
      facets: { cities: [], categories: [], expenseGroups: [], schools: [] }
    };
    vi.mocked(quotationSource.listOpportunities).mockResolvedValue(mockOpportunityResult);

    const mockPreQuoteResult: PreQuoteListResult = {
      data: [
        {
          id: 100,
          quotationExternalId: "quote-1",
          orderId: "PED-1",
          schoolName: "Escola PreQuote",
          city: "Contagem",
          expenseGroup: "Alimentos",
          headline: "Pré-orçamento 1",
          marginPercent: 10,
          freightCost: 0,
          status: "draft",
          notes: null,
          createdAt: null,
          updatedAt: null,
          items: []
        }
      ],
      total: 50,
      page: 1,
      pageSize: 24,
      totalPages: 3
    };
    (catalogSource.listPreQuotes as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockPreQuoteResult);

    const pageElement = await PreOrcamentoPage({
      searchParams: Promise.resolve({ page: "2", savedPage: "1" })
    });

    await act(async () => {
      root!.render(pageElement);
    });

    expect(quotationSource.listOpportunities).toHaveBeenCalledWith(
      { situation: "open" },
      { page: 2, pageSize: 48 }
    );
    expect(catalogSource.listPreQuotes).toHaveBeenCalledWith({
      page: 1,
      pageSize: 24
    });

    // Check pagination navigation links
    const links = Array.from(container!.querySelectorAll("a"));
    const savedPrev = links.find((l) => l.getAttribute("href")?.includes("savedPage=1"));
    const savedNext = links.find((l) => l.getAttribute("href")?.includes("savedPage=2"));
    expect(savedPrev).toBeDefined();
    expect(savedNext).toBeDefined();

    const openPrev = links.find((l) => l.getAttribute("href")?.includes("page=1"));
    expect(openPrev).toBeDefined();

    // Check metrics show total counts
    expect(container!.textContent).toContain("96");
    expect(container!.textContent).toContain("cotações abertas");
    expect(container!.textContent).toContain("50");
    expect(container!.textContent).toContain("pré-orçamentos");
  });
});
