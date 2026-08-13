// @vitest-environment happy-dom
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpportunityCard } from "@/components/opportunity-card";
import type { NormalizedOpportunity } from "@/lib/contracts/opportunity";

describe("OpportunityCard modal", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
    vi.restoreAllMocks();
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  });

  it("abre e fecha modal com itens carregados", async () => {
    mockFetch(detailOpportunity());
    render(React.createElement(OpportunityCard, { opportunity: listOpportunity() }));

    await act(async () => {
      card().click();
    });

    expect(dialog()).not.toBeNull();
    expect(fetch).toHaveBeenCalledWith("/api/quotations/quote-open-soon");
    expect(await text("Borracha branca")).toBeTruthy();
    expect(document.body.textContent).toMatch(/R\$\s*25,00/);
    expect(document.body.style.overflow).toBe("hidden");

    await act(async () => {
      button("Fechar detalhes").click();
    });

    expect(dialog()).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("renderiza itens longos em blocos sem tabela e remove preço repetido da descrição exibida", async () => {
    mockFetch({
      ...detailOpportunity(),
      items: [
        {
          order: 1,
          name: "CARNE BOVINA ACÉM OU PATINHO",
          description:
            "CARNE BOVINA ACÉM OU PATINHO, de primeira qualidade, sem cartilagens e materiais estranhos, com cor, odor e sabor. Acondicionada em embalagem sem furos, rasgos ou vazamentos. Entrega de acordo com a demanda da escola. Preço de referência R$40,26",
          unit: "KG",
          quantity: 600,
          unitValue: 40.26,
          totalValue: null,
          isPermanent: false,
          expenseCategory: ""
        }
      ],
      itemCount: 1
    });
    render(React.createElement(OpportunityCard, { opportunity: listOpportunity() }));

    await act(async () => {
      card().click();
    });

    expect(await text("CARNE BOVINA ACÉM OU PATINHO")).toBeTruthy();
    expect(document.querySelector("table")).toBeNull();
    expect(document.body.textContent).toContain("sem cartilagens e materiais estranhos");
    expect(document.body.textContent).toContain("Entrega de acordo com a demanda da escola.");
    expect(document.body.textContent).not.toContain("Preço de referência R$40,26");
    expect(document.body.textContent).toContain("Preço unitário");
    expect(document.body.textContent).toMatch(/R\$\s*40,26/);
    expect(document.body.textContent).toMatch(/R\$\s*24\.156,00/);
  });

  it("usa externalId real no caminho card para modal, não número do orçamento", async () => {
    mockFetch(detailOpportunity());
    render(React.createElement(OpportunityCard, { opportunity: { ...listOpportunity(), externalId: "638-8380-342859", orderId: "2026166282" } }));

    await act(async () => {
      card().click();
    });

    expect(fetch).toHaveBeenCalledWith("/api/quotations/638-8380-342859");
    expect(await text("Borracha branca")).toBeTruthy();
  });

  it("diferencia 404 de falha de rede no modal", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Cotação não encontrada" }), { status: 404, headers: { "content-type": "application/json" } })));
    render(React.createElement(OpportunityCard, { opportunity: listOpportunity() }));

    await act(async () => {
      card().click();
    });

    expect(await text("Cotação não encontrada. Verifique o identificador interno.")).toBeTruthy();
    expect(errorSpy).toHaveBeenCalledWith("Falha ao carregar cotação", { externalId: "quote-open-soon", orderId: "2026166001", status: 404 });
  });

  it("Esc fecha modal", async () => {
    mockFetch(detailOpportunity());
    render(React.createElement(OpportunityCard, { opportunity: listOpportunity() }));

    await act(async () => {
      card().click();
    });
    await text("Borracha branca");

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(dialog()).toBeNull();
  });

  it("clique no botão de proposta não abre modal", async () => {
    mockFetch(detailOpportunity());
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    vi.spyOn(window, "open").mockImplementation(() => null);
    render(React.createElement(OpportunityCard, { opportunity: listOpportunity() }));

    await act(async () => {
      button("Enviar proposta").click();
    });

    expect(dialog()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith("2026166001");
  });

  it("não oferece proposta quando cotação está bloqueada pela escola", async () => {
    const blocked = {
      ...detailOpportunity(),
      canSubmitProposal: false,
      proposalBlocked: true,
      proposalBlockedReason: "PROCESSO DE REGULARIZAÇÃO NO SISTEMA, NÃO ENVIAR PROPOSTA.",
      proposalBlockedItemCount: 1,
      itemCount: 2
    };
    mockFetch(blocked);
    render(React.createElement(OpportunityCard, { opportunity: { ...blocked, items: [] } }));

    expect(document.body.textContent).not.toContain("Enviar proposta");
    expect(document.body.textContent).toContain("A escola indicou que não é para enviar proposta (1 de 2 itens marcados).");

    await act(async () => {
      card().click();
    });
    await text("Trecho original:");

    expect(document.body.textContent).toContain("PROCESSO DE REGULARIZAÇÃO NO SISTEMA, NÃO ENVIAR PROPOSTA.");
    expect(document.body.textContent).not.toContain("Enviar proposta");
  });

  function render(element: React.ReactNode) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(element));
  }

  function card() {
    return container!.querySelector<HTMLElement>("article")!;
  }

  function dialog() {
    return document.querySelector('[role="dialog"]');
  }

  function button(name: string) {
    const match = Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.includes(name) || item.getAttribute("aria-label") === name);
    if (!match) throw new Error(`Botão não encontrado: ${name}`);
    return match as HTMLButtonElement;
  }

  async function text(value: string) {
    for (let index = 0; index < 5; index += 1) {
      const found = document.body.textContent?.includes(value);
      if (found) return true;
      await act(async () => {
        await Promise.resolve();
      });
    }
    return false;
  }
});

