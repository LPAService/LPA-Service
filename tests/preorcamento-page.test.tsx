// @vitest-environment happy-dom
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorksheetPage from "@/app/preorcamento/[externalId]/page";
import { matchReferenceProducts } from "@/lib/catalog/reference-match";
import { catalogSource } from "@/lib/data/catalog";
import { quotationSource } from "@/lib/data/source";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not found");
  })
}));

vi.mock("@/lib/data/catalog", () => ({
  catalogSource: {
    getLatestPreQuoteForQuotation: vi.fn().mockResolvedValue(null),
    listAllCatalogItems: vi.fn().mockResolvedValue([])
  }
}));

vi.mock("@/lib/data/source", () => ({
  quotationSource: {
    getOpportunity: vi.fn()
  }
}));

vi.mock("@/lib/catalog/reference-match", () => ({
  matchReferenceProducts: vi.fn().mockResolvedValue([])
}));

vi.mock("@/components/notification-bell", () => ({
  NotificationBell: () => React.createElement("span", null, "Notificações")
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => React.createElement("button", { type: "button" }, "Tema")
}));

describe("WorksheetPage", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: {} })
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("mostra Fazer lance no portal no header e no rodapé do pré-orçamento", async () => {
    vi.mocked(quotationSource.getOpportunity).mockResolvedValue(makeQuotation());

    const pageComponent = await WorksheetPage({ params: Promise.resolve({ externalId: "quote-open-soon" }) });
    render(pageComponent);

    const buttons = actionButtons();
    expect(buttons).toHaveLength(2);
    expect(buttons.every((button) => !button.disabled)).toBe(true);
    expect(catalogSource.getLatestPreQuoteForQuotation).toHaveBeenCalledWith("quote-open-soon");
  });

  it("desabilita Fazer lance no portal nos dois pontos quando proposta está bloqueada", async () => {
    vi.mocked(quotationSource.getOpportunity).mockResolvedValue(
      makeQuotation({
        canSubmitProposal: false,
        proposalBlocked: true,
        proposalBlockedReason: "PROCESSO DE REGULARIZAÇÃO NO SISTEMA, NÃO ENVIAR PROPOSTA."
      })
    );

    const pageComponent = await WorksheetPage({ params: Promise.resolve({ externalId: "quote-open-soon" }) });
    render(pageComponent);

    const buttons = actionButtons();
    expect(buttons).toHaveLength(2);
    expect(buttons.every((button) => button.disabled)).toBe(true);
    expect(container!.textContent).toContain("PROCESSO DE REGULARIZAÇÃO NO SISTEMA, NÃO ENVIAR PROPOSTA.");
  });

  it("renderiza itens e sugestões restantes quando consulta de referência falha", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(quotationSource.getOpportunity).mockResolvedValue(
      makeQuotation({
        items: [
          {
            order: 1,
            name: "Caderno",
            description: "Caderno universitário",
            unit: "UN",
            quantity: 2,
            unitValue: null,
            totalValue: null,
            referenceValue: 10
          },
          {
            order: 2,
            name: "Caneta",
            description: "Caneta azul",
            unit: "UN",
            quantity: 3,
            unitValue: null,
            totalValue: null,
            referenceValue: 2
          }
        ]
      })
    );
    vi.mocked(matchReferenceProducts)
      .mockRejectedValueOnce(new Error("relation reference_products does not exist"))
      .mockResolvedValueOnce([
        {
          item: {
            id: 10,
            source: "cescom",
            name: "CANETA AZUL BIC",
            normalizedName: "caneta azul bic",
            ean: "7890000000000",
            brand: "BIC",
            department: "PAPELARIA",
            url: "https://cescom.test/caneta"
          },
          score: 3,
          matchedTokens: ["caneta", "azul"]
        }
      ]);

    try {
      const pageComponent = await WorksheetPage({ params: Promise.resolve({ externalId: "quote-open-soon" }) });
      render(pageComponent);

      expect(container!.textContent).toContain("Caderno");
      expect(container!.textContent).toContain("Caneta");
      expect(container!.textContent).toContain("CANETA AZUL BIC");
      expect(actionButtons()).toHaveLength(2);
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to match reference products for prequote item",
        expect.objectContaining({
          error: expect.any(Error),
          externalId: "quote-open-soon",
          itemOrder: 1
        })
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  function render(element: React.ReactNode) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(element));
  }

  function actionButtons() {
    return Array.from(container!.querySelectorAll("button")).filter((button) =>
      button.textContent?.includes("Fazer lance no portal")
    );
  }
});

function makeQuotation(patch: Record<string, unknown> = {}) {
  return {
    kind: "quotation",
    externalId: "quote-open-soon",
    orderId: "2026166001",
    school: "E.E. Teste",
    city: "Ibirité",
    expenseGroup: "Material de Consumo",
    headline: "Material escolar",
    proposalDeadline: "2026-08-30T12:00:00.000Z",
    proposalDate: "2026-08-29T12:00:00.000Z",
    proposalUrl: "https://example.test/proposal",
    canSubmitProposal: true,
    proposalBlocked: false,
    proposalBlockedReason: null,
    totalReferenceValue: 100,
    category: { slug: "material", name: "Material escolar", confidence: null, needsFallback: null },
    items: [
      {
        order: 1,
        name: "Caderno",
        description: "Caderno universitário",
        unit: "UN",
        quantity: 2,
        unitValue: null,
        totalValue: null,
        referenceValue: 10
      }
    ],
    ...patch
  } as never;
}
