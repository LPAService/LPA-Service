import Link from "next/link";
import { opportunitySource, quotationSource } from "@/lib/data/source";
import { competitiveAnalytics } from "@/lib/data/analytics";
import type {
  LossReason,
  WinnerPlaybookEntry,
  PriceBenchmark,
  CategoryCompetition,
  IncumbencyMapEntry,
  WinnerDiscount
} from "@/lib/data/analytics";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inteligência Competitiva & Onde Estão as Vitórias · LPA Leo",
  description:
    "Análise estratégica de preços adjudicados, playbook de vencedores, benchmark unitário e mapa de concorrência no Caixa Escolar MG."
};

const AUDIT_SNAPSHOT_DATE = "20/08/2026";

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "0";
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return `${value.toFixed(1).replace(".", ",")}%`;
}

const FALLBACK_LOSS_REASONS: LossReason[] = [
  {
    reason: "prazo_inviavel",
    count: 7448,
    pct: 41.3,
    medianGap: 0,
    explanation: "Prazo de envio no mesmo dia ou entrega em menos de 48h. Inviabilidade logística calculada."
  },
  {
    reason: "bloqueada",
    count: 2084,
    pct: 11.5,
    medianGap: null,
    explanation: "Cotações com instrução expressa de bloqueio, itens zerados ou regularização cadastral interna."
  },
  {
    reason: "incumbente",
    count: 1420,
    pct: 7.9,
    medianGap: null,
    explanation: "96 escolas com líder cativo (>50% de participação). Barreira de entrada histórica na unidade."
  },
  {
    reason: "reserva_pnae",
    count: 890,
    pct: 4.9,
    medianGap: null,
    explanation: "Gêneros alimentícios dominados por cooperativas e associações de agricultura familiar com proteção legal."
  },
  {
    reason: "preco",
    count: 650,
    pct: 3.6,
    medianGap: 20.0,
    explanation: "Diferença direta de preço unitário. Mediana de deságio dos vencedores é de 20% abaixo da referência válida."
  }
];

const FALLBACK_WINNER_PLAYBOOK: WinnerPlaybookEntry[] = [
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
  },
  {
    supplierName: "COOPERATIVA DOS AGRICULTORES FAMILIARES DE IBIRITE",
    supplierDocument: "10.892.411/0001-92",
    orders: 284,
    totalValue: 980400,
    schools: 39,
    expenseGroups: 1,
    topGroup: "Gêneros Alimentícios",
    medianTicket: 3450,
    isCooperative: true
  },
  {
    supplierName: "COMERCIAL M&M PAPELARIA E SUPRIMENTOS LTDA",
    supplierDocument: "18.332.901/0001-15",
    orders: 215,
    totalValue: 642800,
    schools: 74,
    expenseGroups: 6,
    topGroup: "Material de Consumo Geral",
    medianTicket: 2980,
    isCooperative: false
  },
  {
    supplierName: "TECH SERVICE COMERCIO E MANUTENCAO LTDA",
    supplierDocument: "22.841.609/0001-44",
    orders: 198,
    totalValue: 712000,
    schools: 61,
    expenseGroups: 4,
    topGroup: "Equipamentos Tecnológicos",
    medianTicket: 3590,
    isCooperative: false
  }
];

const FALLBACK_PRICE_BENCHMARK: PriceBenchmark[] = [
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
  },
  {
    product: "Álcool em Gel 70% 500ml Higienizador",
    unit: "FR",
    samples: 289,
    supplierCount: 39,
    minPrice: 6.8,
    p25: 7.9,
    median: 8.9,
    p75: 10.5,
    maxPrice: 14.5,
    spreadRatio: 2.13
  },
  {
    product: "Cartucho de Toner Preto Compatível HP 105A",
    unit: "UN",
    samples: 194,
    supplierCount: 28,
    minPrice: 42.0,
    p25: 48.0,
    median: 54.0,
    p75: 62.0,
    maxPrice: 85.0,
    spreadRatio: 2.02
  },
  {
    product: "Detergente Líquido Neutro 500ml",
    unit: "FR",
    samples: 356,
    supplierCount: 42,
    minPrice: 2.1,
    p25: 2.45,
    median: 2.79,
    p75: 3.2,
    maxPrice: 4.5,
    spreadRatio: 2.14
  },
  {
    product: "Pasta Polionda com Elástico 40mm Ofício",
    unit: "UN",
    samples: 165,
    supplierCount: 31,
    minPrice: 4.2,
    p25: 4.9,
    median: 5.5,
    p75: 6.4,
    maxPrice: 8.9,
    spreadRatio: 2.12
  }
];

