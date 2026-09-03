// @vitest-environment happy-dom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RelatoriosPage, {
  CategoryAuditSection,
  CATEGORY_AUDIT_DATA,
  type CategoryAuditData
} from "@/app/relatorios/page";

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
    getSummary: vi.fn().mockResolvedValue({
      adjudicatedCount: 10,
      supplierCount: 5,
      unitPriceCount: 100,
      expenseGroupCount: 4
    }),
    getLossReasons: vi.fn().mockResolvedValue([]),
    getWinnerPlaybook: vi.fn().mockResolvedValue([]),
    getPriceBenchmark: vi.fn().mockResolvedValue([]),
    getCategoryCompetition: vi.fn().mockResolvedValue([]),
    getIncumbencyMap: vi.fn().mockResolvedValue([]),
    getWinnerDiscount: vi.fn().mockResolvedValue(null)
  },
  proposalLossAnalytics: {
    listLosses: vi.fn().mockResolvedValue([]),
    getLossesByExpenseGroup: vi.fn().mockResolvedValue([]),
    getWinningCompetitors: vi.fn().mockResolvedValue([])
  }
}));

describe("CategoryAuditSection & RelatoriosPage", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
    vi.restoreAllMocks();
  });

  function render(element: React.ReactNode) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(element));
  }

  it("renderiza a seção Auditoria de Categorias na página de Relatórios com dados reais do JSON", async () => {
    const pageComponent = await RelatoriosPage();
    render(pageComponent);

    const text = container!.textContent || "";

    // Cabeçalho e método
    expect(text).toContain("Auditoria de Categorias");
    expect(text).toContain("Qualidade do Catálogo & Integridade Semântica");
    expect(text).toContain("Jaccard top-30 + atribuição de tokens por lift (≥2x sobre-representação)");
    expect(text).toContain("02/09/2026");

    // Fato Central e KPIs
    expect(text).toContain("8 de 9 Poluídas");
    expect(text).toContain("frutas-e-verduras");
    expect(text).toContain("34,0%");
    expect(text).toContain("68.038 itens");

    // Distinção especial: não-perecíveis
    expect(text).toContain("Distinção Especial: Não-Perecíveis");
    expect(text).toContain("Poluição Semântica 16% + Ruído 9%");
    expect(text).toContain("1. Poluição Semântica: 16%");
    expect(text).toContain("2. Ruído de Cadastro: 9,0% (Catch-all)");
    expect(text).toContain("1.510 itens");

    // Achado inesperado: alimentos vs projetos pedagógicos
    expect(text).toContain("Achado Inesperado: Alimentos & Projetos Pedagógicos");
    expect(text).toContain("Convenção do Portal (26%)");
    expect(text).toContain("projetos-pedagogicos");
    expect(text).toContain("Padrão Administrativo, Não Erro do Classificador");

    // Tabela de categorias e ordenação
    expect(text).toContain("informatica");
    expect(text).toContain("alimentos");
    expect(text).toContain("lacticinios");
    expect(text).toContain("congelados");
    expect(text).toContain("nao-pereciveis");
    expect(text).toContain("moveis");
    expect(text).toContain("panificacao");
    expect(text).toContain("eletronicos");
    expect(text).toContain("frutas-e-verduras");

    // Destaque da categoria limpa
    expect(text).toContain("🟢 LIMPA (Vitória da Casa)");
    expect(text).toContain("100% Íntegra");

    // Evidências e amostras reais
    expect(text).toContain("3 tokens com lift>=2 pertencem a 'servicos'");
    expect(text).toContain("Sirene escolar eletrônica");
    expect(text).toContain("Batata inglesa");

    // Footer
    expect(text).toContain("Diagnóstico gerado em 02/09/2026 via cluster de auditoria analítica GPU");
    expect(text).toContain("rodar auditoria novamente no pipeline");
  });

  it("renderiza quando uma categoria tem poluida: false com badge de vitória e destaque", () => {
    const singleCleanData: CategoryAuditData = {
      metodo: "Jaccard top-30",
      data_auditoria: "02/09/2026",
      total_itens_globais: 1904,
      categorias_auditadas: ["frutas-e-verduras"],
      nao_pereciveis_ruido_cadastro: {
        total: 0,
        nomes_curtos_lt6: 0,
        pct_nomes_curtos: 0,
        descricao_vazia: 0,
        pct_descricao_vazia: 0
      },
      resultados: [
        {
          slug: "frutas-e-verduras",
          total_itens: 1904,
          poluida: false,
          poluicao_pct_estimado: 0,
          categoria_origem_poluidora: null,
          evidencia: "0 tokens estrangeiros com lift>=2 identificados como invasores",
          amostras_fora: []
        }
      ]
    };

    render(React.createElement(CategoryAuditSection, { auditData: singleCleanData }));

    const text = container!.textContent || "";
    expect(text).toContain("frutas-e-verduras");
    expect(text).toContain("0 de 1 Poluídas");
    expect(text).toContain("🟢 LIMPA (Vitória da Casa)");
    expect(text).toContain("100% Íntegra");
    expect(text).toContain("— (Sem poluição detectada)");
    expect(text).toContain("Nenhum item fora do padrão");
  });

  it("renderiza corretamente quando há apenas a categoria limpa e nenhuma poluída", () => {
    const onlyCleanCategoriesData: CategoryAuditData = {
      metodo: "Jaccard top-30",
      data_auditoria: "02/09/2026",
      total_itens_globais: 5000,
      categorias_auditadas: ["frutas-e-verduras", "hortifruti"],
      nao_pereciveis_ruido_cadastro: {
        total: 0,
        nomes_curtos_lt6: 0,
        pct_nomes_curtos: 0,
        descricao_vazia: 0,
        pct_descricao_vazia: 0
      },
      resultados: [
        {
          slug: "frutas-e-verduras",
          total_itens: 3000,
          poluida: false,
          poluicao_pct_estimado: 0,
          categoria_origem_poluidora: null,
          evidencia: "Vocabulário 100% isolado",
          amostras_fora: []
        },
        {
          slug: "hortifruti",
          total_itens: 2000,
          poluida: false,
          poluicao_pct_estimado: 0,
          categoria_origem_poluidora: null,
          evidencia: "Vocabulário 100% isolado",
          amostras_fora: []
        }
      ]
    };

    render(React.createElement(CategoryAuditSection, { auditData: onlyCleanCategoriesData }));

    const text = container!.textContent || "";
    expect(text).toContain("0 de 2 Poluídas");
    expect(text).toContain("frutas-e-verduras, hortifruti");
    expect(text).toContain("5.000");
    expect(text).toContain("🟢 LIMPA (Vitória da Casa)");
    expect(text).not.toContain("100% Íntegra— (Sem poluição detectada)Vocabulário 100% isoladoPoluída");
  });
});
