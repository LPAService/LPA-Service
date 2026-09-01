// @vitest-environment happy-dom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RelatoriosPage from "@/app/relatorios/page";
import { competitiveAnalytics, proposalLossAnalytics } from "@/lib/data/analytics";

const { mockSnapshot, mockLossSnapshot } = vi.hoisted(() => {
  return {
    mockSnapshot: {
      summary: {
        adjudicatedCount: 2,
        supplierCount: 2,
        unitPriceCount: 60,
        expenseGroupCount: 2
      },
      lossReasons: [
        {
          reason: "prazo_inviavel" as const,
          count: 12,
          pct: 41.3,
          medianGap: 0,
          explanation: "Prazo de envio no mesmo dia ou entrega em menos de 48h. Inviabilidade logística calculada."
        },
        {
          reason: "bloqueada" as const,
          count: 3,
          pct: 11.5,
          medianGap: null,
          explanation: "Cotações com instrução expressa de bloqueio, itens zerados ou regularização cadastral interna."
        },
        {
          reason: "incumbente" as const,
          count: 5,
          pct: 7.9,
          medianGap: null,
          explanation: "Escolas com líder cativo na base sincronizada."
        },
        {
          reason: "reserva_pnae" as const,
          count: 4,
          pct: 4.9,
          medianGap: null,
          explanation: "Gêneros alimentícios dominados por cooperativas e associações de agricultura familiar com proteção legal."
        },
        {
          reason: "preco" as const,
          count: 2,
          pct: 3.6,
          medianGap: 20.0,
          explanation: "Diferença direta de preço unitário calculada pela base."
        }
      ],
      winnerPlaybook: [
        {
          supplierName: "Fornecedor Real Um",
          supplierDocument: "34.128.941/0001-80",
          orders: 6,
          totalValue: 18452,
          schools: 3,
          expenseGroups: 2,
          topGroup: "Material de Consumo Geral",
          medianTicket: 2450,
          isCooperative: false
        },
        {
          supplierName: "Cooperativa Real Dois",
          supplierDocument: "02.441.892/0001-34",
          orders: 4,
          totalValue: 12840,
          schools: 2,
          expenseGroups: 1,
          topGroup: "Gêneros Alimentícios",
          medianTicket: 3867,
          isCooperative: true
        }
      ],
      priceBenchmark: [
        {
          product: "produto real homologado",
          unit: "PCT",
          samples: 30,
          supplierCount: 2,
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
          orders: 8,
          supplierCount: 4,
          leaderSharePct: 2.5,
          medianTicket: 3450,
          p25Ticket: 1800,
          p75Ticket: 6200,
          competitionLevel: "alta" as const
        },
        {
          expenseGroup: "Material de Consumo Geral",
          orders: 7,
          supplierCount: 3,
          leaderSharePct: 4.2,
          medianTicket: 2480,
          p25Ticket: 1200,
          p75Ticket: 4900,
          competitionLevel: "alta" as const
        },
        {
          expenseGroup: "Gêneros Alimentícios",
          orders: 6,
          supplierCount: 2,
          leaderSharePct: 14.7,
          medianTicket: 3850,
          p25Ticket: 1950,
          p75Ticket: 6700,
          competitionLevel: "baixa" as const
        }
      ],
      incumbencyMap: [
        {
          school: "E.E. REAL SINCRONIZADA",
          idSchool: 10284,
          city: "Belo Horizonte",
          leaderSupplier: "Fornecedor Real Um",
          leaderOrders: 4,
          totalOrders: 5,
          leaderSharePct: 80
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
    },
    mockLossSnapshot: {
      losses: [
        {
          orderId: "2026169900",
          idSubprogram: 548,
          idSchool: 8043,
          idBudget: 340615,
          schoolName: "EE NILO MAURICIO TRINDADE FIGUEIREDO",
          countyName: "Belo Horizonte",
          expenseGroup: "Material de Consumo Geral",
          proposalDeadline: new Date("2026-08-11T14:39:42.000Z"),
          ourSupplierId: 111892,
          ourTotal: 2260.4,
          winnerSupplierId: 42153,
          winnerName: "LMG TECHNOLOGY",
          winnerTotal: 2096.6,
          competitorCount: 9,
          ourRank: 6,
          estimatedValue: 2500,
          lossGapPercent: 7.8
        },
        {
          orderId: "2026165221",
          idSubprogram: 548,
          idSchool: 8043,
          idBudget: 340615,
          schoolName: "EE SANDOVAL SOARES DE AZEVEDO",
          countyName: "Ibirité",
          expenseGroup: "Gêneros Alimentícios",
          proposalDeadline: new Date("2026-08-11T14:39:42.000Z"),
          ourSupplierId: 111892,
          ourTotal: 4112.0,
          winnerSupplierId: 42153,
          winnerName: "ECOHORTI",
          winnerTotal: 3168.0,
          competitorCount: 2,
          ourRank: 2,
          estimatedValue: 4000,
          lossGapPercent: 29.8
        },
        {
          orderId: "2026162267",
          idSubprogram: 702,
          idSchool: 11059,
          idBudget: 338718,
          schoolName: "EE IMPERATRIZ PIMENTA",
          countyName: "Ibirité",
          expenseGroup: "Material de Consumo Geral",
          proposalDeadline: new Date("2026-08-09T15:48:53.000Z"),
          ourSupplierId: 111892,
          ourTotal: 15443.07,
          winnerSupplierId: 46722,
          winnerName: "JLB PRODUTOS DE LIMPEZA",
          winnerTotal: 4680.46,
          competitorCount: 5,
          ourRank: 5,
          estimatedValue: 289,
          lossGapPercent: 229.9
        }
      ],
      lossesByGroup: [
        {
          expenseGroup: "Gêneros Alimentícios",
          lossCount: 8,
          medianPriceGapPct: 29.8,
          medianPriceGapAmount: 1200.0
        },
        {
          expenseGroup: "Material de Consumo Geral",
          lossCount: 4,
          medianPriceGapPct: 39.5,
          medianPriceGapAmount: 1185.0
        }
      ],
      winningCompetitors: [
        {
          winnerSupplierId: 42153,
          winnerName: "S&S Comercial",
          wins: 3,
          knownWinnerTotalCount: 3,
          medianWinnerTotal: 2887.5
        },
        {
          winnerSupplierId: 46722,
          winnerName: "JLB PRODUTOS DE LIMPEZA",
          wins: 1,
          knownWinnerTotalCount: 1,
          medianWinnerTotal: 4680.46
        }
      ]
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

vi.mock("@/components/notification-bell", () => ({
  NotificationBell: () => React.createElement("span", null, "Notificações")
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => React.createElement("button", { type: "button" }, "Tema")
}));

vi.mock("@/lib/data/analytics", () => ({
  competitiveAnalytics: {
    getSummary: vi.fn().mockResolvedValue(mockSnapshot.summary),
    getLossReasons: vi.fn().mockResolvedValue(mockSnapshot.lossReasons),
    getWinnerPlaybook: vi.fn().mockResolvedValue(mockSnapshot.winnerPlaybook),
    getPriceBenchmark: vi.fn().mockResolvedValue(mockSnapshot.priceBenchmark),
    getCategoryCompetition: vi.fn().mockResolvedValue(mockSnapshot.categoryCompetition),
    getIncumbencyMap: vi.fn().mockResolvedValue(mockSnapshot.incumbencyMap),
    getWinnerDiscount: vi.fn().mockResolvedValue(mockSnapshot.winnerDiscount)
  },
  proposalLossAnalytics: {
    listLosses: vi.fn().mockResolvedValue(mockLossSnapshot.losses),
    getLossesByExpenseGroup: vi.fn().mockResolvedValue(mockLossSnapshot.lossesByGroup),
    getWinningCompetitors: vi.fn().mockResolvedValue(mockLossSnapshot.winningCompetitors)
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

  it("renderiza a nova narrativa de inteligência competitiva e a seção Aprenda com as perdas", async () => {
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
    expect(text).toContain("2");
    expect(text).toContain("Fornecedores Mapeados");
    expect(text).toContain("2");
    expect(text).toContain("Preços Unitários Reais");
    expect(text).toContain("60");

    // Seção: Aprenda com as perdas
    expect(text).toContain("Aprenda com as perdas");
    expect(text).toContain("Raio-X de Propostas Perdidas");
    expect(text).toContain("100,0% Perdidas no Preço");
    expect(text).toContain("Fato Central da Auditoria");
    expect(text).toContain("100,0% no Preço");
    expect(text).toContain("+29,8%");
    expect(text).toContain("Erros de Precificação (> 100%)");
    expect(text).toContain("Disputas Diretas (1x1)");

    // Sub-análises: Grupos e Vencedores
    expect(text).toContain("Onde mais se perde (por grupo de despesa)");
    expect(text).toContain("Gêneros Alimentícios");
    expect(text).toContain("Quem mais vence contra nós");
    expect(text).toContain("S&S Comercial");

    // Guia diagnóstico e Tabela Detalhada
    expect(text).toContain("Disputas Comerciais (Diferença ≤ 100%)");
    expect(text).toContain("Distorções de Precificação (Diferença > 100%)");
    expect(text).toContain("Lista Detalhada das Perdas (Ordenada por Diferença)");
    expect(text).toContain("2026169900");
    expect(text).toContain("EE NILO MAURICIO TRINDADE FIGUEIREDO");
    expect(text).toContain("LMG TECHNOLOGY");
    expect(text).toContain("2026162267");
    expect(text).toContain("JLB PRODUTOS DE LIMPEZA");
    expect(text).toContain("+229,9%");
    expect(text).toContain("Erro de Precificação");
    expect(text).toContain("Disputa 1x1");

    // Seção 1: Por que você perde
    expect(text).toContain("Por que você perde");
    expect(text).toContain("Prazo de Entrega Inviável");
    expect(text).toContain("12");
    expect(text).toContain("41,3%");
    expect(text).toContain("Cotações com Bloqueio");
    expect(text).toContain("3");
    expect(text).toContain("Escolas com Fornecedor Cativo");
    expect(text).toContain("Diferença de Preço Unitário");

    // Seção 2: Como os vencedores ganham (Playbook)
    expect(text).toContain("Como os vencedores ganham");
    expect(text).toContain("Fornecedor Real Um");
    expect(text).toContain("Cooperativa Real Dois");
    expect(text).toContain("Cooperativa PNAE");

    // Seção 3: Preço que o vencedor cobrou (Benchmark)
    expect(text).toContain("Preço que o vencedor cobrou");
    expect(text).toContain("produto real homologado");
    expect(text).toContain("Caneta Esferográfica Azul");
    expect(text).toContain("items.unit_value");
    expect(text).not.toContain("100% de Cobertura");

    // Seção 4: Onde vale a pena disputar
    expect(text).toContain("Onde vale a pena disputar");
    expect(text).toContain("Conservação e Pequenos Reparos");
    expect(text).toContain("Gêneros Alimentícios");
    expect(text).toContain("Pulverizado");

    // Seção 5: Escolas com dono
    expect(text).toContain("Escolas com dono");
    expect(text).toContain("E.E. REAL SINCRONIZADA");
    expect(text).toContain("80,0%");

    // Seção 6: Plano de ação para o fornecedor
    expect(text).toContain("Plano de ação para o fornecedor");
    expect(text).toContain("Diretrizes Comerciais Imediatas");
    expect(text).not.toContain("Para a Plataforma (Engenharia)");
  });

  it("renderiza proposta com winnerTotal nulo sem inventar números nem quebrar", async () => {
    vi.mocked(proposalLossAnalytics.listLosses).mockResolvedValue([
      {
        orderId: "2026171050",
        idSubprogram: 548,
        idSchool: 8043,
        idBudget: 340615,
        schoolName: "EE PROFESSOR CARLOS LUCIO DE ASSIS",
        countyName: "Betim",
        expenseGroup: "Material de Consumo Geral",
        proposalDeadline: new Date("2026-08-11T14:39:42.000Z"),
        ourSupplierId: 111892,
        ourTotal: 4185.0,
        winnerSupplierId: 999999,
        winnerName: null,
        winnerTotal: null,
        competitorCount: 14,
        ourRank: 5,
        estimatedValue: 3500,
        lossGapPercent: null
      }
    ]);
    vi.mocked(proposalLossAnalytics.getLossesByExpenseGroup).mockResolvedValue([
      {
        expenseGroup: "Material de Consumo Geral",
        lossCount: 1,
        medianPriceGapPct: null,
        medianPriceGapAmount: null
      }
    ]);
    vi.mocked(proposalLossAnalytics.getWinningCompetitors).mockResolvedValue([]);

    const pageComponent = await RelatoriosPage();
    render(pageComponent);

    const text = container!.textContent || "";
    expect(text).toContain("2026171050");
    expect(text).toContain("EE PROFESSOR CARLOS LUCIO DE ASSIS");
    expect(text).toContain("Valor do vencedor não informado");
    expect(text).not.toContain("NaN");
    expect(text).not.toContain("undefined");
  });

  it("renderiza estado vazio honesto sem dados fabricados quando analytics volta vazio", async () => {
    vi.mocked(competitiveAnalytics.getSummary).mockResolvedValue({
      adjudicatedCount: 0,
      supplierCount: 0,
      unitPriceCount: 0,
      expenseGroupCount: 0
    });
    vi.mocked(competitiveAnalytics.getLossReasons).mockResolvedValue([]);
    vi.mocked(competitiveAnalytics.getWinnerPlaybook).mockResolvedValue([]);
    vi.mocked(competitiveAnalytics.getPriceBenchmark).mockResolvedValue([]);
    vi.mocked(competitiveAnalytics.getCategoryCompetition).mockResolvedValue([]);
    vi.mocked(competitiveAnalytics.getIncumbencyMap).mockResolvedValue([]);
    vi.mocked(competitiveAnalytics.getWinnerDiscount).mockResolvedValue({
      pairs: 0,
      medianRatio: null,
      belowRefCount: 0,
      sanitizedPairs: 0,
      sanitizedMedianDiscountPct: null,
      byGroup: []
    });
    vi.mocked(proposalLossAnalytics.listLosses).mockResolvedValue([]);
    vi.mocked(proposalLossAnalytics.getLossesByExpenseGroup).mockResolvedValue([]);
    vi.mocked(proposalLossAnalytics.getWinningCompetitors).mockResolvedValue([]);

    const pageComponent = await RelatoriosPage();
    render(pageComponent);

    const text = container!.textContent || "";
    expect(text).toContain("Sem histórico adjudicado sincronizado nesta base.");
    expect(text).toContain("Esta análise depende da tabela `opportunities`");
    expect(text).toContain("Nenhuma proposta perdida registrada no banco até o momento.");
    expect(text).not.toContain("7.448");
    expect(text).not.toContain("Papel A4 Sulfite");
    expect(text).not.toContain("GUIMARAES ROSA");
  });

  function render(element: React.ReactNode) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(element));
  }
});