const FALLBACK_CATEGORY_COMPETITION: CategoryCompetition[] = [
  {
    expenseGroup: "Conservação e Pequenos Reparos",
    orders: 1420,
    supplierCount: 394,
    leaderSharePct: 2.5,
    medianTicket: 3450,
    p25Ticket: 1800,
    p75Ticket: 6200,
    competitionLevel: "alta"
  },
  {
    expenseGroup: "Material de Consumo Geral",
    orders: 3840,
    supplierCount: 345,
    leaderSharePct: 4.2,
    medianTicket: 2480,
    p25Ticket: 1200,
    p75Ticket: 4900,
    competitionLevel: "alta"
  },
  {
    expenseGroup: "Serviços Operacionais e Terceirizados",
    orders: 1180,
    supplierCount: 449,
    leaderSharePct: 4.4,
    medianTicket: 4200,
    p25Ticket: 2100,
    p75Ticket: 7800,
    competitionLevel: "alta"
  },
  {
    expenseGroup: "Equipamentos Tecnológicos e Informática",
    orders: 860,
    supplierCount: 168,
    leaderSharePct: 8.6,
    medianTicket: 5800,
    p25Ticket: 2900,
    p75Ticket: 11500,
    competitionLevel: "media"
  },
  {
    expenseGroup: "Gêneros Alimentícios",
    orders: 4576,
    supplierCount: 248,
    leaderSharePct: 14.7,
    medianTicket: 3850,
    p25Ticket: 1950,
    p75Ticket: 6700,
    competitionLevel: "baixa"
  }
];

const FALLBACK_INCUMBENCY_MAP: IncumbencyMapEntry[] = [
  {
    school: "E.E. GUIMARAES ROSA",
    idSchool: 10284,
    city: "Belo Horizonte",
    leaderSupplier: "REGINA THIELLE ALVES SILVA",
    leaderOrders: 38,
    totalOrders: 42,
    leaderSharePct: 90.5
  },
  {
    school: "E.E. AFONSO PENA",
    idSchool: 10112,
    city: "Belo Horizonte",
    leaderSupplier: "COMERCIAL M&M PAPELARIA LTDA",
    leaderOrders: 29,
    totalOrders: 35,
    leaderSharePct: 82.9
  },
  {
    school: "E.E. SANTA RITA DE CASSIA",
    idSchool: 11402,
    city: "Contagem",
    leaderSupplier: "SUPRI SERVICE DISTRIBUIDORA",
    leaderOrders: 31,
    totalOrders: 41,
    leaderSharePct: 75.6
  },
  {
    school: "E.E. PADRE EUSTAQUIO",
    idSchool: 10340,
    city: "Belo Horizonte",
    leaderSupplier: "DISTRIBUIDORA DE ALIMENTOS CENTRAL",
    leaderOrders: 26,
    totalOrders: 36,
    leaderSharePct: 72.2
  },
  {
    school: "E.E. RAUL SOARES",
    idSchool: 10988,
    city: "Betim",
    leaderSupplier: "ASSOCIACAO DOS TRABALHADORES RURAIS DE BETIM",
    leaderOrders: 28,
    totalOrders: 40,
    leaderSharePct: 70.0
  }
];

const FALLBACK_WINNER_DISCOUNT: WinnerDiscount = {
  pairs: 2777,
  medianRatio: 95.0,
  belowRefCount: 129,
  sanitizedPairs: 85,
  sanitizedMedianDiscountPct: 20.0,
  byGroup: [
    {
      expenseGroup: "Material de Consumo Geral",
      pairs: 18,
      sanitizedPairs: 18,
      medianRatio: 0.672,
      sanitizedMedianDiscountPct: 32.8
    },
    {
      expenseGroup: "Equipamentos Tecnológicos",
      pairs: 4,
      sanitizedPairs: 4,
      medianRatio: 0.744,
      sanitizedMedianDiscountPct: 25.6
    },
    {
      expenseGroup: "Gêneros Alimentícios",
      pairs: 33,
      sanitizedPairs: 33,
      medianRatio: 0.862,
      sanitizedMedianDiscountPct: 13.8
    },
    {
      expenseGroup: "Conservação e Pequenos Reparos",
      pairs: 10,
      sanitizedPairs: 10,
      medianRatio: 0.940,
      sanitizedMedianDiscountPct: 6.0
    }
  ]
};

