// @vitest-environment happy-dom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RelatoriosPage from "@/app/relatorios/page";

const { mockSnapshot } = vi.hoisted(() => {
  return {
    mockSnapshot: {
      lossReasons: [
        {
          reason: "prazo_inviavel" as const,
          count: 7448,
          pct: 41.3,
          medianGap: 0,
          explanation: "Prazo de envio no mesmo dia ou entrega em menos de 48h. Inviabilidade logística calculada."
        },
        {
          reason: "bloqueada" as const,
          count: 2084,
          pct: 11.5,
          medianGap: null,
          explanation: "Cotações com instrução expressa de bloqueio, itens zerados ou regularização cadastral interna."
        },
        {
          reason: "incumbente" as const,
          count: 1420,
          pct: 7.9,
          medianGap: null,
          explanation: "96 escolas com líder cativo (>50% de participação). Barreira de entrada histórica na unidade."
        },
        {
          reason: "reserva_pnae" as const,
          count: 890,
          pct: 4.9,
          medianGap: null,
          explanation: "Gêneros alimentícios dominados por cooperativas e associações de agricultura familiar com proteção legal."
        },
        {
          reason: "preco" as const,
          count: 650,
          pct: 3.6,
          medianGap: 20.0,
          explanation: "Diferença direta de preço unitário. Mediana de deságio dos vencedores é de 20% abaixo da referência válida."
        }
      ],
      winnerPlaybook: [
        {
          supplierName: "REGINA THIELLE ALVES SILVA",
          supplierDocument: "34.128.941/0001-80",
          orders: 616,
          totalValue: 1845200,
          schools: 122,
          expenseGroups: 9,
          topGroup: "Material de Consumo Geral",
          medianTicket: 2450,
          isCooperative: false
        },
        {
          supplierName: "ASSOCIACAO DOS TRABALHADORES RURAIS DE BETIM",
          supplierDocument: "02.441.892/0001-34",
          orders: 332,
          totalValue: 1284000,
          schools: 48,
          expenseGroups: 1,
          topGroup: "Gêneros Alimentícios",
          medianTicket: 3867,
          isCooperative: true
        }
      ],
      priceBenchmark: [
        {
          product: "Papel A4 Sulfite 75g/m² Branco (Pacote 500 folhas)",
          unit: "PCT",
          samples: 412,
          supplierCount: 58,
          minPrice: 21.5,
          p25: 24.8,
          median: 26.9,
          p75: 29.4,
          maxPrice: 38.0,
          spreadRatio: 1.77
        },
        {
          product: "Caneta Esferográfica Azul 1.0mm (Caixa c/ 50 unidades)",
          unit: "CX",
          samples: 328,
          supplierCount: 46,
          minPrice: 32.0,
          p25: 36.5,
          median: 39.9,
          p75: 44.0,
          maxPrice: 55.0,
          spreadRatio: 1.72
        }
      ],
      categoryCompetition: [
        {
          expenseGroup: "Conservação e Pequenos Reparos",
          orders: 1420,
          supplierCount: 394,
          leaderSharePct: 2.5,
          medianTicket: 3450,
          p25Ticket: 1800,
          p75Ticket: 6200,
          competitionLevel: "alta" as const
        },
        {
          expenseGroup: "Material de Consumo Geral",
          orders: 3840,
          supplierCount: 345,
          leaderSharePct: 4.2,
          medianTicket: 2480,
          p25Ticket: 1200,
          p75Ticket: 4900,
          competitionLevel: "alta" as const
        },
        {
          expenseGroup: "Gêneros Alimentícios",
          orders: 4576,
          supplierCount: 248,
          leaderSharePct: 14.7,
          medianTicket: 3850,
          p25Ticket: 1950,
          p75Ticket: 6700,
          competitionLevel: "baixa" as const
        }
      ],
      incumbencyMap: [
        {
          school: "E.E. GUIMARAES ROSA",
          idSchool: 10284,
          city: "Belo Horizonte",
          leaderSupplier: "REGINA THIELLE ALVES SILVA",
          leaderOrders: 38,
          totalOrders: 42,
          leaderSharePct: 90.5
        }
      ],
      winnerDiscount: {
        pairs: 2777,
        medianRatio: 95.0,
        belowRefCount: 129,
        sanitizedPairs: 85,
        sanitizedMedianDiscountPct: 20.0,
        byGroup: []
      }
    }
  };
});

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

