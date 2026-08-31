import Link from "next/link";
import { quotationSource } from "@/lib/data/source";
import { competitiveAnalytics } from "@/lib/data/analytics";
import type {
  LossReason,
  WinnerPlaybookEntry,
  PriceBenchmark,
  CategoryCompetition,
  IncumbencyMapEntry,
  WinnerDiscount,
  CompetitiveSummary
} from "@/lib/data/analytics";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inteligência Competitiva & Onde Estão as Vitórias · LPA Leo",
  description:
    "Análise estratégica de preços adjudicados, playbook de vencedores, benchmark unitário e mapa de concorrência no Caixa Escolar MG."
};

const EMPTY_HISTORY_MESSAGE =
  "Sem histórico adjudicado sincronizado nesta base. Esta análise depende da tabela `opportunities`, que ainda não foi populada em produção.";

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

function formatOptionalNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value) || value <= 0) return "—";
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return `${value.toFixed(1).replace(".", ",")}%`;
}

export default async function RelatoriosPage() {
  let liveOpenCount: number | null = null;
  let liveTotalCount: number | null = null;
  let summary: CompetitiveSummary = {
    adjudicatedCount: 0,
    supplierCount: 0,
    unitPriceCount: 0,
    expenseGroupCount: 0
  };

  let lossReasons: LossReason[] = [];
  let winnerPlaybook: WinnerPlaybookEntry[] = [];
  let priceBenchmark: PriceBenchmark[] = [];
  let categoryCompetition: CategoryCompetition[] = [];
  let incumbencyMap: IncumbencyMapEntry[] = [];
  let winnerDiscount: WinnerDiscount | null = null;

  try {
    const [openRes, allRes, summaryRes, reasons, playbook, prices, categories, incumbency, discount] =
      await Promise.all([
        quotationSource.listOpportunities({ situation: "open" }, { page: 1, pageSize: 1 }),
        quotationSource.listOpportunities({ situation: "all" }, { page: 1, pageSize: 1 }),
        competitiveAnalytics.getSummary(),
        competitiveAnalytics.getLossReasons(),
        competitiveAnalytics.getWinnerPlaybook(10),
        competitiveAnalytics.getPriceBenchmark(10),
        competitiveAnalytics.getCategoryCompetition(),
        competitiveAnalytics.getIncumbencyMap(8),
        competitiveAnalytics.getWinnerDiscount()
      ]);

    liveOpenCount = openRes.total;
    liveTotalCount = allRes.total;
    summary = summaryRes;

    lossReasons = reasons ?? [];
    winnerPlaybook = playbook ?? [];
    priceBenchmark = prices ?? [];
    categoryCompetition = categories ?? [];
    incumbencyMap = incumbency ?? [];
    winnerDiscount = discount && discount.pairs > 0 ? discount : null;
  } catch (error) {
    console.error("Erro ao carregar dados dinâmicos para relatórios:", error);
  }

  const generalistWinner = winnerPlaybook.find((row) => !row.isCooperative);
  const cooperativeWinner = winnerPlaybook.find((row) => row.isCooperative);
  const attractiveCategories = categoryCompetition
    .filter((row) => row.competitionLevel === "alta")
    .slice(0, 2);
  const concentratedThreshold = incumbencyMap.length > 0 ? Math.min(...incumbencyMap.map((row) => row.leaderSharePct)) : null;

  const lossReasonActionMap: Record<string, { title: string; badge: string; icon: string; action: string }> = {
    prazo_inviavel: {
      title: "Prazo de Entrega Inviável",
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
      title: "Escolas com Fornecedor Cativo",
      badge: "badge-warning",
      icon: "🏛️",
      action: "Direcionar propostas para escolas pulverizadas; evite confrontar líderes consolidados sem diferencial de custo."
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
                <LiveBadge label={`Banco: ${formatOptionalNumber(liveOpenCount)} abertas / ${formatOptionalNumber(liveTotalCount)} total`} />
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
            provenance="live"
            sub="Base de concorrência analisada"
            value={formatOptionalNumber(summary.adjudicatedCount)}
          />
          <KpiMiniCard
            label="Fornecedores Mapeados"
            provenance="live"
            sub="Concorrentes com histórico"
            value={formatOptionalNumber(summary.supplierCount)}
          />
          <KpiMiniCard
            label="Preços Unitários Reais"
            provenance="live"
            sub="Itens adjudicados homologados"
            value={formatOptionalNumber(summary.unitPriceCount)}
          />
          <KpiMiniCard
            label="Categorias de Despesa"
            provenance="live"
            sub="Grupos de compra mapeados"
            value={formatOptionalNumber(summary.expenseGroupCount)}
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

          {lossReasons.length === 0 ? (
            <EmptyState mensagem={EMPTY_HISTORY_MESSAGE} />
          ) : (
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
          )}
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

          {winnerPlaybook.length === 0 ? (
            <EmptyState mensagem={EMPTY_HISTORY_MESSAGE} />
          ) : (
            <>
              {(generalistWinner || cooperativeWinner) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {generalistWinner && <WinnerProfileCard kind="generalist" row={generalistWinner} />}
                  {cooperativeWinner && <WinnerProfileCard kind="cooperative" row={cooperativeWinner} />}
                </div>
              )}

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
            </>
          )}
        </section>

        {/* SEÇÃO: Preço que o vencedor cobrou (Benchmark Real) */}
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 sm:p-8 shadow-[var(--shadow-card)] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 border-b border-[var(--color-border)] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="eyebrow text-[var(--color-primary)]">Benchmark Unitário Real</span>
              </div>
              <h2 className="mt-1 text-2xl font-bold text-[var(--color-fg)]">
                Preço que o vencedor cobrou
              </h2>
            </div>
            <p className="text-xs text-[var(--color-fg-muted)]">
              Extraído diretamente de <code>items.unit_value</code> das cotações homologadas (não derivado da referência)
            </p>
          </div>

          {priceBenchmark.length === 0 ? (
            <EmptyState mensagem={EMPTY_HISTORY_MESSAGE} />
          ) : (
            <>
              <div className="rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-bg-subtle)] p-4 text-xs text-[var(--color-fg-muted)] leading-relaxed">
                <strong>Dado de banco:</strong> Os valores abaixo são preços unitários faturados nas compras homologadas. Use a <strong>mediana de homologação</strong> como referência direta de precificação comercial em suas propostas.
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
            </>
          )}
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

          {categoryCompetition.length === 0 ? (
            <EmptyState mensagem={EMPTY_HISTORY_MESSAGE} />
          ) : (
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
          )}
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
            {concentratedThreshold !== null && (
              <p className="text-xs text-[var(--color-fg-muted)]">
                Escolas listadas possuem fornecedor líder com participação a partir de {formatPercent(concentratedThreshold)}
              </p>
            )}
          </div>

          {incumbencyMap.length === 0 ? (
            <EmptyState mensagem={EMPTY_HISTORY_MESSAGE} />
          ) : (
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
          )}
        </section>

        {/* SEÇÃO: Aviso de Qualidade do Dado (Nota Lateral Neutra) */}
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="eyebrow text-xs text-[var(--color-warning)]">Nota de Engenharia & Qualidade dos Dados</span>
          </div>
          <h3 className="font-bold text-sm text-[var(--color-fg)]">
            Por que não calculamos desconto sobre o valor de referência do portal?
          </h3>
          {winnerDiscount === null ? (
            <EmptyState mensagem={EMPTY_HISTORY_MESSAGE} />
          ) : (
            <>
              <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed">
                Em {formatNumber(winnerDiscount.pairs)} pares cruzados de cotações com homologação, {formatNumber(winnerDiscount.belowRefCount)} ficaram abaixo da referência
                {winnerDiscount.medianRatio !== null ? ` (mediana de ratio ${winnerDiscount.medianRatio.toFixed(1)}x)` : ""}. O portal mistura frequentemente valores totais de lote com unitários e insere placeholders. Por isso, a plataforma <strong>adota exclusivamente o preço unitário real faturado (`items.unit_value`)</strong> e nunca divide o total pela quantidade de itens.
              </p>
              <div className="text-[11px] text-[var(--color-fg-muted)]">
                No subconjunto sanitizado ({formatNumber(winnerDiscount.sanitizedPairs)} pares válidos), a mediana de desconto real dos vencedores foi de <strong>{formatPercent(winnerDiscount.sanitizedMedianDiscountPct)}</strong>.
              </div>
            </>
          )}
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
              {attractiveCategories.length > 0 && (
                <li>
                  <strong>Priorize categorias abertas e pulverizadas:</strong> Concentre esforços em{" "}
                  {attractiveCategories.map((row) => (
                    <span key={row.expenseGroup}>
                      <em>{row.expenseGroup}</em> (líder com {formatPercent(row.leaderSharePct)}){" "}
                    </span>
                  ))}
                  onde há maior probabilidade de conversão.
                </li>
              )}
              <li>
                <strong>Evite disputar Alimentação Escolar contra cooperativas:</strong> Associações rurais possuem preferência legal obrigatória pelo PNAE; dispute este nicho apenas se possuir certificação de agricultura familiar.
              </li>
              {concentratedThreshold !== null && (
                <li>
                  <strong>Filtre escolas com incumbência excessiva:</strong> Evite unidades onde o líder aparece com participação a partir de {formatPercent(concentratedThreshold)}, exceto com oferta de custo agressiva.
                </li>
              )}
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

function EmptyState({ mensagem }: { mensagem: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-6 text-sm leading-relaxed text-[var(--color-fg-muted)]">
      {mensagem}
    </div>
  );
}

function WinnerProfileCard({ row, kind }: { row: WinnerPlaybookEntry; kind: "generalist" | "cooperative" }) {
  return (
    <div className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-bg-subtle)] p-5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
          {kind === "cooperative" ? "Perfil Especialista" : "Perfil Generalista"}
        </span>
        <span className="badge-success text-[10px] font-bold px-2 py-0.5 rounded">
          {kind === "cooperative" ? "Cooperativa PNAE" : "Alta Capilaridade"}
        </span>
      </div>
      <h3 className="font-bold text-sm text-[var(--color-fg)]">{row.supplierName}</h3>
      <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed">
        {formatNumber(row.orders)} pedidos em {formatNumber(row.schools)} escolas e {formatNumber(row.expenseGroups)} grupos de despesa. Grupo principal: {row.topGroup}.
      </p>
    </div>
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
  provenance?: "live";
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
        {provenance === "live" && (
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" title="Tempo Real" />
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
