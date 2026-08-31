// @vitest-environment happy-dom
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrequoteWorksheet, type WorksheetQuotation, type WorksheetRow } from "@/components/prequote/prequote-worksheet";
import type { CatalogItemLite } from "@/lib/catalog/match";
import type { ReferenceMatch } from "@/lib/catalog/reference-match";
import { formatBRL } from "@/lib/prequote/calc";
import type { BestPriceResult } from "@/lib/search/best-price";

vi.mock("@/components/proposal-action-button", () => ({
  ProposalActionButton: () => React.createElement("button", { type: "button" }, "Lance")
}));

const mockQuotation: WorksheetQuotation = {
  externalId: "quote-1",
  orderId: "2026166001",
  school: "E.E. Cecília Meireles",
  city: "Belo Horizonte",
  expenseGroup: "Material de Consumo",
  headline: "Material escolar",
  proposalDeadline: "2026-09-01T12:00:00.000Z",
  totalReferenceValue: 500,
  categoryName: "Papelaria"
};

const mockCatalogItems: CatalogItemLite[] = [
  {
    id: 101,
    supplierId: 1,
    supplierName: "Papelaria Central",
    name: "Caderno Espiral 96fls",
    normalizedName: "caderno espiral 96fls",
    unit: "UN",
    unitPrice: 12.5
  }
];

