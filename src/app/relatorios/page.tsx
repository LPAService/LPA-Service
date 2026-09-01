import Link from "next/link";
import { quotationSource } from "@/lib/data/source";
import { competitiveAnalytics, proposalLossAnalytics } from "@/lib/data/analytics";
import type {
  LossReason,
  WinnerPlaybookEntry,
  PriceBenchmark,
  CategoryCompetition,
  IncumbencyMapEntry,
  WinnerDiscount,
  CompetitiveSummary,
  ProposalLossListItem,
  ProposalLossGroupAggregate,
  ProposalLossWinnerRanking
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

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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

  let proposalLossesList: ProposalLossListItem[] = [];
  let lossesByGroup: ProposalLossGroupAggregate[] = [];
  let winningCompetitors: ProposalLossWinnerRanking[] = [];

  try {
    const [
      openRes,
      allRes,
      summaryRes,
      reasons,
      playbook,
      prices,
      categories,
      incumbency,
      discount,
      lossItems,
      lossGroups,
      lossWinners
    ] = await Promise.allSettled([
      quotationSource.listOpportunities({ situation: "open" }, { page: 1, pageSize: 1 }),
      quotationSource.listOpportunities({ situation: "all" }, { page: 1, pageSize: 1 }),
      competitiveAnalytics.getSummary(),
      competitiveAnalytics.getLossReasons(),
      competitiveAnalytics.getWinnerPlaybook(10),
      competitiveAnalytics.getPriceBenchmark(10),
      competitiveAnalytics.getCategoryCompetition(),
      competitiveAnalytics.getIncumbencyMap(8),
      competitiveAnalytics.getWinnerDiscount(),
      proposalLossAnalytics.listLosses(100),
      proposalLossAnalytics.getLossesByExpenseGroup(),
      proposalLossAnalytics.getWinningCompetitors(10)
    ]);

    if (openRes.status === "fulfilled") liveOpenCount = openRes.value.total;
    if (allRes.status === "fulfilled") liveTotalCount = allRes.value.total;
    if (summaryRes.status === "fulfilled") summary = summaryRes.value;

    if (reasons.status === "fulfilled") lossReasons = reasons.value ?? [];
    if (playbook.status === "fulfilled") winnerPlaybook = playbook.value ?? [];
    if (prices.status === "fulfilled") priceBenchmark = prices.value ?? [];
    if (categories.status === "fulfilled") categoryCompetition = categories.value ?? [];
    if (incumbency.status === "fulfilled") incumbencyMap = incumbency.value ?? [];
    if (discount.status === "fulfilled" && discount.value && discount.value.pairs > 0) {
      winnerDiscount = discount.value;
    }

    if (lossItems.status === "fulfilled") proposalLossesList = lossItems.value ?? [];
    if (lossGroups.status === "fulfilled") lossesByGroup = lossGroups.value ?? [];
    if (lossWinners.status === "fulfilled") winningCompetitors = lossWinners.value ?? [];
  } catch (error) {
    console.error("Erro ao carregar dados dinâmicos para relatórios:", error);
  }

  const totalLossCount = proposalLossesList.length;

  const lossesWithKnownWinner = proposalLossesList.filter(
    (item): item is ProposalLossListItem & { winnerTotal: number; lossGapPercent: number } =>
      item.winnerTotal !== null &&
      item.lossGapPercent !== null &&
      typeof item.winnerTotal === "number" &&
      typeof item.lossGapPercent === "number"
  );

  const moreExpensiveThanWinnerCount = lossesWithKnownWinner.filter(
    (item) => item.ourTotal > item.winnerTotal
  ).length;

  const priceLossPct =
    lossesWithKnownWinner.length > 0
      ? (moreExpensiveThanWinnerCount / lossesWithKnownWinner.length) * 100
      : null;

  const validGaps = lossesWithKnownWinner.map((item) => item.lossGapPercent);
  const overallMedianGap = computeMedian(validGaps);

  const sortedLosses = [...proposalLossesList].sort((a, b) => {
    if (a.lossGapPercent === null && b.lossGapPercent === null) return 0;
    if (a.lossGapPercent === null) return 1;
    if (b.lossGapPercent === null) return -1;
    return a.lossGapPercent - b.lossGapPercent;
  });

  const competitiveDisputes = sortedLosses.filter(
    (item): item is ProposalLossListItem & { winnerTotal: number; lossGapPercent: number } =>
      item.lossGapPercent !== null && item.winnerTotal !== null && item.lossGapPercent <= 100
  );
  const minCompetitiveLoss = competitiveDisputes.length > 0 ? competitiveDisputes[0] : null;

  const pricingErrorLosses = sortedLosses.filter(
    (item): item is ProposalLossListItem & { winnerTotal: number; lossGapPercent: number } =>
      item.lossGapPercent !== null && item.winnerTotal !== null && item.lossGapPercent > 100
  );
  const minPricingError = pricingErrorLosses.length > 0 ? pricingErrorLosses[0] : null;
  const maxPricingError = pricingErrorLosses.length > 0 ? pricingErrorLosses[pricingErrorLosses.length - 1] : null;

  const directDisputeLosses = proposalLossesList.filter((item) => item.competitorCount === 2);
  const topLossGroup = lossesByGroup.length > 0 ? lossesByGroup[0] : null;
  const topWinningCompetitor = winningCompetitors.length > 0 ? winningCompetitors[0] : null;

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

        {/* SEÇÃO: Aprenda com as perdas (Diagnóstico de Propostas Perdidas) */}
        <section className="rounded-2xl border-2 border-[var(--color-danger)]/40 bg-[var(--color-bg)] p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 border-b border-[var(--color-border)] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="eyebrow text-[var(--color-danger)]">Raio-X de Propostas Perdidas</span>
                {totalLossCount > 0 && (
                  <span className="rounded-full bg-[var(--color-danger)]/15 px-2.5 py-0.5 text-[10px] font-bold text-[var(--color-danger)]">
                    {priceLossPct !== null ? `${formatPercent(priceLossPct)} Perdidas no Preço` : `${formatNumber(totalLossCount)} Perdas Registradas`}
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[var(--color-fg)] sm:text-3xl">
                Aprenda com as perdas
              </h2>
            </div>
            <p className="text-xs text-[var(--color-fg-muted)]">
              Diagnóstico detalhado dos seus lances recusados: por que perdeu, distância para o vencedor e calibração comercial
            </p>
          </div>

          {totalLossCount === 0 ? (
            <EmptyState mensagem="Nenhuma proposta perdida registrada no banco até o momento. Conforme novas propostas forem sincronizadas e analisadas, o diagnóstico detalhado de perdas aparecerá aqui." />
          ) : (
            <>
              {/* KPIs de Resumo das Perdas */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiMiniCard
                  alert
                  label="Fato Central da Auditoria"
                  sub={
                    lossesWithKnownWinner.length > 0
                      ? `Em ${formatNumber(moreExpensiveThanWinnerCount)} de ${formatNumber(lossesWithKnownWinner.length)} propostas com vencedor conhecido, ficamos acima do menor preço.`
                      : "Sem propostas com vencedor conhecido registradas."
                  }
                  value={priceLossPct !== null ? `${formatPercent(priceLossPct)} no Preço` : "—"}
                />
                <KpiMiniCard
                  highlight
                  label="Diferença Mediana"
                  sub={
                    overallMedianGap !== null
                      ? `Nossos lances ficaram em média +${formatPercent(overallMedianGap)} acima do preço homologado vencedor.`
                      : "Sem histórico suficiente para cálculo da mediana."
                  }
                  value={overallMedianGap !== null ? `+${formatPercent(overallMedianGap)}` : "—"}
                />
                <KpiMiniCard
                  alert={pricingErrorLosses.length > 0}
                  label="Erros de Precificação (> 100%)"
                  sub={
                    maxPricingError
                      ? `Diferença extrema de até +${formatPercent(maxPricingError.lossGapPercent)}. Diferença de valor expressiva demais para ser disputa de margem.`
                      : "Processos com diferença superior a 100% em relação ao vencedor."
                  }
                  value={`${formatNumber(pricingErrorLosses.length)} processos`}
                />
                <KpiMiniCard
                  label="Disputas Diretas (1x1)"
                  sub="Processos com apenas 2 concorrentes onde o resultado foi decidido no preço final."
                  value={`${formatNumber(directDisputeLosses.length)} processos`}
                />
              </div>

              {/* Grid 2 colunas: Onde mais se perde & Quem mais vence contra nós */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Onde mais se perde por grupo */}
                <div className="flex flex-col justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-5 space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="eyebrow text-xs text-[var(--color-primary)]">Concentração por Categoria</span>
                      <span className="text-[11px] text-[var(--color-fg-muted)]">{formatNumber(lossesByGroup.length)} grupos mapeados</span>
                    </div>
                    <h3 className="text-base font-bold text-[var(--color-fg)]">
                      Onde mais se perde (por grupo de despesa)
                    </h3>
                    <p className="text-xs text-[var(--color-fg-muted)]">
                      Volume de lances perdidos e diferença mediana por categoria
                    </p>
                  </div>

                  {lossesByGroup.length === 0 ? (
                    <EmptyState mensagem="Sem dados de grupos de despesa para propostas perdidas." />
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)]">
                          <tr>
                            <th className="p-2.5 font-bold uppercase">Grupo de Despesa</th>
                            <th className="p-2.5 font-bold uppercase text-center">Perdas</th>
                            <th className="p-2.5 font-bold uppercase text-right">Diferença Mediana (%)</th>
                            <th className="p-2.5 font-bold uppercase text-right">Diferença Mediana (R$)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)] font-medium">
                          {lossesByGroup.map((row) => (
                            <tr className="hover:bg-[var(--color-bg-subtle)]/50 transition-colors" key={row.expenseGroup}>
                              <td className="p-2.5 font-bold text-[var(--color-fg)]">{row.expenseGroup}</td>
                              <td className="p-2.5 text-center font-black tabular-nums text-[var(--color-danger)]">
                                {formatNumber(row.lossCount)}
                              </td>
                              <td className="p-2.5 text-right font-semibold tabular-nums text-[var(--color-fg)]">
                                {row.medianPriceGapPct !== null ? `+${formatPercent(row.medianPriceGapPct)}` : "—"}
                              </td>
                              <td className="p-2.5 text-right font-mono tabular-nums text-[var(--color-fg-muted)]">
                                {row.medianPriceGapAmount !== null ? `+${formatCurrency(row.medianPriceGapAmount)}` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {topLossGroup && (
                    <div className="border-t border-[var(--color-border)] pt-2 text-[11px] text-[var(--color-fg-muted)]">
                      💡 <strong>Destaque de Categoria:</strong> <strong>{topLossGroup.expenseGroup}</strong> concentra {formatNumber(topLossGroup.lossCount)} das {formatNumber(totalLossCount)} perdas
                      {topLossGroup.medianPriceGapPct !== null ? ` (diferença mediana de +${formatPercent(topLossGroup.medianPriceGapPct)})` : ""}.
                    </div>
                  )}
                </div>

                {/* Quem mais vence contra nós */}
                <div className="flex flex-col justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-5 space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="eyebrow text-xs text-[var(--color-danger)]">Adversários Mais Frequentes</span>
                      <span className="text-[11px] text-[var(--color-fg-muted)]">{formatNumber(winningCompetitors.length)} concorrentes</span>
                    </div>
                    <h3 className="text-base font-bold text-[var(--color-fg)]">
                      Quem mais vence contra nós
                    </h3>
                    <p className="text-xs text-[var(--color-fg-muted)]">
                      Concorrentes que mais levaram processos disputados pela sua empresa
                    </p>
                  </div>

                  {winningCompetitors.length === 0 ? (
                    <EmptyState mensagem="Sem concorrentes vencedores registrados." />
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)]">
                          <tr>
                            <th className="p-2.5 font-bold uppercase">Concorrente Vencedor</th>
                            <th className="p-2.5 font-bold uppercase text-center">Vitórias</th>
                            <th className="p-2.5 font-bold uppercase text-center">Preços Conhecidos</th>
                            <th className="p-2.5 font-bold uppercase text-right">Ticket Mediano</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)] font-medium">
                          {winningCompetitors.map((row) => (
                            <tr className="hover:bg-[var(--color-bg-subtle)]/50 transition-colors" key={row.winnerSupplierId}>
                              <td className="p-2.5 font-bold text-[var(--color-fg)]">
                                {row.winnerName || `Fornecedor #${row.winnerSupplierId}`}
                              </td>
                              <td className="p-2.5 text-center font-black tabular-nums text-[var(--color-danger)]">
                                {formatNumber(row.wins)}
                              </td>
                              <td className="p-2.5 text-center tabular-nums text-[var(--color-fg-muted)]">
                                {formatNumber(row.knownWinnerTotalCount)} / {formatNumber(row.wins)}
                              </td>
                              <td className="p-2.5 text-right font-semibold tabular-nums text-[var(--color-success)]">
                                {formatCurrency(row.medianWinnerTotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {topWinningCompetitor && (
                    <div className="border-t border-[var(--color-border)] pt-2 text-[11px] text-[var(--color-fg-muted)]">
                      💡 <strong>Líder de Vitórias Diretas:</strong> <strong>{topWinningCompetitor.winnerName || `Fornecedor #${topWinningCompetitor.winnerSupplierId}`}</strong> venceu {formatNumber(topWinningCompetitor.wins)} vezes contra sua proposta.
                    </div>
                  )}
                </div>
              </div>

              {/* Bloco Diagnóstico: Disputas Comerciais vs Erros de Precificação */}
              <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-5">
                <div className="space-y-2 border-b sm:border-b-0 sm:border-r border-[var(--color-border)] pb-4 sm:pb-0 sm:pr-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs">⚡</span>
                    <h4 className="font-bold text-sm text-[var(--color-fg)]">Disputas Comerciais (Diferença ≤ 100%)</h4>
                  </div>
                  <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed">
                    {minCompetitiveLoss ? (
                      <>
                        Processos com margem competitiva real. A menor diferença registrada foi de{" "}
                        <strong>+{formatPercent(minCompetitiveLoss.lossGapPercent)}</strong> (pedido <code>{minCompetitiveLoss.orderId}</code>).
                        Pequenos ajustes de margem ou cotação direta com fornecedores permitem reverter esses resultados.
                      </>
                    ) : (
                      "Nenhuma disputa comercial na faixa de até 100% de diferença registrada até o momento."
                    )}
                  </p>
                </div>

                <div className="space-y-2 sm:pl-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-rose-500/20 text-rose-400 font-bold text-xs">⚠️</span>
                    <h4 className="font-bold text-sm text-rose-400">Distorções de Precificação (Diferença &gt; 100%)</h4>
                  </div>
                  <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed">
                    {pricingErrorLosses.length > 0 && maxPricingError ? (
                      <>
                        {minPricingError && minPricingError !== maxPricingError ? (
                          <>
                            Diferenças entre <strong>+{formatPercent(minPricingError.lossGapPercent)}</strong> e{" "}
                            <strong>+{formatPercent(maxPricingError.lossGapPercent)}</strong>{" "}
                          </>
                        ) : (
                          <>Diferença de <strong>+{formatPercent(maxPricingError.lossGapPercent)}</strong> </>
                        )}
                        (ex: nosso {formatCurrency(maxPricingError.ourTotal)} vs vencedor {formatCurrency(maxPricingError.winnerTotal)} no pedido <code>{maxPricingError.orderId}</code>).
                        A diferença de valor é expressiva demais para ser disputa de margem.
                      </>
                    ) : (
                      "Nenhum caso com diferença superior a 100% registrado até o momento."
                    )}
                  </p>
                </div>
              </div>

              {/* Tabela Detalhada de Perdas */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <h3 className="text-base font-bold text-[var(--color-fg)] flex items-center gap-2">
                    <span>📋</span> Lista Detalhada das Perdas (Ordenada por Diferença)
                  </h3>
                  <span className="text-xs text-[var(--color-fg-muted)]">
                    Da menor margem registrada aos maiores desvios
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg-muted)]">
                      <tr>
                        <th className="p-3 font-bold uppercase">Pedido / Prazo</th>
                        <th className="p-3 font-bold uppercase">Escola & Município</th>
                        <th className="p-3 font-bold uppercase">Grupo de Despesa</th>
                        <th className="p-3 font-bold uppercase text-right">Nosso Valor</th>
                        <th className="p-3 font-bold uppercase text-right">Valor Vencedor</th>
                        <th className="p-3 font-bold uppercase text-center">Diferença %</th>
                        <th className="p-3 font-bold uppercase text-center">Nossa Posição</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)] font-medium">
                      {sortedLosses.map((row) => {
                        const isPricingError = row.lossGapPercent !== null && row.lossGapPercent > 100;
                        const isDirectDispute = row.competitorCount === 2;

                        return (
                          <tr
                            className={`hover:bg-[var(--color-bg)]/60 transition-colors ${
                              isPricingError ? "bg-rose-500/[0.04] dark:bg-rose-950/20" : ""
                            }`}
                            key={row.orderId}
                          >
                            {/* Pedido */}
                            <td className="p-3">
                              <div className="font-mono font-bold text-[var(--color-fg)]">
                                {row.orderId}
                              </div>
                              <span className="text-[10px] text-[var(--color-fg-muted)] block">
                                {formatDate(row.proposalDeadline)}
                              </span>
                            </td>

                            {/* Escola & Município */}
                            <td className="p-3">
                              <div className="font-semibold text-[var(--color-fg)] max-w-xs truncate" title={row.schoolName}>
                                {row.schoolName}
                              </div>
                              <div className="text-[11px] text-[var(--color-fg-muted)]">
                                {row.countyName || "Minas Gerais"}
                              </div>
                            </td>

                            {/* Grupo */}
                            <td className="p-3 text-[var(--color-fg-muted)]">
                              {row.expenseGroup}
                            </td>

                            {/* Nosso Valor */}
                            <td className="p-3 text-right font-bold text-[var(--color-fg)] tabular-nums">
                              {formatCurrency(row.ourTotal)}
                            </td>

                            {/* Valor Vencedor */}
                            <td className="p-3 text-right tabular-nums">
                              {row.winnerTotal !== null ? (
                                <div>
                                  <span className="font-bold text-[var(--color-success)]">
                                    {formatCurrency(row.winnerTotal)}
                                  </span>
                                  <span
                                    className="block text-[10px] text-[var(--color-fg-muted)] truncate max-w-[140px] ml-auto"
                                    title={row.winnerName || ""}
                                  >
                                    {row.winnerName || `Fornecedor #${row.winnerSupplierId}`}
                                  </span>
                                </div>
                              ) : (
                                <div>
                                  <span className="italic text-[var(--color-fg-muted)]">
                                    Valor do vencedor não informado
                                  </span>
                                  {row.winnerName && (
                                    <span className="block text-[10px] text-[var(--color-fg-muted)] truncate max-w-[140px] ml-auto">
                                      {row.winnerName}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Diferença % */}
                            <td className="p-3 text-center">
                              {row.lossGapPercent !== null ? (
                                isPricingError ? (
                                  <div>
                                    <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-xs font-black text-rose-400 tabular-nums">
                                      ⚠️ +{formatPercent(row.lossGapPercent)}
                                    </span>
                                    <span className="block text-[10px] font-bold text-rose-400 mt-0.5">
                                      Erro de Precificação
                                    </span>
                                  </div>
                                ) : (
                                  <div>
                                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-400 tabular-nums">
                                      +{formatPercent(row.lossGapPercent)}
                                    </span>
                                    {row.winnerTotal !== null && (
                                      <span className="block text-[10px] text-[var(--color-fg-muted)] tabular-nums mt-0.5">
                                        +{formatCurrency(row.ourTotal - row.winnerTotal)}
                                      </span>
                                    )}
                                  </div>
                                )
                              ) : (
                                <span className="text-[var(--color-fg-muted)] font-mono">—</span>
                              )}
                            </td>

                            {/* Posição / Concorrentes */}
                            <td className="p-3 text-center">
                              {row.ourRank !== null && row.competitorCount > 0 ? (
                                isDirectDispute ? (
                                  <div>
                                    <span className="font-black text-[var(--color-danger)] tabular-nums text-xs">
                                      {row.ourRank}º de {row.competitorCount}
                                    </span>
                                    <span className="block text-[10px] font-bold text-rose-400">
                                      Disputa 1x1
                                    </span>
                                  </div>
                                ) : (
                                  <div>
                                    <span className="font-bold text-[var(--color-fg)] tabular-nums text-xs">
                                      {row.ourRank}º de {row.competitorCount}
                                    </span>
                                    <span className="block text-[10px] text-[var(--color-fg-muted)]">
                                      concorrentes
                                    </span>
                                  </div>
                                )
                              ) : (
                                <span className="text-[var(--color-fg-muted)] tabular-nums">
                                  {row.competitorCount ? `${row.competitorCount} conc.` : "—"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
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
