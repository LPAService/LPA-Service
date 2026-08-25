import Link from "next/link";
import { MainNav } from "@/components/main-nav";
import { formatDate, formatOpportunityValue, pluralize } from "@/lib/format/opportunity";
import { PrequoteDeleteButton } from "@/components/prequote/prequote-delete-button";
import { catalogSource } from "@/lib/data/catalog";
import { quotationSource } from "@/lib/data/source";
import { calcPreQuoteTotals, formatBRL } from "@/lib/prequote/calc";

export const metadata = {
  title: "Pré-Orçamento · LPA Leo",
  description: "Monte o custo real de cada licitação com catálogo de fornecedores e busca de preço na internet."
};

export const dynamic = "force-dynamic";

export default async function PreOrcamentoPage() {
  const [openResult, preQuotes] = await Promise.all([
    quotationSource.listOpportunities({ situation: "open" }, { page: 1, pageSize: 48 }),
    catalogSource.listPreQuotes()
  ]);
  const openQuotations = openResult.data.filter((quotation) => quotation.items.length > 0);

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="shell py-8 sm:py-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow text-[var(--color-primary)]">Custo real antes do lance</p>
              <h1 className="mt-2 text-4xl font-bold leading-none tracking-tighter text-[var(--color-fg)] sm:text-5xl">
                Pré-Orçamento.
              </h1>
              <p className="mt-3 max-w-xl text-base text-[var(--color-fg-muted)]">
                Escolha uma cotação aberta e monte o custo real item a item: preço do seu catálogo de fornecedores, valor manual ou o menor preço encontrado na internet.
              </p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-[var(--color-border)] self-end border-y border-[var(--color-border)]">
              <div className="px-4 py-2">
                <p className="text-2xl font-bold tabular-nums text-[var(--color-fg)]">{openQuotations.length}</p>
                <p className="eyebrow mt-1">cotações abertas</p>
              </div>
              <div className="px-4 py-2">
                <p className="text-2xl font-bold tabular-nums text-[var(--color-fg)]">{preQuotes.length}</p>
                <p className="eyebrow mt-1">pré-orçamentos</p>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <MainNav current="preorcamento" />
          </div>
        </div>
      </header>

      <div className="shell space-y-10 py-8">
        <section>
          <h2 className="text-xl font-bold text-[var(--color-fg)]">Pré-orçamentos salvos</h2>
          {preQuotes.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
              Nenhum pré-orçamento ainda. Escolha uma cotação aberta abaixo para começar.
            </p>
          ) : (
            <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {preQuotes.map((preQuote) => {
                const totals = calcPreQuoteTotals(preQuote.items, preQuote.marginPercent, preQuote.freightCost);
                return (
                  <li className="flex flex-col justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 shadow-[var(--shadow-card)]" key={preQuote.id}>
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="eyebrow text-xs">{preQuote.orderId ?? preQuote.quotationExternalId}</p>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${preQuote.status === "closed" ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : "border-amber-500/40 bg-amber-500/15 text-amber-300"}`}>
                          {preQuote.status === "closed" ? "FECHADO" : "RASCUNHO"}
                        </span>
                      </div>
                      <h3 className="mt-1 font-bold leading-snug text-[var(--color-fg)]">
                        {preQuote.schoolName ?? preQuote.headline ?? "Pré-orçamento"}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
                        {[preQuote.city, preQuote.expenseGroup].filter(Boolean).join(" · ")}
                      </p>
                      <p className="mt-2 text-xs text-[var(--color-fg-muted)]">
                        {pluralize(preQuote.items.length, "item", "itens")} · valor sugerido{" "}
                        <span className="font-bold tabular-nums text-[var(--color-primary)]">{formatBRL(totals.suggestedValue)}</span>
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
                      <Link className="action-primary !px-3 !py-1.5 text-xs" href={`/preorcamento/${preQuote.quotationExternalId}`}>
                        Abrir planilha →
                      </Link>
                      <PrequoteDeleteButton id={preQuote.id} name={preQuote.schoolName ?? preQuote.quotationExternalId} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-xl font-bold text-[var(--color-fg)]">Cotações abertas para pré-orçar</h2>
          {openQuotations.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
              Nenhuma cotação aberta com itens publicados no momento.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-card)]">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg-muted)]">
                  <tr>
                    <th className="p-3">Escola</th>
                    <th className="p-3">Cidade</th>
                    <th className="p-3">Prazo</th>
                    <th className="p-3 text-right">Itens</th>
                    <th className="p-3 text-right">Referência</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {openQuotations.map((quotation) => (
                    <tr className="hover:bg-[var(--color-bg-subtle)]/50" key={quotation.externalId}>
                      <td className="max-w-[18rem] p-3">
                        <Link className="font-semibold text-[var(--color-fg)] hover:underline" href={`/opportunity/${quotation.externalId}`}>
                          {quotation.school}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-[var(--color-fg-muted)]">{quotation.headline}</p>
                      </td>
                      <td className="p-3 text-[var(--color-fg-muted)]">{quotation.city ?? "—"}</td>
                      <td className="p-3 tabular-nums text-[var(--color-fg-muted)]">
                        {formatDate(quotation.proposalDeadline ?? quotation.proposalDate)}
                      </td>
                      <td className="p-3 text-right tabular-nums">{quotation.itemCount}</td>
                      <td className="p-3 text-right font-bold tabular-nums text-[var(--color-success)]">
                        {formatOpportunityValue(quotation)}
                      </td>
                      <td className="p-3 text-right">
                        <Link className="action-primary !px-3 !py-1.5 text-xs" href={`/preorcamento/${quotation.externalId}`}>
                          Montar pré-orçamento →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