describe("PrequoteWorksheet - Sugestões Automáticas", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("dispara UMA única chamada em lote para /api/search/best-price/batch ao montar", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/search/best-price/batch") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            results: {
              "Caderno 96fls": {
                query: "Caderno 96fls",
                provider: "realdist",
                offers: [
                  {
                    provider: "realdist",
                    title: "Caderno 96fls Espiral Tilibra",
                    price: 11.9,
                    currency: "BRL",
                    url: "https://www.realdist.com.br/caderno-96",
                    thumbnail: null,
                    seller: "Real Distribuidora",
                    condition: "new",
                    available: null
                  }
                ],
                error: null
              } as BestPriceResult
            }
          })
        });
      }
      return Promise.reject(new Error("Unexpected url: " + url));
    });
    global.fetch = fetchMock;

    const rows: WorksheetRow[] = [
      makeRow({ itemOrder: 1, name: "Caderno 96fls", unitCost: null }),
      makeRow({ itemOrder: 2, name: "Lápis Preto HB", unitCost: 1.5 }), // já tem custo
      makeRow({ itemOrder: 3, name: "Borracha Branca", unitCost: null })
    ];

    await act(async () => {
      root!.render(
        <PrequoteWorksheet
          catalogItems={mockCatalogItems}
          initialPreQuoteId={null}
          initialRows={rows}
          quotation={mockQuotation}
          referenceSuggestions={{}}
          suggestions={{}}
        />
      );
    });

    // Confirma que fez exatamente 1 chamada para o endpoint batch
    const batchCalls = fetchMock.mock.calls.filter(([url]) => url === "/api/search/best-price/batch");
    expect(batchCalls).toHaveLength(1);

    const body = JSON.parse(batchCalls[0][1]?.body as string);
    // Somente os itens com unitCost === null são enviados
    expect(body.queries).toEqual(["Caderno 96fls", "Borracha Branca"]);
  });

  it("renderiza a oferta da Real Distribuidora com preço e botão 'Usar preço'", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/search/best-price/batch") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            results: {
              "Caderno 96fls": {
                query: "Caderno 96fls",
                provider: "realdist",
                offers: [
                  {
                    provider: "realdist",
                    title: "Caderno 96fls Espiral Tilibra",
                    price: 11.9,
                    currency: "BRL",
                    url: "https://www.realdist.com.br/caderno-96",
                    thumbnail: null,
                    seller: "Real Distribuidora",
                    condition: "new",
                    available: null
                  }
                ],
                error: null
              } as BestPriceResult
            }
          })
        });
      }
      return Promise.reject(new Error("Unexpected url: " + url));
    });
    global.fetch = fetchMock;

    const rows: WorksheetRow[] = [
      makeRow({ itemOrder: 1, name: "Caderno 96fls", quantity: 10, unitCost: null })
    ];

    await act(async () => {
      root!.render(
        <PrequoteWorksheet
          catalogItems={mockCatalogItems}
          initialPreQuoteId={null}
          initialRows={rows}
          quotation={mockQuotation}
          referenceSuggestions={{}}
          suggestions={{}}
        />
      );
    });

    expect(container!.textContent).toContain("Caderno 96fls Espiral Tilibra");
    expect(container!.textContent).toContain(formatBRL(11.9));
    expect(container!.textContent).toContain("Real Distribuidora");

    // Encontra o botão "Usar preço" da oferta
    const usePriceButtons = Array.from(container!.querySelectorAll("button")).filter(
      (b) => b.textContent?.trim() === "Usar preço"
    );
    expect(usePriceButtons).toHaveLength(1);

    // Clica em "Usar preço"
    await act(async () => {
      usePriceButtons[0].click();
    });

    // Linha agora tem custo preenchido de 11.90 e total de 119.00
    const costInput = container!.querySelector('input[type="number"]') as HTMLInputElement;
    expect(costInput.value).toBe("11.9");
    expect(container!.textContent).toContain("INTERNET");
    expect(container!.textContent).toContain("🌐 Menor preço encontrado na internet:");
  });

  it("renderiza identificação da Cescom SEM preço, SEM R$ 0,00 e SEM botão 'Usar preço'", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: {} })
    });
    global.fetch = fetchMock;

    const referenceSuggestions: Record<number, ReferenceMatch[]> = {
      1: [
        {
          item: {
            id: 501,
            source: "cescom",
            name: "CADERNO UNIVERSITARIO 96 FLS CAPA DURA",
            normalizedName: "caderno universitario 96 fls capa dura",
            ean: "7891027112233",
            brand: "TILIBRA",
            department: "PAPELARIA",
            url: "https://cescom.com.br/item/501"
          },
          score: 8.5,
          matchedTokens: ["caderno", "96"]
        }
      ]
    };

    const rows: WorksheetRow[] = [
      makeRow({ itemOrder: 1, name: "Caderno 96fls", unitCost: null })
    ];

    await act(async () => {
      root!.render(
        <PrequoteWorksheet
          catalogItems={mockCatalogItems}
          initialPreQuoteId={null}
          initialRows={rows}
          quotation={mockQuotation}
          referenceSuggestions={referenceSuggestions}
          suggestions={{}}
        />
      );
    });

    // Identificação está presente
    expect(container!.textContent).toContain("Identificação do produto (Cescom):");
    expect(container!.textContent).toContain("CADERNO UNIVERSITARIO 96 FLS CAPA DURA");
    expect(container!.textContent).toContain("7891027112233");
    expect(container!.textContent).toContain("TILIBRA");

    // REGRA DURA: NÃO pode haver preço na seção Cescom nem botão "Usar preço"
    const usePriceButtons = Array.from(container!.querySelectorAll("button")).filter(
      (b) => b.textContent?.trim() === "Usar preço"
    );
    expect(usePriceButtons).toHaveLength(0);

    // Não pode haver R$ 0,00 associado a Cescom
    const cescomSection = container!.querySelector(".border-dashed");
    expect(cescomSection).not.toBeNull();
    expect(cescomSection!.textContent).not.toContain("R$");
    expect(cescomSection!.textContent).not.toContain("0,00");
  });

  it("deduplica sugestões da Cescom com mesmo nome", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: {} })
    });
    global.fetch = fetchMock;

    const referenceSuggestions: Record<number, ReferenceMatch[]> = {
      1: [
        {
          item: {
            id: 501,
            source: "cescom",
            name: "DETERGENTE LIQUIDO 500ML",
            normalizedName: "detergente liquido 500ml",
            ean: "78910001",
            brand: "YPÊ",
            department: "LIMPEZA",
            url: null
          },
          score: 8.0,
          matchedTokens: ["detergente"]
        },
        {
          item: {
            id: 502,
            source: "cescom",
            name: "DETERGENTE LIQUIDO 500ML", // Nome duplicado
            normalizedName: "detergente liquido 500ml",
            ean: "78910002",
            brand: "LIMPOL",
            department: "LIMPEZA",
            url: null
          },
          score: 7.9,
          matchedTokens: ["detergente"]
        }
      ]
    };

    const rows: WorksheetRow[] = [
      makeRow({ itemOrder: 1, name: "Detergente 500ml", unitCost: null })
    ];

    await act(async () => {
      root!.render(
        <PrequoteWorksheet
          catalogItems={mockCatalogItems}
          initialPreQuoteId={null}
          initialRows={rows}
          quotation={mockQuotation}
          referenceSuggestions={referenceSuggestions}
          suggestions={{}}
        />
      );
    });

    // Aparece exatamente 1 item de identificação do Cescom
    const cescomItems = container!.querySelectorAll(".border-dashed");
    expect(cescomItems).toHaveLength(1);
    expect(cescomItems[0].textContent).toContain("YPÊ");
  });

  it("não renderiza área de sugestão vazia nem erro quando item não tem sugestões", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: {
          "Item Raro": {
            query: "Item Raro",
            provider: "none",
            offers: [],
            error: "Nenhuma oferta encontrada."
          }
        }
      })
    });
    global.fetch = fetchMock;

    const rows: WorksheetRow[] = [
      makeRow({ itemOrder: 1, name: "Item Raro", unitCost: null })
    ];

    await act(async () => {
      root!.render(
        <PrequoteWorksheet
          catalogItems={mockCatalogItems}
          initialPreQuoteId={null}
          initialRows={rows}
          quotation={mockQuotation}
          referenceSuggestions={{}}
          suggestions={{}}
        />
      );
    });

    // Não renderiza caixa de sugestão nem erro ruidoso
    expect(container!.textContent).not.toContain("💡 Sugestões para este item");
    expect(container!.textContent).not.toContain("Nenhuma oferta encontrada.");
    expect(container!.textContent).not.toContain("Falha ao buscar preços");
  });

  it("não renderiza sugestão automática irrelevante mesmo se o batch devolver oferta crua", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: {
          "Clip de papel": {
            query: "Clip de papel",
            provider: "realdist",
            offers: [
              {
                provider: "realdist",
                title: "Toalhas De Papel Interfolhadas Limpmax",
                price: 15.66,
                currency: "BRL",
                url: "https://www.realdist.com.br/toalha-papel",
                thumbnail: null,
                seller: "Real Distribuidora",
                condition: "new",
                available: null
              }
            ],
            error: null
          } as BestPriceResult
        }
      })
    });
    global.fetch = fetchMock;

    const rows: WorksheetRow[] = [
      makeRow({ itemOrder: 1, name: "Clip de papel", unitCost: null })
    ];

    await act(async () => {
      root!.render(
        <PrequoteWorksheet
          catalogItems={mockCatalogItems}
          initialPreQuoteId={null}
          initialRows={rows}
          quotation={mockQuotation}
          referenceSuggestions={{}}
          suggestions={{}}
        />
      );
    });

    expect(container!.textContent).not.toContain("Toalhas De Papel Interfolhadas Limpmax");
    expect(container!.textContent).not.toContain("💡 Sugestões para este item");
    const usePriceButtons = Array.from(container!.querySelectorAll("button")).filter(
      (b) => b.textContent?.trim() === "Usar preço"
    );
    expect(usePriceButtons).toHaveLength(0);
  });

  it("mantém botão '🔎 Internet' funcionando para busca manual", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/search/best-price/batch") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ results: {} })
        });
      }
      if (url.startsWith("/api/search/best-price?")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            query: "Papel A4",
            provider: "mercadolivre",
            offers: [
              {
                provider: "mercadolivre",
                title: "Resma Papel Sulfite A4 Report 500 Fls",
                price: 26.5,
                currency: "BRL",
                url: "https://mercadolivre.com/resma-a4",
                thumbnail: null,
                seller: "Loja Oficial",
                condition: "new",
                available: 10
              }
            ],
            error: null
          })
        });
      }
      return Promise.reject(new Error("Unexpected url: " + url));
    });
    global.fetch = fetchMock;

    const rows: WorksheetRow[] = [
      makeRow({ itemOrder: 1, name: "Papel A4", unitCost: null })
    ];

    await act(async () => {
      root!.render(
        <PrequoteWorksheet
          catalogItems={mockCatalogItems}
          initialPreQuoteId={null}
          initialRows={rows}
          quotation={mockQuotation}
          referenceSuggestions={{}}
          suggestions={{}}
        />
      );
    });

    const searchInternetBtn = Array.from(container!.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Internet")
    );
    expect(searchInternetBtn).toBeDefined();

    await act(async () => {
      searchInternetBtn!.click();
    });

    expect(container!.textContent).toContain("Resultados da internet");
    expect(container!.textContent).toContain("Resma Papel Sulfite A4 Report 500 Fls");
    expect(container!.textContent).toContain(formatBRL(26.5));
  });
});

function makeRow(patch: Partial<WorksheetRow> = {}): WorksheetRow {
  return {
    itemOrder: 1,
    name: "Item Teste",
    description: "Descrição do item teste",
    unit: "UN",
    quantity: 1,
    referenceUnitValue: 10,
    supplierId: null,
    catalogItemId: null,
    unitCost: null,
    source: "none",
    webTitle: null,
    webPrice: null,
    webUrl: null,
    notes: null,
    ...patch
  };
}
