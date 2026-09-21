// @vitest-environment happy-dom
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorksheetPage from "@/app/preorcamento/[externalId]/page";
import { catalogSource } from "@/lib/data/catalog";
import { quotationSource } from "@/lib/data/source";

const mocks = vi.hoisted(() => ({
  worksheetProps: [] as Array<{
    initialRows: Array<{
      itemOrder: number;
      brandOptions: string[];
      chosenBrand: string | null;
    }>;
  }>
}));

vi.mock("@/components/prequote/prequote-worksheet", () => ({
  PrequoteWorksheet: (props: {
    initialRows: Array<{
      itemOrder: number;
      brandOptions: string[];
      chosenBrand: string | null;
    }>;
  }) => {
    mocks.worksheetProps.push(props);
    return null;
  }
}));

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

vi.mock("@/lib/catalog/reference", () => ({
  listReferenceBrands: vi.fn().mockResolvedValue([])
}));

vi.mock("@/lib/db", () => ({
  db: {}
}));

vi.mock("@/components/proposal-action-button", () => ({
  ProposalActionButton: () => React.createElement("button", { type: "button" }, "Fazer lance no portal")
}));

vi.mock("@/components/notification-bell", () => ({
  NotificationBell: () => React.createElement("span", null, "Notificações")
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => React.createElement("button", { type: "button" }, "Tema")
}));

describe("preorcamento brand options", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    mocks.worksheetProps = [];
    vi.mocked(catalogSource.getLatestPreQuoteForQuotation).mockResolvedValue(null);
    vi.mocked(catalogSource.listAllCatalogItems).mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
    vi.clearAllMocks();
  });

  it("preenche brandOptions por fallback da descrição quando existe preQuote", async () => {
    vi.mocked(quotationSource.getOpportunity).mockResolvedValue(makeQuotation());
    vi.mocked(catalogSource.getLatestPreQuoteForQuotation).mockResolvedValue(makePreQuote());

    const pageComponent = await WorksheetPage({ params: Promise.resolve({ externalId: "quote-brands" }) });
    render(pageComponent);

    expect(mocks.worksheetProps[0].initialRows[0]).toMatchObject({
      itemOrder: 1,
      brandOptions: ["Nacional", "Selecta", "Agrofrut"],
      chosenBrand: null
    });
  });

  it("preenche brandOptions por fallback da descrição quando ainda não existe preQuote", async () => {
    vi.mocked(quotationSource.getOpportunity).mockResolvedValue(makeQuotation());

    const pageComponent = await WorksheetPage({ params: Promise.resolve({ externalId: "quote-brands" }) });
    render(pageComponent);

    expect(mocks.worksheetProps[0].initialRows[0]).toMatchObject({
      itemOrder: 1,
      brandOptions: ["Nacional", "Selecta", "Agrofrut"],
      chosenBrand: null
    });
  });

  function render(element: React.ReactNode) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(element));
  }
});

function makeQuotation() {
  return {
    kind: "quotation",
    externalId: "quote-brands",
    orderId: "2026166002",
    school: "E.E. Teste",
    city: "Ibirité",
    expenseGroup: "Material de Consumo",
    headline: "Gêneros alimentícios",
    proposalDeadline: "2026-08-30T12:00:00.000Z",
    deliveryDate: null,
    proposalDate: "2026-08-29T12:00:00.000Z",
    proposalUrl: "https://example.test/proposal",
    canSubmitProposal: true,
    proposalBlocked: false,
    proposalBlockedReason: null,
    totalReferenceValue: 100,
    category: { slug: "alimentos", name: "Alimentos", confidence: null, needsFallback: null },
    items: [
      {
        order: 1,
        name: "Maçã",
        description: "Maçã nacional. Marcas: Nacional, Selecta e Agrofrut.",
        unit: "KG",
        quantity: 10,
        unitValue: null,
        totalValue: null,
        referenceValue: 8
      }
    ]
  } as never;
}

function makePreQuote() {
  return {
    id: 7,
    quotationExternalId: "quote-brands",
    freightCost: 0,
    marginPercent: 20,
    notes: "",
    status: "draft",
    items: [
      {
        itemOrder: 1,
        name: "Maçã",
        description: "Maçã nacional. Marcas: Nacional, Selecta e Agrofrut.",
        unit: "KG",
        quantity: 10,
        referenceValue: 8,
        supplierId: null,
        catalogItemId: null,
        unitCost: null,
        source: "none",
        webTitle: null,
        webPrice: null,
        webUrl: null,
        notes: null,
        warranty: null
      }
    ]
  } as never;
}
