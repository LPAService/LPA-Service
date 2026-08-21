import Link from "next/link";
import { opportunitySource, quotationSource } from "@/lib/data/source";
import { formatCurrency, pluralize } from "@/components/opportunity-card";

export const metadata = {
  title: "Relatórios & Diagnóstico Comercial · LPA Leo",
  description: "Análise estratégica de 180.451 cotações do SGD: funil de status, armadilha do preço de referência, saúde da coleta e gargalos operacionais."
};

// Dados estruturais consolidados da auditoria analítica real (2026-08-20)
const AUDIT_DATE = "2026-08-20";

const STATUS_VOCABULARY = [
  {
    code: "APRO",
    label: "Aprovada",
    color: "#25D366",
    badgeClass: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
    bgBar: "bg-emerald-500",
    count: 0,
    pct: "0.0%",
    meaning: "A escola aprovou a proposta (você venceu o processo). É o único balde positivo.",
    supplierAction: "Meta principal: sair do zero neste balde."
  },
  {
    code: "ENVI",
    label: "Enviada",
    color: "#FFB020",
    badgeClass: "border-amber-500/40 bg-amber-500/15 text-amber-300",
    bgBar: "bg-amber-500",
    count: 1,
    pct: "<0.01%",
    meaning: "Proposta enviada pelo fornecedor, aguardando análise e julgamento da escola.",
    supplierAction: "Acompanhar prazo de homologação."
  },
  {
    code: "NAEN",
    label: "Não Enviada (Aberta)",
    color: "#7F1A6B",
    badgeClass: "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-300",
    bgBar: "bg-fuchsia-600",
    count: 11, // Ativas no portal / 274 na base recente
    pct: "0.15%",
    meaning: "Cotações abertas no portal SGD aguardando envio de proposta dentro do prazo.",
    supplierAction: "Janela útil de ação imediata (lead time médio de 4 dias)."
  },
  {
    code: "RECU",
    label: "Recusada",
    color: "#EF4C4C",
    badgeClass: "border-red-500/40 bg-red-500/15 text-red-300",
    bgBar: "bg-red-500",
    count: 23591,
    pct: "13.07%",
    meaning: "A proposta enviada foi ativamente recusada pela escola após análise de preços/documentos.",
    supplierAction: "Analisar motivos de desclassificação/recusa formal."
  },
  {
    code: "CANC",
    label: "Cancelada",
    color: "#F87171",
    badgeClass: "border-rose-500/40 bg-rose-500/15 text-rose-300",
    bgBar: "bg-rose-400",
    count: 4693,
    pct: "2.60%",
    meaning: "A escola cancelou a cotação no SGD antes da conclusão. Não representa perda de lance.",
    supplierAction: "Descartar do cômputo de concorrência real."
  },
  {
    code: "FORA",
    label: "Prazo Encerrado",
    color: "#64748B",
    badgeClass: "border-slate-500/40 bg-slate-500/15 text-slate-300",
    bgBar: "bg-slate-500",
    count: 152155,
    pct: "84.32%",
    meaning: "O prazo de proposta expirou sem que o fornecedor submetesse lance. Perda por inércia.",
    supplierAction: "Gargalo central do negócio: 84% das perdas ocorrem por não-envio."
  }
];

const TOTAL_HISTORICAL_QUOTES = 180451;