function mockFetch(quotation: NormalizedOpportunity) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ quotation }), { headers: { "content-type": "application/json" } })));
}

function listOpportunity(): NormalizedOpportunity {
  return {
    ...detailOpportunity(),
    items: [],
    itemCount: 2,
    totalValue: 25,
    isTotalValuePartial: true
  };
}

function detailOpportunity(): NormalizedOpportunity {
  return {
    kind: "quotation",
    externalId: "quote-open-soon",
    orderId: "2026166001",
    sourceUrl: "https://example.test/quote-open-soon",
    proposalUrl: "https://example.test/quote-open-soon",
    canSubmitProposal: true,
    idSubprogram: 12,
    idSchool: 34,
    idBudget: 6001,
    idSupplier: null,
    school: "EE Teste",
    city: "Ibirité",
    regional: null,
    expenseGroup: "Material de Consumo",
    subprogram: "Não informado",
    year: "",
    purchaseDate: null,
    proposalDate: new Date(Date.now() + 86_400_000).toISOString(),
    proposalDeadline: new Date(Date.now() + 86_400_000).toISOString(),
    deliveryDate: new Date(Date.now() + 864_000_000).toISOString(),
    purchaseOrderStatus: "ENVI",
    accountabilityStatus: null,
    supplierName: null,
    supplierDocument: null,
    initiativeDescription: null,
    items: [
      {
        order: 1,
        name: "Borracha",
        description: "Borracha branca",
        unit: "UN",
        quantity: 5,
        unitValue: 5,
        totalValue: 25,
        isPermanent: false,
        expenseCategory: ""
      },
      {
        order: 2,
        name: "Apontador",
        description: "Apontador simples",
        unit: "UN",
        quantity: 1,
        unitValue: null,
        totalValue: null,
        isPermanent: false,
        expenseCategory: ""
      }
    ],
    attachments: [],
    totalValue: 25,
    isTotalValuePartial: true,
    itemCount: 2,
    category: { slug: "material", name: "Material escolar", confidence: null, needsFallback: null },
    headline: "Compra aberta próxima",
    summary: "Materiais para escola.",
    topItems: ["Borracha", "Apontador"],
    rawJson: { source: "test" },
    statusLabel: "Aberta"
  };
}