vi.mock("@/lib/data/analytics", () => ({
  competitiveAnalytics: {
    getLossReasons: vi.fn().mockResolvedValue(mockSnapshot.lossReasons),
    getWinnerPlaybook: vi.fn().mockResolvedValue(mockSnapshot.winnerPlaybook),
    getPriceBenchmark: vi.fn().mockResolvedValue(mockSnapshot.priceBenchmark),
    getCategoryCompetition: vi.fn().mockResolvedValue(mockSnapshot.categoryCompetition),
    getIncumbencyMap: vi.fn().mockResolvedValue(mockSnapshot.incumbencyMap),
    getWinnerDiscount: vi.fn().mockResolvedValue(mockSnapshot.winnerDiscount)
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

  it("renderiza a nova narrativa de inteligência competitiva e onde estão as vitórias", async () => {
    const pageComponent = await RelatoriosPage();
    render(pageComponent);

    const text = container!.textContent || "";

    // Novo título e subtítulo
    expect(text).toContain("Onde estão as vitórias");
    expect(text).toContain("Inteligência Competitiva");
    expect(text).not.toContain("Por que perdemos tantos lances?");
    expect(text).not.toContain("ZERO vitórias porque 84% dos processos expiram sem lance");
    expect(text).not.toContain("Conclusão Central da Auditoria");

    // KPIs de Topo
    expect(text).toContain("Compras Adjudicadas");
    expect(text).toContain("11.876");
    expect(text).toContain("Fornecedores Mapeados");
    expect(text).toContain("1.749");
    expect(text).toContain("Preços Unitários Reais");
    expect(text).toContain("68.038");

    // Seção 1: Por que você perde
    expect(text).toContain("Por que você perde");
    expect(text).toContain("Prazo de Entrega Inviável");
    expect(text).toContain("7.448");
    expect(text).toContain("41,3%");
    expect(text).toContain("Cotações com Bloqueio");
    expect(text).toContain("2.084");
    expect(text).toContain("Escolas com Fornecedor Cativo");
    expect(text).toContain("Diferença de Preço Unitário");

    // Seção 2: Como os vencedores ganham (Playbook)
    expect(text).toContain("Como os vencedores ganham");
    expect(text).toContain("REGINA THIELLE ALVES SILVA");
    expect(text).toContain("ASSOCIACAO DOS TRABALHADORES RURAIS DE BETIM");
    expect(text).toContain("Cooperativa PNAE");

    // Seção 3: Preço que o vencedor cobrou (Benchmark)
    expect(text).toContain("Preço que o vencedor cobrou");
    expect(text).toContain("Papel A4 Sulfite");
    expect(text).toContain("Caneta Esferográfica Azul");
    expect(text).toContain("items.unit_value");
    expect(text).toContain("100% de Cobertura");

    // Seção 4: Onde vale a pena disputar
    expect(text).toContain("Onde vale a pena disputar");
    expect(text).toContain("Conservação e Pequenos Reparos");
    expect(text).toContain("Gêneros Alimentícios");
    expect(text).toContain("Pulverizado");

    // Seção 5: Escolas com dono
    expect(text).toContain("Escolas com dono");
    expect(text).toContain("E.E. GUIMARAES ROSA");
    expect(text).toContain("90,5%");

    // Seção 6: Plano de ação para o fornecedor
    expect(text).toContain("Plano de ação para o fornecedor");
    expect(text).toContain("Diretrizes Comerciais Imediatas");
    expect(text).not.toContain("Para a Plataforma (Engenharia)");
  });

  it("renderiza corretamente badges e estado com snapshot auditado", async () => {
    const pageComponent = await RelatoriosPage();
    render(pageComponent);

    expect(container!.textContent).toContain("Auditoria Base SGD (20/08/2026)");
    expect(container!.textContent).toContain("20/08/2026");
  });

  function render(element: React.ReactNode) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(element));
  }
});