export default async function RelatoriosPage() {
  // Consultas dinâmicas ao banco de dados com fallback gracioso
  let liveOpenCount = 0;
  let liveTotalCount = 0;
  let liveHistoryCount = 0;
  let hasHistoryData = false;

  try {
    const [openRes, allRes, historyRes] = await Promise.all([
      quotationSource.listOpportunities({ situation: "open" }, { page: 1, pageSize: 1 }),
      quotationSource.listOpportunities({ situation: "all" }, { page: 1, pageSize: 1 }),
      opportunitySource.listOpportunities({}, { page: 1, pageSize: 1 })
    ]);

    liveOpenCount = openRes.total;
    liveTotalCount = allRes.total;
    liveHistoryCount = historyRes.total;
    hasHistoryData = historyRes.total > 0;
  } catch (error) {
    console.error("Erro ao carregar dados dinâmicos para relatórios:", error);
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)]">
      {/* Header com Navegação */}
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur-sm">
        <div className="shell py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="eyebrow text-[var(--color-primary)]">Inteligência & Diagnóstico</span>
                <span className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-0.5 text-[11px] font-bold text-fuchsia-300">
                  Auditoria Base SGD
                </span>
              </div>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--color-fg)] sm:text-4xl">
                Por que perdemos tantos lances?
              </h1>
              <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                Radiografia comercial de 180.451 cotações, gargalos operacionais e qualidade de dados do portal.
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
            </nav>
          </div>
        </div>
      </header>

      <div className="shell py-8 space-y-10">
        {/* Banner de Resumo com Headline Inequívoco */}
        <section className="rounded-2xl border-2 border-red-500/30 bg-red-950/20 p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-md bg-red-500/20 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-red-300">
                🚨 Conclusão Central da Auditoria
              </div>
              <h2 className="text-2xl font-bold leading-tight text-[var(--color-fg)] sm:text-3xl">
                O fornecedor tem <span className="text-emerald-400 font-black">ZERO</span> vitórias porque{" "}
                <span className="text-red-400 underline decoration-red-500/50">84% dos processos expiram sem lance</span>.
              </h2>
              <p className="text-sm leading-relaxed text-slate-300">
                Em 180.451 cotações analisadas no perfil do SGD, o balde de aprovação está zerado. A perda histórica não é causada por preço alto ou concorrência predatória: é causada por <strong>não-envio de proposta (152.155 casos)</strong> e prazos logisticamente inviáveis.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 shrink-0 sm:grid-cols-2 lg:grid-cols-2">
              <KpiMiniCard highlight label="Vitórias (Aprovadas)" sub="Em 180.451 cotações" value="0" />
              <KpiMiniCard alert label="Sem Lance (FORA)" sub="84,3% do volume total" value="152.155" />
              <KpiMiniCard label="Recusadas (RECU)" sub="13,1% pela escola" value="23.591" />
              <KpiMiniCard label="Prazos Impossíveis" sub="Entrega no mesmo dia" value="41,3%" />
            </div>
          </div>
        </section>

        {/* SEÇÃO 1: Funil de Status do SGD */}
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 sm:p-8 shadow-[var(--shadow-card)] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 border-b border-[var(--color-border)] pb-4">
            <div>
              <p className="eyebrow text-xs">Decodificação Angular SGD</p>
              <h2 className="text-2xl font-bold text-[var(--color-fg)]">
                Funil de Status do Fornecedor ({TOTAL_HISTORICAL_QUOTES.toLocaleString("pt-BR")} cotações)
              </h2>
            </div>
            <span className="text-xs font-semibold text-[var(--color-fg-muted)]">
              Auditoria: {AUDIT_DATE} · Total: 100%
            </span>
          </div>

          {/* Barra Visual de Proporção */}
          <div className="space-y-2">
            <div className="flex h-5 w-full overflow-hidden rounded-lg bg-[var(--color-bg-subtle)] p-0.5 border border-[var(--color-border)]">
              <div className="bg-emerald-500 w-[0.1%] transition-all" title="Aprovada: 0" />
              <div className="bg-amber-500 w-[0.1%] transition-all" title="Enviada: 1" />
              <div className="bg-fuchsia-600 w-[0.2%] transition-all" title="Não enviada: 11" />
              <div className="bg-red-500 w-[13.1%] transition-all" title="Recusada: 23.591 (13.1%)" />
              <div className="bg-rose-400 w-[2.6%] transition-all" title="Cancelada: 4.693 (2.6%)" />
              <div className="bg-slate-500 w-[84.3%] transition-all" title="Prazo Encerrado: 152.155 (84.3%)" />
            </div>
            <div className="flex flex-wrap items-center justify-between text-xs text-[var(--color-fg-muted)]">
              <span>🟩 0% Aprovadas</span>
              <span>🟥 13,1% Recusadas</span>
              <span>🟪 0,2% Abertas</span>
              <span>⬜ 84,3% Prazo Encerrado (Sem Lance)</span>
            </div>
          </div>

          {/* Grid dos 6 Status */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STATUS_VOCABULARY.map((status) => (
              <div
                className="flex flex-col justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-5 transition-all hover:border-[var(--color-border)]/80"
                key={status.code}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded-md border px-2.5 py-0.5 text-xs font-extrabold ${status.badgeClass}`}>
                      {status.code} · {status.label}
                    </span>
                    <span className="text-xs font-bold tabular-nums text-[var(--color-fg-muted)]">
                      {status.pct}
                    </span>
                  </div>

                  <p className="mt-3 text-3xl font-black tabular-nums text-[var(--color-fg)]">
                    {status.count.toLocaleString("pt-BR")}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--color-fg-muted)]">
                    {status.meaning}
                  </p>
                </div>

                <div className="mt-4 border-t border-[var(--color-border)] pt-3 text-[11px] font-semibold text-slate-300">
                  💡 <span className="text-[var(--color-primary)]">Ação:</span> {status.supplierAction}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/20 p-4 text-xs leading-relaxed text-fuchsia-200">
            <strong>Descoberta técnica:</strong> O código Angular do portal revela a cor nativa da rede como <code>#7F1A6B</code> (roxo SGD). O status <code>RECU</code> (Recusada) é registrado exclusivamente após julgamento da escola (não há botão do fornecedor para "declinar"). Portanto, <strong>23.591 propostas foram avaliadas e reprovadas</strong> pela administração escolar.
          </div>
        </section>

        {/* SEÇÃO 2: A Armadilha do Preço de Referência */}
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 sm:p-8 shadow-[var(--shadow-card)] space-y-6">
          <div className="border-b border-[var(--color-border)] pb-4">
            <div className="flex items-center gap-2">
              <span className="eyebrow text-amber-400">Qualidade de Dados & Alerta de Precificação</span>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                Inconsistência Comprovada
              </span>
            </div>
            <h2 className="mt-1 text-2xl font-bold text-[var(--color-fg)]">
              A Armadilha do Preço de Referência do SGD
            </h2>
            <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
              Por que o valor de referência do portal NÃO deve ser utilizado como benchmark para cálculo de desconto.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Card Alerta 95.8% */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-5 space-y-3">
              <div className="text-3xl font-black text-amber-400 tabular-nums">95,8%</div>
              <h3 className="font-bold text-[var(--color-fg)]">
                Vencedores &quot;acima&quot; da referência
              </h3>
              <p className="text-xs leading-relaxed text-slate-300">
                Em 2.779 cruzamentos reais, 2.663 vencedores homologados aparecem acima da referência (48,7% com mais de 100x). Em envelope fechado isso é estruturalmente impossível, comprovando inconsistência no dado de origem.
              </p>
            </div>

            {/* Card Causa Raiz */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-5 space-y-3">
              <div className="text-2xl font-black text-[var(--color-primary)]">Causa Raiz</div>
              <h3 className="font-bold text-[var(--color-fg)]">Total de Lote × Unitário & Placeholders</h3>
              <p className="text-xs leading-relaxed text-[var(--color-fg-muted)]">
                O portal frequentemente insere o <strong>valor total do lote</strong> na descrição do item ou usa valores de preenchimento (R$ 1,00 / R$ 5,00), distorcendo a multiplicação por quantidade.
              </p>
            </div>

            {/* Subconjunto Confiável */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-5 space-y-3">
              <div className="text-3xl font-black text-emerald-400 tabular-nums">~20%</div>
              <h3 className="font-bold text-[var(--color-fg)]">Desconto Real Típico do Vencedor</h3>
              <p className="text-xs leading-relaxed text-slate-300">
                No subconjunto sanitizado (85 cotações com ratio válido entre 0,3 e 1,0), a mediana de desconto dos concorrentes vencedores é de <strong>20% abaixo do preço de referência</strong> (P25: 33,1%).
              </p>
            </div>
          </div>

          {/* Tabela de Desconto por Categoria no Subconjunto Válido */}
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 text-[var(--color-fg-muted)]">
                <tr>
                  <th className="p-3 font-bold uppercase">Grupo de Despesa</th>
                  <th className="p-3 font-bold uppercase text-center">Amostra Válida</th>
                  <th className="p-3 font-bold uppercase text-right">Desconto Mediano Vencedor</th>
                  <th className="p-3 font-bold uppercase">Comportamento de Preço</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] font-medium">
                <tr>
                  <td className="p-3 font-bold text-[var(--color-fg)]">Material de Consumo Geral</td>
                  <td className="p-3 text-center tabular-nums">18</td>
                  <td className="p-3 text-right font-bold text-emerald-400 tabular-nums">32,8% abaixo</td>
                  <td className="p-3 text-[var(--color-fg-muted)]">Maior agressividade de preço entre fornecedores</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[var(--color-fg)]">Equipamentos Tecnológicos</td>
                  <td className="p-3 text-center tabular-nums">4</td>
                  <td className="p-3 text-right font-bold text-emerald-400 tabular-nums">25,6% abaixo</td>
                  <td className="p-3 text-[var(--color-fg-muted)]">Concorrência média, oportunidade em informática</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[var(--color-fg)]">Gêneros Alimentícios</td>
                  <td className="p-3 text-center tabular-nums">33</td>
                  <td className="p-3 text-right font-bold text-emerald-400 tabular-nums">13,8% abaixo</td>
                  <td className="p-3 text-[var(--color-fg-muted)]">Margem menor, dominada por cooperativas PNAE</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[var(--color-fg)]">Conservação e Pequenos Reparos</td>
                  <td className="p-3 text-center tabular-nums">10</td>
                  <td className="p-3 text-right font-bold text-emerald-400 tabular-nums">6,0% abaixo</td>
                  <td className="p-3 text-[var(--color-fg-muted)]">Propostas muito próximas da referência da escola</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* SEÇÃO 3: Filtro de Viabilidade & Prazos Impossíveis */}
        <section className="grid gap-6 lg:grid-cols-2">
          {/* Prazos Impossíveis */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-[var(--shadow-card)] space-y-4">
            <div className="flex items-center gap-2">
              <span className="eyebrow text-red-400">Gargalo Logístico</span>
            </div>
            <h2 className="text-xl font-bold text-[var(--color-fg)]">
              41,3% dos Prazos são Estruturalmente Impossíveis
            </h2>
            <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed">
              Em 18.046 cotações verificadas na base de dados:
            </p>

            <div className="space-y-3">
              <div className="rounded-xl border border-red-500/30 bg-red-950/15 p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-[var(--color-fg)]">Proposta = Entrega no mesmo dia</p>
                  <p className="text-xs text-slate-300">Prazo de envio igual à data de entrega</p>
                </div>
                <span className="text-2xl font-extrabold text-red-400 tabular-nums">7.448 (41,3%)</span>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-[var(--color-fg)]">Entrega em menos de 48h</p>
                  <p className="text-xs text-slate-300">Tempo de mobilização pós-homologação inviável</p>
                </div>
                <span className="text-2xl font-extrabold text-amber-400 tabular-nums">8.187 (45,4%)</span>
              </div>
            </div>

            <p className="text-xs text-[var(--color-fg-muted)] italic">
              <strong>Conclusão operacional:</strong> Não enviar proposta nessas cotações é uma decisão racional de proteção contra multas contratuais.
            </p>
          </div>

          {/* Cotações Bloqueadas e Lead Time */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-[var(--shadow-card)] space-y-4">
            <div className="flex items-center gap-2">
              <span className="eyebrow text-fuchsia-400">Filtragem de Ruído</span>
            </div>
            <h2 className="text-xl font-bold text-[var(--color-fg)]">
              2.084 Cotações Bloqueadas ou Suspeitas
            </h2>
            <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed">
              Nem toda oportunidade aberta é real. 11,5% da base contém instruções de bloqueio:
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4">
                <p className="text-2xl font-bold text-amber-400 tabular-nums">586</p>
                <p className="text-xs font-semibold text-[var(--color-fg)] mt-1">Bloqueadas expressas</p>
                <p className="text-[11px] text-[var(--color-fg-muted)] mt-0.5">Texto manda explicitamente não lanciar</p>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4">
                <p className="text-2xl font-bold text-slate-300 tabular-nums">1.498</p>
                <p className="text-xs font-semibold text-[var(--color-fg)] mt-1">Padrão suspeito</p>
                <p className="text-[11px] text-[var(--color-fg-muted)] mt-0.5">Regularizações internas ou itens zerados</p>
              </div>
            </div>

            <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-3 text-xs text-blue-200">
              ⚡ <strong>Janela útil de envio:</strong> As cotações abertas reais têm lead time mediano de <strong>4,1 dias</strong> (39% com menos de 72h). A agilidade de envio é o fator crítico.
            </div>
          </div>
        </section>

        {/* SEÇÃO 4: Concentração de Mercado & Histórico de Concorrentes */}
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 sm:p-8 shadow-[var(--shadow-card)] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 border-b border-[var(--color-border)] pb-4">
            <div>
              <p className="eyebrow text-emerald-400">Inteligência Competitiva</p>
              <h2 className="text-2xl font-bold text-[var(--color-fg)]">
                Estrutura de Mercado: Cauda Longa, não Monopólio
              </h2>
            </div>
            <span className="text-xs font-bold text-[var(--color-fg-muted)]">
              11.695 pedidos · 1.648 fornecedores
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-5 space-y-2">
              <span className="eyebrow text-xs">Concentração Top 5</span>
              <p className="text-3xl font-extrabold text-[var(--color-fg)] tabular-nums">13,7%</p>
              <p className="text-xs text-[var(--color-fg-muted)]">
                Os 5 maiores fornecedores respondem por apenas 13,7% dos pedidos e 24,9% do valor total.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-5 space-y-2">
              <span className="eyebrow text-xs">Concentração Top 20</span>
              <p className="text-3xl font-extrabold text-[var(--color-fg)] tabular-nums">26,5%</p>
              <p className="text-xs text-[var(--color-fg-muted)]">
                Os 20 maiores levam 26,5% dos pedidos (40,1% do valor). Mercado altamente pulverizado.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-5 space-y-2">
              <span className="eyebrow text-xs">Lealdade da Escola</span>
              <p className="text-3xl font-extrabold text-[var(--color-fg)] tabular-nums">14,2%</p>
              <p className="text-xs text-[var(--color-fg-muted)]">
                Mediana de pedidos do principal fornecedor por escola. Não há barreira de entrada intransponível.
              </p>
            </div>
          </div>

          {/* Aviso sobre histórico em produção */}
          {!hasHistoryData ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-5 text-sm text-[var(--color-fg-muted)] space-y-2">
              <p className="font-bold text-[var(--color-fg)]">
                ℹ️ Status da base de homologados em produção
              </p>
              <p className="text-xs leading-relaxed">
                A base de compras adjudicadas (tabela <code>opportunities</code>) está atualmente sendo sincronizada pelo coletor de dados na produção (Neon). Os números acima representam o consolidado auditado da Região Metropolitana de BH.
              </p>
            </div>
          ) : (
            <div className="text-xs text-[var(--color-success)] font-semibold">
              ✓ {liveHistoryCount.toLocaleString("pt-BR")} compras adjudicadas carregadas na base.
            </div>
          )}
        </section>

        {/* SEÇÃO 5: Saúde da Infraestrutura de Coleta */}
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 sm:p-8 shadow-[var(--shadow-card)] space-y-6">
          <div className="border-b border-[var(--color-border)] pb-4">
            <p className="eyebrow text-red-400">Infraestrutura & Pipeline</p>
            <h2 className="text-2xl font-bold text-[var(--color-fg)]">
              Saúde do Sincronizador Diário
            </h2>
            <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
              Métricas operacionais de execução e oportunidades perdidas por instabilidade técnica.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-red-500/30 bg-red-950/15 p-5">
              <span className="text-xs font-bold text-red-300">Runs Travados</span>
              <p className="mt-2 text-3xl font-black text-red-400 tabular-nums">4</p>
              <p className="mt-1 text-xs text-slate-300">
                Execuções presas em status <code>running</code> sem finalização no banco.
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-5">
              <span className="text-xs font-bold text-amber-300">Abertas já Vencidas</span>
              <p className="mt-2 text-3xl font-black text-amber-400 tabular-nums">93</p>
              <p className="mt-1 text-xs text-slate-300">
                Cotações marcadas como <code>NAEN</code> cujo prazo já expirou (dado defasado).
              </p>
            </div>

            <div className="rounded-xl border border-slate-500/30 bg-slate-800/30 p-5">
              <span className="text-xs font-bold text-slate-300">Perdidas no Outage</span>
              <p className="mt-2 text-3xl font-black text-slate-300 tabular-nums">252</p>
              <p className="mt-1 text-xs text-slate-400">
                Cotações que venceram durante o apagão do sync de 14/08 a 18/08.
              </p>
            </div>
          </div>
        </section>

        {/* SEÇÃO 6: Plano de Ação Estratégico */}
        <section className="rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-bg)] p-6 sm:p-8 shadow-xl space-y-6">
          <div>
            <span className="eyebrow text-[var(--color-primary)]">Direcionamento Prático</span>
            <h2 className="text-2xl font-bold text-[var(--color-fg)]">
              Plano de Ação para Virar o Jogo
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Coluna Fornecedor */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-5 space-y-3">
              <h3 className="text-base font-bold text-[var(--color-fg)] flex items-center gap-2">
                <span>🎯</span> Para o Fornecedor (Comercial)
              </h3>
              <ul className="space-y-2 text-xs text-slate-300 leading-relaxed list-disc list-inside">
                <li>
                  <strong>Pare de aplicar desconto sobre a referência:</strong> Precifique pelo seu custo real e margem, pois a referência do portal é inconsistente.
                </li>
                <li>
                  <strong>Aja rápido nas cotações abertas:</strong> O lead time mediano é de 4 dias. Priorize o envio assim que o card aparecer.
                </li>
                <li>
                  <strong>Descarte os 41% de prazo impossível:</strong> Evite cotações com entrega no mesmo dia para não incorrer em penalidades.
                </li>
                <li>
                  <strong>Foque em Material de Consumo e TI:</strong> Evite disputar Alimentação com cooperativas de agricultura familiar (reserva legal PNAE).
                </li>
              </ul>
            </div>

            {/* Coluna Produto & Engenharia */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-5 space-y-3">
              <h3 className="text-base font-bold text-[var(--color-fg)] flex items-center gap-2">
                <span>⚙️</span> Para a Plataforma (Engenharia)
              </h3>
              <ul className="space-y-2 text-xs text-slate-300 leading-relaxed list-disc list-inside">
                <li>
                  <strong>Tratamento de pool de conexões:</strong> Adicionar <code>pool.on(&apos;error&apos;)</code> no backend para evitar que o cron morra silenciosamente.
                </li>
                <li>
                  <strong>Expurgo automático de prazos vencidos:</strong> Marcar como <code>FORA</code> cotações cujo deadline passou.
                </li>
                <li>
                  <strong>Classificação de lote no coletor:</strong> Não multiplicar referência por quantidade quando o valor for total do lote.
                </li>
                <li>
                  <strong>Sincronização de histórico na produção:</strong> Popular <code>opportunities</code> no Neon para liberar inteligência de concorrentes.
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function KpiMiniCard({
  label,
  value,
  sub,
  highlight = false,
  alert = false
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-emerald-500/40 bg-emerald-950/20"
          : alert
            ? "border-red-500/40 bg-red-950/20"
            : "border-[var(--color-border)] bg-[var(--color-bg)]"
      }`}
    >
      <p className="eyebrow text-[10px] text-[var(--color-fg-muted)]">{label}</p>
      <p
        className={`mt-1 text-2xl font-black tabular-nums ${
          highlight ? "text-emerald-400" : alert ? "text-red-400" : "text-[var(--color-fg)]"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">{sub}</p>
    </div>
  );
}
