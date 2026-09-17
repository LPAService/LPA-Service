import React from "react";
import Link from "next/link";
import type { BidsReportData, BidLossDetailItem } from "@/lib/data/bids-report";

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function BidsReportSection({ data }: { data: BidsReportData | null }) {
  if (!data || !data.hasBids || data.totalBids === 0) {
    return (
      <section
        aria-label="Por que estou perdendo"
        className="rounded-2xl border-2 border-[var(--color-primary)]/40 bg-[var(--color-bg)] p-6 sm:p-8 shadow-xl space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 border-b border-[var(--color-border)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="eyebrow text-[var(--color-primary)]">Raio-X de Lances · Lance a Lance</span>
              <span className="rounded-full bg-[var(--color-primary)]/15 px-2.5 py-0.5 text-[10px] font-bold text-[var(--color-primary)]">
                Auditoria de Propostas
              </span>
            </div>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-[var(--color-fg)] sm:text-3xl">
              Por que eu estou perdendo?
            </h2>
          </div>
          <p className="text-xs text-[var(--color-fg-muted)]">
            Diagnóstico comercial lance a lance: funil, distância do vencedor e viabilidade de margem
          </p>
        </div>

        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)]/50 p-8 text-center space-y-3">
          <div className="text-3xl">📋</div>
          <h3 className="text-base font-bold text-[var(--color-fg)]">
            Nenhum lance registrado até o momento
          </h3>
          <p className="mx-auto max-w-xl text-xs text-[var(--color-fg-muted)] leading-relaxed">
            Esta seção analisa os orçamentos onde sua empresa enviou proposta (status <code className="font-mono font-bold text-[var(--color-fg)]">ENVI</code>)
            e se preenche automaticamente conforme os lances forem detectados e os resultados publicados no portal Caixa Escolar MG.
          </p>
        </div>
      </section>
    );
  }

  const { funnel, distance, marginFeasibility, recurrence, competition, lossDetails } = data;

  return (
    <section
      aria-label="Por que estou perdendo"
      className="rounded-2xl border-2 border-[var(--color-primary)]/40 bg-[var(--color-bg)] p-6 sm:p-8 shadow-xl space-y-8"
    >
      {/* 0. Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 border-b border-[var(--color-border)] pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="eyebrow text-[var(--color-primary)]">Raio-X de Lances · Lance a Lance</span>
            <span className="rounded-full bg-[var(--color-primary)]/15 px-2.5 py-0.5 text-[10px] font-bold text-[var(--color-primary)]">
              {formatNumber(data.totalBids)} Lances Monitorados
            </span>
            {funnel.perdido > 0 && (
              <span className="rounded-full bg-[var(--color-danger)]/15 px-2.5 py-0.5 text-[10px] font-bold text-[var(--color-danger)]">
                {formatNumber(funnel.perdido)} Perdas Analisadas
              </span>
            )}
          </div>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-[var(--color-fg)] sm:text-3xl">
            Por que eu estou perdendo?
          </h2>
        </div>
        <p className="text-xs text-[var(--color-fg-muted)]">
          Auditoria comercial de cada lance: funil, distância do vencedor, viabilidade de margem e concorrentes
        </p>
      </div>

      {/* 1. Funil dos Lances + Honestidade Obrigatória */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="eyebrow text-xs text-[var(--color-primary)]">Item 1 · Pipeline de Lances</span>
            <h3 className="text-base font-bold text-[var(--color-fg)]">Funil dos Lances Enviados</h3>
          </div>
          <span className="text-xs text-[var(--color-fg-muted)]">
            Total de propostas enviadas: <strong className="text-[var(--color-fg)]">{formatNumber(funnel.total)}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {/* Pendente */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <p className="eyebrow text-[10px] text-[var(--color-fg-muted)]">Pendente</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[var(--color-fg)]">
              {formatNumber(funnel.pendente)}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">Aguardando homologação</p>
          </div>

          {/* Perdido */}
          <div className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-bg-subtle)] p-4">
            <p className="eyebrow text-[10px] text-[var(--color-danger)]">Perdido</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[var(--color-danger)]">
              {formatNumber(funnel.perdido)}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">Ata de perda homologada</p>
          </div>

          {/* Sem Resultado */}
          <div className="rounded-xl border border-amber-500/40 bg-[var(--color-bg-subtle)] p-4">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-[10px] text-amber-500">Sem Resultado</p>
              <span className="text-[10px]" title="Envelope fechado sem ata">🔒</span>
            </div>
            <p className="mt-1 text-2xl font-black tabular-nums text-amber-400">
              {formatNumber(funnel.semResultado)}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">Prazo expirou sem publicação</p>
          </div>

          {/* Cancelado */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <p className="eyebrow text-[10px] text-[var(--color-fg-muted)]">Cancelado</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[var(--color-fg-muted)]">
              {formatNumber(funnel.cancelado)}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">Processo cancelado na origem</p>
          </div>

          {/* Ganho */}
          <div className="rounded-xl border border-emerald-500/30 bg-[var(--color-bg)] p-4">
            <p className="eyebrow text-[10px] text-emerald-500">Ganho</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-emerald-400">
              {formatNumber(funnel.ganho)}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">0 vitórias públicas confirmadas</p>
          </div>
        </div>

        {/* Banner de Honestidade Obrigatória sobre Envelope Fechado */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-[var(--color-fg)] leading-relaxed space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-400">
            <span>⚠️</span>
            <span>Honestidade Obrigatória sobre a Fonte (Envelope Fechado):</span>
          </div>
          <p className="text-[var(--color-fg-muted)]">
            O portal Caixa Escolar MG opera em envelope fechado e <strong>só publica de forma confiável o relatório de perdas</strong> (quando outro fornecedor vence).
            O estado <strong className="text-amber-400">&quot;Sem Resultado&quot;</strong> significa que o prazo da cotação expirou sem publicação de ata de homologação — <strong>não significa vitória nem derrota</strong>, e nunca é somado como taxa de sucesso.
            A métrica <strong className="text-emerald-400">&quot;Ganho&quot;</strong> permanece em 0 porque a fonte pública não disponibiliza lista pública de homologações vencidas para o próprio participante.
          </p>
        </div>
      </div>

      {/* 2. Distância do Vencedor (Preço x Margem) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
          <div>
            <span className="eyebrow text-xs text-[var(--color-danger)]">Item 2 · Distância do Vencedor</span>
            <h3 className="text-base font-bold text-[var(--color-fg)]">
              Distribuição da Diferença de Preço (R$ e %)
            </h3>
          </div>
          <p className="text-xs text-[var(--color-fg-muted)]">
            Diz com clareza se a perda foi por ajuste fino de margem ou por descolamento de custo
          </p>
        </div>

        {distance.totalWithKnownWinner === 0 ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-5 text-center text-xs text-[var(--color-fg-muted)]">
            Sem dados de vencedor homologado para os lances perdidos até o momento.
          </div>
        ) : (
          <>
            {/* 3 Buckets de Distribuição */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {/* < 5% */}
              <div className="rounded-xl border border-emerald-500/40 bg-[var(--color-bg-subtle)] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="eyebrow text-[10px] text-emerald-400 font-black">Disputa no Detalhe (&lt; 5%)</span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                    {formatPercent(distance.under5PctShare)}
                  </span>
                </div>
                <p className="text-2xl font-black tabular-nums text-emerald-400">
                  {formatNumber(distance.under5PctCount)} perdas
                </p>
                <p className="text-[11px] text-[var(--color-fg-muted)] leading-snug">
                  Diferença de até 5% em relação ao vencedor. Disputas decididas na margem mínima ou no valor do frete.
                </p>
              </div>

              {/* 5% a 15% */}
              <div className="rounded-xl border border-amber-500/40 bg-[var(--color-bg-subtle)] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="eyebrow text-[10px] text-amber-400 font-black">Distância Moderada (5% a 15%)</span>
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-300">
                    {formatPercent(distance.between5And15PctShare)}
                  </span>
                </div>
                <p className="text-2xl font-black tabular-nums text-amber-400">
                  {formatNumber(distance.between5And15PctCount)} perdas
                </p>
                <p className="text-[11px] text-[var(--color-fg-muted)] leading-snug">
                  Diferença moderada. Perdas com alta probabilidade de reversão calibando a margem da pré-cotação.
                </p>
              </div>

              {/* > 15% */}
              <div className="rounded-xl border border-rose-500/40 bg-[var(--color-bg-subtle)] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="eyebrow text-[10px] text-rose-400 font-black">Distância Alta (&gt; 15%)</span>
                  <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-black text-rose-300">
                    {formatPercent(distance.over15PctShare)}
                  </span>
                </div>
                <p className="text-2xl font-black tabular-nums text-rose-400">
                  {formatNumber(distance.over15PctCount)} perdas
                </p>
                <p className="text-[11px] text-[var(--color-fg-muted)] leading-snug">
                  Diferença expressiva. Ceder margem não é suficiente; indica descolamento no custo de aquisição ou erro de catálogo.
                </p>
              </div>
            </div>

            {/* KPIs Resumo da Distância */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <p className="eyebrow text-[10px] text-[var(--color-fg-muted)]">Diferença Mediana (%)</p>
                <p className="mt-1 text-lg font-black tabular-nums text-[var(--color-fg)]">
                  {distance.medianGapPercent !== null ? `+${formatPercent(distance.medianGapPercent)}` : "—"}
                </p>
                <p className="text-[10px] text-[var(--color-fg-muted)]">Média: +{formatPercent(distance.avgGapPercent)}</p>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <p className="eyebrow text-[10px] text-[var(--color-fg-muted)]">Diferença Mediana (R$)</p>
                <p className="mt-1 text-lg font-black tabular-nums text-[var(--color-fg)]">
                  {distance.medianGapAmount !== null ? `+${formatCurrency(distance.medianGapAmount)}` : "—"}
                </p>
                <p className="text-[10px] text-[var(--color-fg-muted)]">Média: +{formatCurrency(distance.avgGapAmount)}</p>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <p className="eyebrow text-[10px] text-[var(--color-fg-muted)]">Acima do Vencedor</p>
                <p className="mt-1 text-lg font-black tabular-nums text-[var(--color-danger)]">
                  {formatNumber(distance.moreExpensiveCount)} de {formatNumber(distance.totalWithKnownWinner)}
                </p>
                <p className="text-[10px] text-[var(--color-fg-muted)]">Perdidas no preço</p>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <p className="eyebrow text-[10px] text-[var(--color-fg-muted)]">Preço Menor ou Igual</p>
                <p className="mt-1 text-lg font-black tabular-nums text-emerald-400">
                  {formatNumber(distance.cheaperOrEqualCount)}
                </p>
                <p className="text-[10px] text-[var(--color-fg-muted)]">Desclassificação técnica / edital</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 3. Margem que teria ganhado (Viabilidade Econômica) */}
      <div className="space-y-4">
        <div>
          <span className="eyebrow text-xs text-emerald-400">Item 3 · Simulação de Margem</span>
          <h3 className="text-base font-bold text-[var(--color-fg)]">
            Margem que Teria Ganhado: O que era reversível?
          </h3>
          <p className="text-xs text-[var(--color-fg-muted)]">
            Calculado a partir do custo base e margem cadastrada: quantas perdas foram reversíveis cedendo margem vs quantas o concorrente vendeu abaixo do nosso custo
          </p>
        </div>

        {marginFeasibility.totalEvaluated === 0 ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-5 text-center text-xs text-[var(--color-fg-muted)]">
            Sem propostas perdidas com margem e vencedor cadastrados para simulação.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Reversíveis */}
            <div className="rounded-xl border-2 border-emerald-500/40 bg-[var(--color-bg-subtle)] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 text-lg font-bold">✓</span>
                  <span className="eyebrow text-xs text-emerald-400 font-bold">Reversíveis Cedendo Margem</span>
                </div>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-black text-emerald-300">
                  {formatPercent(marginFeasibility.reversiblePct)} das perdas
                </span>
              </div>
              <p className="text-3xl font-black tabular-nums text-emerald-400">
                {formatNumber(marginFeasibility.reversibleCount)} de {formatNumber(marginFeasibility.totalEvaluated)}
              </p>
              <p className="text-xs text-[var(--color-fg)] leading-relaxed">
                Nesses processos, o preço do vencedor ficou <strong>acima do nosso custo base</strong>.
                Se tivéssemos reduzido nossa margem para uma média de{" "}
                <strong className="text-emerald-400">
                  {marginFeasibility.avgMarginToWinReversible !== null
                    ? `${formatPercent(marginFeasibility.avgMarginToWinReversible)}`
                    : "—"}
                </strong>{" "}
                (mediana: {formatPercent(marginFeasibility.medianMarginToWinReversible)}), o lance teria batido o concorrente mantendo lucro positivo.
              </p>
            </div>

            {/* Irreversíveis por Custo */}
            <div className="rounded-xl border-2 border-rose-500/40 bg-[var(--color-bg-subtle)] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-rose-400 text-lg font-bold">✕</span>
                  <span className="eyebrow text-xs text-rose-400 font-bold">Irreversíveis (Vencedor Abaixo do Custo)</span>
                </div>
                <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-black text-rose-300">
                  {formatPercent(marginFeasibility.belowCostPct)} das perdas
                </span>
              </div>
              <p className="text-3xl font-black tabular-nums text-rose-400">
                {formatNumber(marginFeasibility.belowCostCount)} de {formatNumber(marginFeasibility.totalEvaluated)}
              </p>
              <p className="text-xs text-[var(--color-fg)] leading-relaxed">
                Nesses processos, o concorrente homologou um valor <strong>inferior ao nosso custo de aquisição</strong>.
                Mesmo com margem de <strong>0% (vendendo a preço de custo)</strong>, não teríamos vencido. Exige negociar compra direta com fabricante ou trocar marca de catálogo.
              </p>
            </div>
          </div>
        )}

        {marginFeasibility.noMarginDataCount > 0 && (
          <p className="text-[11px] text-[var(--color-fg-muted)]">
            ℹ️ <strong>{formatNumber(marginFeasibility.noMarginDataCount)}</strong> perdas não tinham percentual de margem associado no pré-orçamento e não puderam ser categorizadas entre reversíveis/custo.
          </p>
        )}
      </div>

      {/* 4. Recorrência: Por Categoria, Município e Concorrente */}
      <div className="space-y-4">
        <div>
          <span className="eyebrow text-xs text-[var(--color-primary)]">Item 4 · Recorrência</span>
          <h3 className="text-base font-bold text-[var(--color-fg)]">
            Onde e Contra Quem Você Mais Perde
          </h3>
          <p className="text-xs text-[var(--color-fg-muted)]">
            Concentração de perdas por grupo de despesa, cidade e principais adversários
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Por Grupo de Despesa */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="eyebrow text-[10px] text-[var(--color-primary)]">Por Grupo de Despesa</span>
              <span className="text-[10px] text-[var(--color-fg-muted)]">{formatNumber(recurrence.byExpenseGroup.length)} grupos</span>
            </div>
            {recurrence.byExpenseGroup.length === 0 ? (
              <p className="text-xs text-[var(--color-fg-muted)]">Sem dados de grupo.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)]">
                    <tr>
                      <th className="p-2 font-bold uppercase">Grupo</th>
                      <th className="p-2 font-bold uppercase text-center">Perdas</th>
                      <th className="p-2 font-bold uppercase text-right">Gap Med.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] font-medium">
                    {recurrence.byExpenseGroup.slice(0, 5).map((row) => (
                      <tr className="hover:bg-[var(--color-bg-subtle)]/50" key={row.expenseGroup}>
                        <td className="p-2 font-bold text-[var(--color-fg)] truncate max-w-[130px]" title={row.expenseGroup}>
                          {row.expenseGroup}
                        </td>
                        <td className="p-2 text-center font-bold tabular-nums text-[var(--color-danger)]">
                          {formatNumber(row.lossCount)}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-[var(--color-fg)]">
                          {row.medianGapPercent !== null ? `+${formatPercent(row.medianGapPercent)}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Por Município */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="eyebrow text-[10px] text-amber-500">Por Município</span>
              <span className="text-[10px] text-[var(--color-fg-muted)]">{formatNumber(recurrence.byCounty.length)} cidades</span>
            </div>
            {recurrence.byCounty.length === 0 ? (
              <p className="text-xs text-[var(--color-fg-muted)]">Sem dados de municípios.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)]">
                    <tr>
                      <th className="p-2 font-bold uppercase">Cidade</th>
                      <th className="p-2 font-bold uppercase text-center">Perdas</th>
                      <th className="p-2 font-bold uppercase text-right">Gap Med.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] font-medium">
                    {recurrence.byCounty.slice(0, 5).map((row) => (
                      <tr className="hover:bg-[var(--color-bg-subtle)]/50" key={row.countyName}>
                        <td className="p-2 font-bold text-[var(--color-fg)] truncate max-w-[130px]" title={row.countyName}>
                          {row.countyName}
                        </td>
                        <td className="p-2 text-center font-bold tabular-nums text-amber-400">
                          {formatNumber(row.lossCount)}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-[var(--color-fg)]">
                          {row.medianGapPercent !== null ? `+${formatPercent(row.medianGapPercent)}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Por Concorrente Vencedor */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="eyebrow text-[10px] text-rose-400">Quem Mais Vence Contra Nós</span>
              <span className="text-[10px] text-[var(--color-fg-muted)]">{formatNumber(recurrence.byWinner.length)} concorrentes</span>
            </div>
            {recurrence.byWinner.length === 0 ? (
              <p className="text-xs text-[var(--color-fg-muted)]">Sem concorrentes registrados.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)]">
                    <tr>
                      <th className="p-2 font-bold uppercase">Concorrente</th>
                      <th className="p-2 font-bold uppercase text-center">Vitórias</th>
                      <th className="p-2 font-bold uppercase text-right">Gap Med.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] font-medium">
                    {recurrence.byWinner.slice(0, 5).map((row) => (
                      <tr className="hover:bg-[var(--color-bg-subtle)]/50" key={row.winnerName}>
                        <td className="p-2 font-bold text-[var(--color-fg)] truncate max-w-[130px]" title={row.winnerName}>
                          {row.winnerName}
                        </td>
                        <td className="p-2 text-center font-bold tabular-nums text-rose-400">
                          {formatNumber(row.lossCount)}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-[var(--color-fg)]">
                          {row.medianGapPercent !== null ? `+${formatPercent(row.medianGapPercent)}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Competição: Rank Médio e Concorrentes Típicos */}
      <div className="space-y-4">
        <div>
          <span className="eyebrow text-xs text-[var(--color-primary)]">Item 5 · Posicionamento Competitivo</span>
          <h3 className="text-base font-bold text-[var(--color-fg)]">
            Nosso Rank Médio e Concorrência Típica
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <p className="eyebrow text-[10px] text-[var(--color-fg-muted)]">Rank Médio na Disputa</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[var(--color-fg)]">
              {competition.avgRank !== null ? `${competition.avgRank.toFixed(1).replace(".", ",")}º` : "—"}
            </p>
            <p className="text-[11px] text-[var(--color-fg-muted)]">
              Mediana: {competition.medianRank !== null ? `${competition.medianRank}º lugar` : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-[var(--color-bg)] p-4">
            <p className="eyebrow text-[10px] text-emerald-400">Vice-Campeão (2º Lugar)</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-emerald-400">
              {formatNumber(competition.rank2Count)}
            </p>
            <p className="text-[11px] text-[var(--color-fg-muted)]">Disputas perdidas no último degrau</p>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <p className="eyebrow text-[10px] text-[var(--color-fg-muted)]">Concorrentes por Disputa</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[var(--color-fg)]">
              {competition.avgCompetitorCount !== null ? competition.avgCompetitorCount.toFixed(1).replace(".", ",") : "—"}
            </p>
            <p className="text-[11px] text-[var(--color-fg-muted)]">
              Mediana: {competition.medianCompetitorCount ?? "—"} fornecedores
            </p>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <p className="eyebrow text-[10px] text-[var(--color-fg-muted)]">Duelos Diretos (1x1)</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[var(--color-fg)]">
              {formatNumber(competition.duelsCount)}
            </p>
            <p className="text-[11px] text-[var(--color-fg-muted)]">Apenas 2 concorrentes na disputa</p>
          </div>
        </div>
      </div>

      {/* 6. Tabela Lance a Lance */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
          <div>
            <span className="eyebrow text-xs text-[var(--color-danger)]">Item 6 · Detalhamento Completo</span>
            <h3 className="text-base font-bold text-[var(--color-fg)]">
              Auditoria Lance a Lance
            </h3>
          </div>
          <p className="text-xs text-[var(--color-fg-muted)]">
            {formatNumber(lossDetails.length)} propostas perdidas com diagnóstico individual de reversibilidade
          </p>
        </div>

        {lossDetails.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-6 text-center text-xs text-[var(--color-fg-muted)]">
            Nenhuma proposta perdida individualmente para listar.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)]">
                <tr>
                  <th className="p-3 font-bold uppercase">Cotação / Escola</th>
                  <th className="p-3 font-bold uppercase">Grupo / Cidade</th>
                  <th className="p-3 font-bold uppercase text-right">Nosso Lance</th>
                  <th className="p-3 font-bold uppercase text-right">Vencedor Homologado</th>
                  <th className="p-3 font-bold uppercase text-right">Diferença</th>
                  <th className="p-3 font-bold uppercase text-center">Margem p/ Vencer</th>
                  <th className="p-3 font-bold uppercase text-center">Diagnóstico</th>
                  <th className="p-3 font-bold uppercase text-center">Rank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] font-medium">
                {lossDetails.map((item) => (
                  <tr className="hover:bg-[var(--color-bg-subtle)]/50 transition-colors" key={item.id}>
                    {/* Cotação / Escola */}
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-[var(--color-fg)]">
                          {item.orderId}
                        </span>
                        <span className="text-[11px] text-[var(--color-fg-muted)] truncate max-w-[180px]" title={item.schoolName || ""}>
                          {item.schoolName || "Escola não identificada"}
                        </span>
                      </div>
                    </td>

                    {/* Grupo / Cidade */}
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-[var(--color-fg)] text-[11px] truncate max-w-[160px]" title={item.expenseGroup}>
                          {item.expenseGroup}
                        </span>
                        <span className="text-[11px] text-[var(--color-fg-muted)]">
                          {item.countyName || "—"}
                        </span>
                      </div>
                    </td>

                    {/* Nosso Lance */}
                    <td className="p-3 text-right tabular-nums">
                      <span className="font-mono font-bold text-[var(--color-fg)]">
                        {formatCurrency(item.ourTotal)}
                      </span>
                      {item.marginPercent !== null && (
                        <span className="block text-[10px] text-[var(--color-fg-muted)]">
                          margem {formatPercent(item.marginPercent)}
                        </span>
                      )}
                    </td>

                    {/* Vencedor Homologado */}
                    <td className="p-3 text-right tabular-nums">
                      <span className="font-mono font-bold text-[var(--color-fg)]">
                        {formatCurrency(item.winnerTotal)}
                      </span>
                      {item.winnerName && (
                        <span className="block text-[10px] text-[var(--color-fg-muted)] truncate max-w-[150px] ml-auto" title={item.winnerName}>
                          {item.winnerName}
                        </span>
                      )}
                    </td>

                    {/* Diferença */}
                    <td className="p-3 text-right tabular-nums">
                      {item.gapPercent !== null ? (
                        <div>
                          <span
                            className={`font-mono font-black ${
                              item.gapPercent <= 5
                                ? "text-emerald-400"
                                : item.gapPercent <= 15
                                  ? "text-amber-400"
                                  : "text-rose-400"
                            }`}
                          >
                            +{formatPercent(item.gapPercent)}
                          </span>
                          <span className="block text-[10px] text-[var(--color-fg-muted)] font-mono">
                            +{formatCurrency(item.gapAmount)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[var(--color-fg-muted)]">—</span>
                      )}
                    </td>

                    {/* Margem p/ Vencer */}
                    <td className="p-3 text-center tabular-nums">
                      {item.marginToWinPercent !== null ? (
                        <span
                          className={`font-mono font-bold text-xs ${
                            item.marginToWinPercent >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {formatPercent(item.marginToWinPercent)}
                        </span>
                      ) : (
                        <span className="text-[var(--color-fg-muted)]">—</span>
                      )}
                    </td>

                    {/* Diagnóstico */}
                    <td className="p-3 text-center">
                      {item.reversibleStatus === "reversivel" ? (
                        <span className="inline-flex items-center rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          Reversível com Margem
                        </span>
                      ) : item.reversibleStatus === "abaixo_custo" ? (
                        <span className="inline-flex items-center rounded-md border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                          Abaixo do Custo Base
                        </span>
                      ) : item.reversibleStatus === "sem_margem" ? (
                        <span className="inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-fg-muted)]">
                          Sem pré-orçamento
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-fg-muted)]">
                          Sem vencedor publicado
                        </span>
                      )}
                    </td>

                    {/* Rank */}
                    <td className="p-3 text-center font-bold tabular-nums text-[var(--color-fg)]">
                      {item.ourRank ? (
                        <span>
                          {item.ourRank}º{item.competitorCount ? ` de ${item.competitorCount}` : ""}
                        </span>
                      ) : (
                        <span className="text-[var(--color-fg-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
