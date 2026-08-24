// @vitest-environment happy-dom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RelatoriosPage from "@/app/relatorios/page";

vi.mock("@/lib/data/source", () => ({
  quotationSource: {
    listOpportunities: vi.fn().mockResolvedValue({
      total: 274,
      totalAvailable: 18046,
      data: [],
      page: 1,
      pageSize: 1,
      totalPages: 1,
      facets: { cities: [], categories: [], expenseGroups: [], schools: [] }
    })
  },
  opportunitySource: {
    listOpportunities: vi.fn().mockResolvedValue({
      total: 0,
      totalAvailable: 0,
      data: [],
      page: 1,
      pageSize: 1,
      totalPages: 0,
      facets: { cities: [], categories: [], expenseGroups: [], schools: [] }
    })
  }
}));

describe("RelatoriosPage", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
    vi.restoreAllMocks();
  });

  it("renderiza o funil de status com 0 vitórias e 84% de prazo encerrado e marcações de proveniência", async () => {
    const pageComponent = await RelatoriosPage();
    render(pageComponent);

    expect(container!.textContent).toContain("Por que perdemos tantos lances?");
    expect(container!.textContent).toContain("180.451");
    expect(container!.textContent).toContain("152.155");
    expect(container!.textContent).toContain("APRO");
    expect(container!.textContent).toContain("RECU");
    expect(container!.textContent).toContain("FORA");
    expect(container!.textContent).toContain("NAEN");
    expect(container!.textContent).toContain("Snapshot");
    expect(container!.textContent).toContain("20/08/2026");
    expect(container!.textContent).toContain("A Armadilha do Preço de Referência do SGD");
    expect(container!.textContent).toContain("100% de Cobertura");
    expect(container!.textContent).toContain("14,5% de Cobertura");
    expect(container!.textContent).toContain("95,8%");
    expect(container!.textContent).toContain("41,3% dos Prazos são Estruturalmente Impossíveis");
  });

  it("exibe aviso honesto de histórico em produção quando opportunities está vazio", async () => {
    const pageComponent = await RelatoriosPage();
    render(pageComponent);

    expect(container!.textContent).toContain("Status da base de homologados em produção");
  });

  function render(element: React.ReactNode) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(element));
  }
});
