import Link from "next/link";
import { formatDate, formatOpportunityValue, pluralize } from "@/lib/format/opportunity";
import { PrequoteDeleteButton } from "@/components/prequote/prequote-delete-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { catalogSource } from "@/lib/data/catalog";
import { quotationSource, sanitizePageParam } from "@/lib/data/source";
import { calcPreQuoteTotals, formatBRL } from "@/lib/prequote/calc";

export const metadata = {
  title: "Pré-Orçamento · LPA Leo",
  description: "Monte o custo real de cada licitação com catálogo de fornecedores e busca de preço na internet."
};

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
const OPEN_PAGE_SIZE = 48;
const SAVED_PAGE_SIZE = 24;

export default async function PreOrcamentoPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const currentParams = new URLSearchParams();
  const cleanParams: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    const cleanKey = key.trim();
    if (!cleanKey) continue;
    if (Array.isArray(value)) {
      cleanParams[cleanKey] = value;
      continue;
    }
    const cleanValue = value?.trim();
    if (cleanValue) {
      cleanParams[cleanKey] = cleanValue;
      currentParams.set(cleanKey, cleanValue);
    }
  }

  const page = sanitizePageParam(cleanParams.page);
  const savedPage = sanitizePageParam(cleanParams.savedPage);

  const [openResult, preQuotesResult] = await Promise.all([
    quotationSource.listOpportunities({ situation: "open" }, { page, pageSize: OPEN_PAGE_SIZE }),
    catalogSource.listPreQuotes({ page: savedPage, pageSize: SAVED_PAGE_SIZE })
  ]);
  const openQuotations = openResult.data.filter((quotation) => quotation.items.length > 0);
  const preQuotes = preQuotesResult.data;

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="shell py-8 sm:py-10">
          <nav aria-label="Navegação principal" className="flex flex-wrap items-center gap-2">
            <Link className="action-secondary text-sm" href="/">Cotações abertas</Link>
            <Link className="action-secondary text-sm" href="/?view=history">Histórico de compras</Link>
            <Link className="action-secondary text-sm" href="/relatorios">📊 Relatório & Análise</Link>
            <Link className="action-secondary text-sm" href="/fornecedores">📦 Fornecedores</Link>
            <Link className="action-primary text-sm font-bold" href="/preorcamento">� Pré-Orçamento</Link>
            <span className="ml-auto" />
            <NotificationBell /><ThemeToggle />
          </nav>
          <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
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
                <p className="text-2xl font-bold tabular-nums text-[var(--color-fg)]">{openResult.total}</p>
                <p className="eyebrow mt-1">cotações abertas</p>
              </div>
              <div className="px-4 py-2">
                <p className="text-2xl font-bold tabular-nums text-[var(--color-fg)]">{preQuotesResult.total}</p>
                <p className="eyebrow mt-1">pré-orçamentos</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="shell space-y-10 py-8">
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-xl font-bold text-[var(--color-fg)]">Pré-orçamentos salvos</h2>
            {preQuotesResult.totalPages > 1 && (
              <p className="text-sm text-[var(--color-fg-muted)]">
                Página {preQuotesResult.page} de {preQuotesResult.totalPages}
              </p>
            )}
          </div>
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
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${preQuote.status === "closed" ? "badge-success" : "badge-warning"}`}>
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
          <Pagination
            basePath="/preorcamento"
            currentParams={currentParams}
            page={preQuotesResult.page}
            paramName="savedPage"
            totalPages={preQuotesResult.totalPages}
          />
        </section>

        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-xl font-bold text-[var(--color-fg)]">Cotações abertas para pré-orçar</h2>
            {openResult.totalPages > 1 && (
              <p className="text-sm text-[var(--color-fg-muted)]">
                Página {openResult.page} de {openResult.totalPages}
              </p>
            )}
          </div>
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
          <Pagination
            basePath="/preorcamento"
            currentParams={currentParams}
            page={openResult.page}
            paramName="page"
            totalPages={openResult.totalPages}
          />
        </section>
      </div>
    </main>
  );
}

function Pagination({
  currentParams,
  page,
  totalPages,
  paramName = "page",
  basePath = "/preorcamento"
}: {
  currentParams: URLSearchParams;
  page: number;
  totalPages: number;
  paramName?: string;
  basePath?: string;
}) {
  if (totalPages <= 1) return null;
  const prev = new URLSearchParams(currentParams);
  prev.set(paramName, `${Math.max(1, page - 1)}`);
  const next = new URLSearchParams(currentParams);
  next.set(paramName, `${Math.min(totalPages, page + 1)}`);
  return (
    <nav className="mt-10 flex items-center justify-between border-t border-[var(--color-border)] pt-5">
      <a aria-disabled={page <= 1} className="action-secondary" href={`${basePath}?${prev.toString()}`}>
        ← Anterior
      </a>
      <p className="text-sm font-medium text-[var(--color-fg-muted)]">
        {page} / {totalPages}
      </p>
      <a aria-disabled={page >= totalPages} className="action-secondary" href={`${basePath}?${next.toString()}`}>
        Próxima →
      </a>
    </nav>
  );
}