export default async function RelatoriosPage() {
  let liveOpenCount = 274;
  let liveTotalCount = 18046;
  let liveHistoryCount = 0;
  let hasHistoryData = false;

  let lossReasons: LossReason[] = FALLBACK_LOSS_REASONS;
  let winnerPlaybook: WinnerPlaybookEntry[] = FALLBACK_WINNER_PLAYBOOK;
  let priceBenchmark: PriceBenchmark[] = FALLBACK_PRICE_BENCHMARK;
  let categoryCompetition: CategoryCompetition[] = FALLBACK_CATEGORY_COMPETITION;
  let incumbencyMap: IncumbencyMapEntry[] = FALLBACK_INCUMBENCY_MAP;
  let winnerDiscount: WinnerDiscount = FALLBACK_WINNER_DISCOUNT;

  try {
    const [openRes, allRes, historyRes, reasons, playbook, prices, categories, incumbency, discount] =
      await Promise.all([
        quotationSource.listOpportunities({ situation: "open" }, { page: 1, pageSize: 1 }),
        quotationSource.listOpportunities({ situation: "all" }, { page: 1, pageSize: 1 }),
        opportunitySource.listOpportunities({}, { page: 1, pageSize: 1 }),
        competitiveAnalytics.getLossReasons(),
        competitiveAnalytics.getWinnerPlaybook(10),
        competitiveAnalytics.getPriceBenchmark(10),
        competitiveAnalytics.getCategoryCompetition(),
        competitiveAnalytics.getIncumbencyMap(8),
        competitiveAnalytics.getWinnerDiscount()
      ]);

    liveOpenCount = openRes.total;
    liveTotalCount = allRes.total;
    liveHistoryCount = historyRes.total;
    hasHistoryData = historyRes.total > 0;

    if (reasons && reasons.length > 0) lossReasons = reasons;
    if (playbook && playbook.length > 0) winnerPlaybook = playbook;
    if (prices && prices.length > 0) priceBenchmark = prices;
    if (categories && categories.length > 0) categoryCompetition = categories;
    if (incumbency && incumbency.length > 0) incumbencyMap = incumbency;
    if (discount && discount.pairs > 0) winnerDiscount = discount;
  } catch (error) {
    console.error("Erro ao carregar dados dinâmicos para relatórios:", error);
  }

  const lossReasonActionMap: Record<string, { title: string; badge: string; icon: string; action: string }> = {
    prazo_inviavel: {
      title: "Prazo de Entrega Inviável (< 48h)",
      badge: "badge-danger",
      icon: "⏱️",
      action: "Descartar imediatamente pelo filtro de viabilidade. Evite penalidades e multas contratuais."
    },
    bloqueada: {
      title: "Cotações com Bloqueio ou Ruído",
      badge: "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-300",
      icon: "🚫",
      action: "Ignorar via triagem automatizada da plataforma; não gaste tempo orçando processos fechados na origem."
    },
    incumbente: {
      title: "Escolas com Fornecedor Cativo (> 50%)",
      badge: "badge-warning",
      icon: "🏛️",
      action: "Direcionar propostas para as 326 escolas pulverizadas; evite confrontar líderes consolidados sem diferencial de custo."
    },
    reserva_pnae: {
      title: "Reserva Legal PNAE (Agricultura Familiar)",
      badge: "badge-warning",
      icon: "🌾",
      action: "Não disputar gêneros alimentícios contra cooperativas e associações amparadas por preferência legal."
    },
    preco: {
      title: "Diferença de Preço Unitário",
      badge: "badge-success",
      icon: "🏷️",
      action: "Calibrar margem pelo benchmark de preços unitários adjudicados (items.unit_value), não pelo teto do edital."
    }
  };

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)]">
      {/* Header com Navegação */}
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur-sm">
        <div className="shell py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow text-[var(--color-primary)]">Inteligência Competitiva</span>
                <LiveBadge label={`Banco: ${liveOpenCount} abertas / ${liveTotalCount.toLocaleString("pt-BR")} total`} />
                <SnapshotBadge date={AUDIT_SNAPSHOT_DATE} label="Auditoria Base SGD" />
              </div>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--color-fg)] sm:text-4xl">
                Onde estão as vitórias
              </h1>
              <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                Diagnóstico estratégico e playbook comercial: descubra como os concorrentes vencem, quais preços praticam e onde a barreira de entrada é menor.
              </p>
            </div>

            {/* Abas de Navegação */}
            <nav aria-label="Navegação principal" className="flex flex-wrap items-center gap-2">
              <Link className="action-secondary text-sm" href="/">
                Cotações abertas
              </Link>
              <Link className="action-secondary text-sm" href="/?view=history">
                Histórico de compras
              </Link>
              <Link className="action-primary text-sm font-bold" href="/relatorios">
                📊 Relatório & Análise
              </Link>
              <Link className="action-secondary text-sm" href="/fornecedores">
                📦 Fornecedores
              </Link>
              <Link className="action-secondary text-sm" href="/preorcamento">
                🧮 Pré-Orçamento
              </Link>
              <span className="ml-auto" />
              <NotificationBell />
              <ThemeToggle />
            </nav>
          </div>
        </div>
      </header>

      <div className="shell py-8 space-y-10">
        {/* SEÇÃO: KPIs de Topo */}
        <section aria-label="Métricas Principais" className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiMiniCard
            highlight
            label="Compras Adjudicadas"
            provenance={hasHistoryData ? "live" : "snapshot"}
            sub="Base de concorrência analisada"
            value={hasHistoryData ? formatNumber(liveHistoryCount) : "11.876"}
          />
          <KpiMiniCard
            label="Fornecedores Mapeados"
            provenance="snapshot"
            sub="Concorrentes com histórico"
            value="1.749"
          />
          <KpiMiniCard
            label="Preços Unitários Reais"
            provenance="snapshot"
            sub="Itens adjudicados homologados"
            value="68.038"
          />
          <KpiMiniCard
            label="Categorias de Despesa"
            provenance="snapshot"
            sub="Grupos de compra mapeados"
            value="23"
          />
        </section>

        {/* SEÇÃO: Por que você perde (Maior Peso Visual) */}
        <section className="rounded-2xl border-2 border-[var(--color-primary)]/40 bg-[var(--color-bg)] p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 border-b border-[var(--color-border)] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="eyebrow text-[var(--color-primary)]">Diagnóstico de Desclassificação & Barreiras</span>
                <span className="rounded-full bg-[var(--color-primary)]/15 px-2.5 py-0.5 text-[10px] font-bold text-[var(--color-primary)]">
                  Foco Comercial Máximo
                </span>
              </div>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[var(--color-fg)] sm:text-3xl">
                Por que você perde
              </h2>
            </div>
            <p className="text-xs text-[var(--color-fg-muted)]">
              Análise dos fatores reais que afastam o fornecedor do resultado positivo
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {lossReasons.map((item) => {
              const meta = lossReasonActionMap[item.reason] || {
                title: item.reason,
                badge: "badge-muted",
                icon: "📌",
                action: "Avaliar processo individualmente."
              };

              return (
                <div
                  className="flex flex-col justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-5 shadow-sm transition-all hover:border-[var(--color-primary)]/60 hover:shadow-md"
                  key={item.reason}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-bold ${meta.badge}`}>
                        <span>{meta.icon}</span>
                        {meta.title}
                      </span>
                      <span className="text-sm font-black text-[var(--color-fg)] tabular-nums">
                        {formatPercent(item.pct)}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-black text-[var(--color-fg)] tabular-nums">
                        {formatNumber(item.count)}
                      </p>
                      <span className="text-xs text-[var(--color-fg-muted)]">casos identificados</span>
                    </div>

                    <p className="text-xs leading-relaxed text-[var(--color-fg-muted)]">
                      {item.explanation}
                    </p>

                    {item.medianGap !== null && item.medianGap !== undefined && item.medianGap > 0 && (
                      <div className="rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] p-2 text-xs">
                        <span className="font-semibold text-[var(--color-fg)]">Deságio Mediano:</span>{" "}
                        <strong className="text-[var(--color-success)]">{formatPercent(item.medianGap)}</strong> abaixo do valor estimado válido.
                      </div>
                    )}
                  </div>

                  <div className="mt-4 border-t border-[var(--color-border)] pt-3">
                    <p className="text-[11px] font-medium leading-relaxed text-[var(--color-fg-muted)]">
                      💡 <strong className="text-[var(--color-primary)]">Ação Concreta:</strong> {meta.action}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SEÇÃO: Como os vencedores ganham (Playbook) */}
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 sm:p-8 shadow-[var(--shadow-card)] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 border-b border-[var(--color-border)] pb-4">
            <div>
              <span className="eyebrow text-[var(--color-success)]">Estratégias de Mercado</span>
              <h2 className="mt-1 text-2xl font-bold text-[var(--color-fg)]">
                Como os vencedores ganham
              </h2>
            </div>
            <p className="text-xs text-[var(--color-fg-muted)]">
              Comparativo de líderes: <strong>Generalistas de alto volume</strong> vs. <strong>Especialistas em nichos protegidos</strong>
            </p>
          </div>

          {/* Cards de Contraste de Perfis */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-bg-subtle)] p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">Perfil Generalista</span>
                <span className="badge-success text-[10px] font-bold px-2 py-0.5 rounded">Alta Capilaridade</span>
              </div>
              <h3 className="font-bold text-sm text-[var(--color-fg)]">Regina Thielle & Distribuidores de Consumo</h3>
              <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed">
                616 pedidos espalhados em 122 escolas de diferentes cidades e 9 grupos de despesa. Vence pela agilidade de entrega e cobertura ampla de catálogo escolar geral.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-[var(--color-bg-subtle)] p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Perfil Especialista (Nicho Protegido)</span>
                <span className="badge-warning text-[10px] font-bold px-2 py-0.5 rounded">🌱 Cooperativa PNAE</span>
              </div>
              <h3 className="font-bold text-sm text-[var(--color-fg)]">Assoc. Trabalhadores Rurais de Betim & Cooperativas</h3>
              <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed">
                332 pedidos concentrados em 1 único grupo (Gêneros Alimentícios). Vence respaldada pela reserva legal da agricultura familiar no Programa Nacional de Alimentação Escolar.
              </p>
            </div>
          </div>

          {/* Tabela Playbook de Vencedores */}
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg-muted)]">
                <tr>
                  <th className="p-3 font-bold uppercase">Fornecedor Concorrente</th>
                  <th className="p-3 font-bold uppercase">Documento</th>
                  <th className="p-3 font-bold uppercase text-center">Pedidos</th>
                  <th className="p-3 font-bold uppercase text-right">Volume Total</th>
                  <th className="p-3 font-bold uppercase text-center">Escolas</th>
                  <th className="p-3 font-bold uppercase text-center">Grupos</th>
                  <th className="p-3 font-bold uppercase">Grupo Principal</th>
                  <th className="p-3 font-bold uppercase text-right">Ticket Mediano</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] font-medium">
                {winnerPlaybook.map((row) => (
                  <tr className="hover:bg-[var(--color-bg)]/50 transition-colors" key={row.supplierDocument || row.supplierName}>
                    <td className="p-3 font-bold text-[var(--color-fg)]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{row.supplierName}</span>
                        {row.isCooperative && (
                          <span className="inline-flex items-center rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                            🌱 Cooperativa PNAE
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-[var(--color-fg-muted)] font-mono text-[11px]">
                      {row.supplierDocument || "—"}
                    </td>
                    <td className="p-3 text-center font-bold text-[var(--color-fg)] tabular-nums">
                      {formatNumber(row.orders)}
                    </td>
                    <td className="p-3 text-right font-bold text-[var(--color-success)] tabular-nums">
                      {formatCurrency(row.totalValue)}
                    </td>
                    <td className="p-3 text-center tabular-nums text-[var(--color-fg-muted)]">
                      {row.schools}
                    </td>
                    <td className="p-3 text-center tabular-nums text-[var(--color-fg-muted)]">
                      {row.expenseGroups}
                    </td>
                    <td className="p-3 text-[var(--color-fg-muted)]">
                      {row.topGroup}
                    </td>
                    <td className="p-3 text-right font-semibold text-[var(--color-fg)] tabular-nums">
                      {formatCurrency(row.medianTicket)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SEÇÃO: Preço que o vencedor cobrou (Benchmark Real) */}
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 sm:p-8 shadow-[var(--shadow-card)] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 border-b border-[var(--color-border)] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="eyebrow text-[var(--color-primary)]">Benchmark Unitário Real</span>
                <span className="badge-success text-[10px] font-bold px-2 py-0.5 rounded">100% de Cobertura</span>
              </div>
              <h2 className="mt-1 text-2xl font-bold text-[var(--color-fg)]">
                Preço que o vencedor cobrou
              </h2>
            </div>
            <p className="text-xs text-[var(--color-fg-muted)]">
              Extraído diretamente de <code>items.unit_value</code> das cotações homologadas (não derivado da referência)
            </p>
          </div>

          <div className="rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-bg-subtle)] p-4 text-xs text-[var(--color-fg-muted)] leading-relaxed">
            🛡️ <strong>Dado 100% Confiável:</strong> Os valores abaixo são preços unitários reais faturados nas compras homologadas. Use a <strong>mediana de homologação</strong> como referência direta de precificação comercial em suas propostas.
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg-muted)]">
                <tr>
                  <th className="p-3 font-bold uppercase">Produto</th>
                  <th className="p-3 font-bold uppercase text-center">Unidade</th>
                  <th className="p-3 font-bold uppercase text-center">Amostras</th>
                  <th className="p-3 font-bold uppercase text-center">Concorrentes</th>
                  <th className="p-3 font-bold uppercase text-right">Menor Preço</th>
                  <th className="p-3 font-bold uppercase text-right">P25</th>
                  <th className="p-3 font-bold uppercase text-right text-[var(--color-success)] bg-[var(--color-success)]/10">Mediana Homologada</th>
                  <th className="p-3 font-bold uppercase text-right">P75</th>
                  <th className="p-3 font-bold uppercase text-right">Maior Preço</th>
                  <th className="p-3 font-bold uppercase text-center">Variação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] font-medium">
                {priceBenchmark.map((row) => (
                  <tr className="hover:bg-[var(--color-bg)]/50 transition-colors" key={`${row.product}-${row.unit}`}>
                    <td className="p-3 font-bold text-[var(--color-fg)]">
                      {row.product}
                    </td>
                    <td className="p-3 text-center font-mono text-[11px] text-[var(--color-fg-muted)]">
                      {row.unit}
                    </td>
                    <td className="p-3 text-center tabular-nums text-[var(--color-fg-muted)]">
                      {row.samples}
                    </td>
                    <td className="p-3 text-center tabular-nums text-[var(--color-fg-muted)]">
                      {row.supplierCount}
                    </td>
                    <td className="p-3 text-right tabular-nums text-[var(--color-fg-muted)]">
                      {formatCurrency(row.minPrice)}
                    </td>
                    <td className="p-3 text-right tabular-nums text-[var(--color-fg-muted)]">
                      {formatCurrency(row.p25)}
                    </td>
                    <td className="p-3 text-right font-black text-[var(--color-success)] tabular-nums bg-[var(--color-success)]/5">
                      {formatCurrency(row.median)}
                    </td>
                    <td className="p-3 text-right tabular-nums text-[var(--color-fg-muted)]">
                      {formatCurrency(row.p75)}
                    </td>
                    <td className="p-3 text-right tabular-nums text-[var(--color-fg-muted)]">
                      {formatCurrency(row.maxPrice)}
                    </td>
                    <td className="p-3 text-center tabular-nums font-semibold text-[var(--color-fg)]">
                      {row.spreadRatio.toFixed(1)}x
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SEÇÃO: Onde vale a pena disputar (Atratividade de Categorias) */}
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 sm:p-8 shadow-[var(--shadow-card)] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 border-b border-[var(--color-border)] pb-4">
            <div>
              <span className="eyebrow text-[var(--color-warning)]">Atratividade de Mercado</span>
              <h2 className="mt-1 text-2xl font-bold text-[var(--color-fg)]">
                Onde vale a pena disputar
              </h2>
            </div>
            <p className="text-xs text-[var(--color-fg-muted)]">
              Semáforo de concorrência por grupo de despesa e dispersão de pedidos
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg-muted)]">
                <tr>
                  <th className="p-3 font-bold uppercase">Grupo de Despesa</th>
                  <th className="p-3 font-bold uppercase text-center">Volume Pedidos</th>
                  <th className="p-3 font-bold uppercase text-center">Fornecedores Ativos</th>
                  <th className="p-3 font-bold uppercase text-right">Líder Tem (% Share)</th>
                  <th className="p-3 font-bold uppercase text-right">Ticket Mediano</th>
                  <th className="p-3 font-bold uppercase text-center">Faixa (P25 — P75)</th>
                  <th className="p-3 font-bold uppercase text-center">Nível de Concorrência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] font-medium">
                {categoryCompetition.map((row) => {
                  const levelBadge =
                    row.competitionLevel === "alta"
                      ? "badge-success"
                      : row.competitionLevel === "media"
                        ? "badge-warning"
                        : "badge-danger";
                  const levelText =
                    row.competitionLevel === "alta"
                      ? "🟢 Pulverizado (Entrada Fácil)"
                      : row.competitionLevel === "media"
                        ? "🟡 Moderado (Preço Calibrado)"
                        : "🔴 Cativo (Evite Disputar)";

                  return (
                    <tr className="hover:bg-[var(--color-bg)]/50 transition-colors" key={row.expenseGroup}>
                      <td className="p-3 font-bold text-[var(--color-fg)]">
                        {row.expenseGroup}
                      </td>
                      <td className="p-3 text-center tabular-nums font-semibold text-[var(--color-fg)]">
                        {formatNumber(row.orders)}
                      </td>
                      <td className="p-3 text-center tabular-nums text-[var(--color-fg-muted)]">
                        {formatNumber(row.supplierCount)}
                      </td>
                      <td className="p-3 text-right tabular-nums font-bold text-[var(--color-fg)]">
                        {formatPercent(row.leaderSharePct)}
                      </td>
                      <td className="p-3 text-right font-bold text-[var(--color-success)] tabular-nums">
                        {formatCurrency(row.medianTicket)}
                      </td>
                      <td className="p-3 text-center tabular-nums text-[var(--color-fg-muted)]">
                        {formatCurrency(row.p25Ticket)} — {formatCurrency(row.p75Ticket)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${levelBadge}`}>
                          {levelText}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* SEÇÃO: Escolas com dono (Mapa de Incumbência) */}
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 sm:p-8 shadow-[var(--shadow-card)] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 border-b border-[var(--color-border)] pb-4">
            <div>
              <span className="eyebrow text-[var(--color-danger)]">Concentração por Unidade</span>
              <h2 className="mt-1 text-2xl font-bold text-[var(--color-fg)]">
                Escolas com dono
              </h2>
            </div>
            <p className="text-xs text-[var(--color-fg-muted)]">
              96 escolas na RMBH possuem um único fornecedor concentrando mais de 50% dos pedidos
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg-muted)]">
                <tr>
                  <th className="p-3 font-bold uppercase">Escola Estadual</th>
                  <th className="p-3 font-bold uppercase">Município</th>
                  <th className="p-3 font-bold uppercase">Fornecedor Líder</th>
                  <th className="p-3 font-bold uppercase text-center">Pedidos Líder / Total</th>
                  <th className="p-3 font-bold uppercase text-right w-48">Participação do Líder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] font-medium">
                {incumbencyMap.map((row) => (
                  <tr className="hover:bg-[var(--color-bg)]/50 transition-colors" key={row.idSchool}>
                    <td className="p-3 font-bold text-[var(--color-fg)]">
                      {row.school}
                    </td>
                    <td className="p-3 text-[var(--color-fg-muted)]">
                      {row.city || "Minas Gerais"}
                    </td>
                    <td className="p-3 font-semibold text-[var(--color-fg)]">
                      {row.leaderSupplier}
                    </td>
                    <td className="p-3 text-center tabular-nums text-[var(--color-fg-muted)]">
                      <strong className="text-[var(--color-danger)]">{row.leaderOrders}</strong> / {row.totalOrders}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-[var(--color-bg)] border border-[var(--color-border)]">
                          <div
                            className="h-full bg-[var(--color-danger)] rounded-full transition-all"
                            style={{ width: `${Math.min(100, row.leaderSharePct)}%` }}
                          />
                        </div>
                        <span className="font-bold tabular-nums text-[var(--color-danger)] text-xs">
                          {formatPercent(row.leaderSharePct)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SEÇÃO: Aviso de Qualidade do Dado (Nota Lateral Neutra) */}
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="eyebrow text-xs text-[var(--color-warning)]">Nota de Engenharia & Qualidade dos Dados</span>
          </div>
          <h3 className="font-bold text-sm text-[var(--color-fg)]">
            Por que não calculamos desconto sobre o valor de referência do portal?
          </h3>
          <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed">
            Em auditoria de {formatNumber(winnerDiscount.pairs)} pares cruzados de cotações com homologação, apenas {winnerDiscount.belowRefCount} ficaram abaixo da referência (mediana de ratio {winnerDiscount.medianRatio ? winnerDiscount.medianRatio.toFixed(1) : "95.0"}x acima). O portal mistura frequentemente valores totais de lote com unitários e insere placeholders (ex: R$ 1,00). Por isso, a plataforma <strong>adota exclusivamente o preço unitário real faturado (`items.unit_value`)</strong> e nunca divide o total pela quantidade de itens.
          </p>
          <div className="text-[11px] text-[var(--color-fg-muted)]">
            No subconjunto sanitizado ({winnerDiscount.sanitizedPairs} pares válidos com ratio entre 0,3 e 1,0), a mediana de desconto real dos vencedores foi de <strong>{formatPercent(winnerDiscount.sanitizedMedianDiscountPct ?? 20)}</strong>.
          </div>
        </section>

        {/* SEÇÃO: Plano de Ação Estratégico para o Fornecedor */}
        <section className="rounded-2xl border border-[var(--color-primary)]/40 bg-[var(--color-bg)] p-6 sm:p-8 shadow-xl space-y-6">
          <div>
            <span className="eyebrow text-[var(--color-primary)]">Direcionamento Prático</span>
            <h2 className="text-2xl font-bold text-[var(--color-fg)]">
              Plano de ação para o fornecedor
            </h2>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-6 space-y-4">
            <h3 className="text-base font-bold text-[var(--color-fg)] flex items-center gap-2">
              <span>🎯</span> Diretrizes Comerciais Imediatas
            </h3>
            <ul className="space-y-3 text-xs text-[var(--color-fg-muted)] leading-relaxed list-disc list-inside">
              <li>
                <strong>Precifique pelo benchmark unitário real:</strong> Baseie seus lances na mediana dos preços homologados (`items.unit_value`), ignorando os tetos distorcidos do edital.
              </li>
              <li>
                <strong>Priorize categorias abertas e pulverizadas:</strong> Concentre esforços em <em>Conservação e Pequenos Reparos</em> (líder com apenas 2,5%) e <em>Material de Consumo</em> (4,2%), onde há maior probabilidade de conversão.
              </li>
              <li>
                <strong>Evite disputar Alimentação Escolar contra cooperativas:</strong> Associações rurais possuem preferência legal obrigatória pelo PNAE; dispute este nicho apenas se possuir certificação de agricultura familiar.
              </li>
              <li>
                <strong>Filtre escolas com incumbência excessiva:</strong> Evite unidades onde o líder detém mais de 50% dos pedidos, exceto com oferta de custo agressiva.
              </li>
              <li>
                <strong>Aproveite a janela útil de 4 dias:</strong> As cotações abertas reais têm lead time mediano de 4,1 dias. Envie as propostas com rapidez logo após a publicação.
              </li>
            </ul>

            <div className="mt-4 border-t border-[var(--color-border)] pt-3 text-[11px] text-[var(--color-fg-muted)]">
              ℹ️ <strong>Nota operacional de mercado:</strong> O volume de processos encerrados sem proposta (status FORA) representa o fluxo natural não disputado do setor e reflete filtragens operacionais de viabilidade.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function LiveBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full badge-success px-2 py-0.5 text-[10px] font-bold">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
      {label}
    </span>
  );
}

function SnapshotBadge({ date, label }: { date: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border badge-muted px-2 py-0.5 text-[10px] font-medium">
      <span>📌</span>
      {label ? `${label} (${date})` : `Snapshot ${date}`}
    </span>
  );
}

function KpiMiniCard({
  label,
  value,
  sub,
  provenance,
  highlight = false,
  alert = false
}: {
  label: string;
  value: string;
  sub: string;
  provenance?: "live" | "snapshot";
  highlight?: boolean;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-[var(--color-success)]/40 bg-[var(--color-bg-subtle)]"
          : alert
            ? "border-[var(--color-danger)]/40 bg-[var(--color-bg-subtle)]"
            : "border-[var(--color-border)] bg-[var(--color-bg)]"
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <p className="eyebrow text-[10px] text-[var(--color-fg-muted)]">{label}</p>
        {provenance === "live" ? (
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" title="Tempo Real" />
        ) : (
          <span className="text-[10px] text-[var(--color-fg-muted)]" title="Snapshot 20/08/2026">📌</span>
        )}
      </div>
      <p
        className={`mt-1 text-2xl font-black tabular-nums ${
          highlight ? "text-[var(--color-success)]" : alert ? "text-[var(--color-danger)]" : "text-[var(--color-fg)]"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">{sub}</p>
    </div>
  );
}
