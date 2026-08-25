import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatOpportunityValue, pluralize } from "@/lib/format/opportunity";
import { OpportunityPriceSection } from "@/components/price-section";
import { ProposalActionButton } from "@/components/proposal-action-button";
import { opportunitySource, quotationSource } from "@/lib/data/source";
import { canSubmitQuotationProposal } from "@/lib/quotation-ui";

type DetailPageProps = {
  params: Promise<{ externalId: string }>;
};

export default async function DetailPage({ params }: DetailPageProps) {
  const { externalId } = await params;
  const opportunity =
    (await quotationSource.getOpportunity(externalId)) ??
    (await opportunitySource.getOpportunity(externalId));

  if (!opportunity) notFound();
  const isQuotation = opportunity.kind === "quotation";
  const canSubmitProposal = canSubmitQuotationProposal(opportunity);

  const topItems =
    opportunity.topItems.length > 0
      ? opportunity.topItems.map((item) => `· ${item}`).join(" ")
      : "Itens não informados";

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--color-bg-subtle)]">
      {/* Header Superior da Oportunidade */}
      <section className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Link
            className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--color-primary)] hover:underline"
            href={isQuotation ? "/" : "/?view=history"}
          >
            ← {isQuotation ? "Cotações abertas" : "Histórico de compras"}
          </Link>

          <div className="mt-4 grid min-w-0 gap-6 lg:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <p className="eyebrow text-xs">
                  {isQuotation ? "Orçamento nº" : "Pedido"}{" "}
                  <span className="select-all tabular-nums text-[var(--color-fg)] font-bold">
                    {opportunity.orderId}
                  </span>
                </p>
                {opportunity.statusLabel && (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      opportunity.statusLabel === "Encerrando em breve"
                        ? "badge-warning"
                        : opportunity.statusLabel === "Nova"
                          ? "badge-success"
                          : opportunity.statusLabel === "Encerrada"
                            ? "badge-muted"
                            : "badge-success"
                    }`}
                  >
                    {opportunity.statusLabel === "Encerrando em breve" ? "⚡ " : ""}
                    {opportunity.statusLabel}
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-[var(--color-fg)] sm:text-4xl lg:text-5xl">
                {opportunity.headline}
              </h1>

              <div className="mt-5 max-w-3xl border-l-4 border-[var(--color-accent)] bg-[var(--color-bg-subtle)]/50 p-4 rounded-r-lg">
                <p className="eyebrow text-xs">Resumo das necessidades</p>
                <p className="mt-2 text-base font-semibold leading-relaxed text-[var(--color-fg)]">
                  {opportunity.summary || "Resumo não informado."}
                </p>
              </div>
            </div>

            {/* Card de Destaque de Preço */}
            <div className="flex flex-col justify-between gap-3 rounded-[var(--radius-card)] border-l-4 border-[var(--color-success)] bg-[var(--color-glass)] backdrop-blur-md p-6 text-right border border-[var(--color-border)] min-w-[280px]">
              <div>
                <span className="eyebrow text-xs text-[var(--color-fg-muted)]">
                  {isQuotation ? "Preço de referência" : "Valor homologado"}
                </span>
                <p className="mt-1 text-3xl font-extrabold tabular-nums text-[var(--color-success)] sm:text-4xl">
                  {formatOpportunityValue(opportunity)}
                </p>
                {isQuotation && opportunity.isTotalValuePartial && (
                  <p className="mt-1 text-xs font-bold text-[var(--color-warning)]">
                    valor de referência parcial
                  </p>
                )}
              </div>

              <div className="border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-fg-muted)]">
                <p className="font-semibold text-[var(--color-fg)]">
                  {pluralize(opportunity.itemCount, "item", "itens")}
                </p>
                <p className="mt-0.5">{opportunity.expenseGroup}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Conteúdo Principal da Página */}
      <section className="shell grid min-w-0 gap-6 py-8 sm:py-10 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="grid min-w-0 gap-6">
          {/* Seção Completa de Preço de Referência e Itens */}
          <Panel
            title={
              isQuotation
                ? "Preços de Referência & Itens Solicitados"
                : `Itens Solicitados · ${pluralize(opportunity.itemCount, "item", "itens")}`
            }
          >
            <OpportunityPriceSection opportunity={opportunity} />
          </Panel>

          {/* Contexto Comercial */}
          <Panel title="Contexto Comercial & Prazos">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Fact label="Escola" value={opportunity.school} />
              <Fact label="Cidade" value={opportunity.city ?? "Não informado"} />
              <Fact label="Regional" value={opportunity.regional ?? "Não informado"} />
              {isQuotation && (
                <Fact
                  label="Prazo para envio de proposta"
                  value={formatDate(opportunity.proposalDeadline ?? opportunity.proposalDate)}
                />
              )}
              <Fact label="Previsão de entrega" value={formatDate(opportunity.deliveryDate)} />
              {!isQuotation && <Fact label="Data da compra" value={formatDate(opportunity.purchaseDate)} />}
              {!isQuotation && <Fact label="Data da proposta" value={formatDate(opportunity.proposalDate)} />}
              <Fact label="Grupo de despesa" value={opportunity.expenseGroup} />
              <Fact label="Subprograma" value={opportunity.subprogram} />
            </dl>

            <div className="mt-6 border-t border-[var(--color-border)] pt-4">
              <p className="font-bold text-sm text-[var(--color-fg)]">Principais itens destacados:</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-fg-muted)]">{topItems}</p>
            </div>
          </Panel>
        </div>

        {/* Barra Lateral / Ações */}
        <aside className="grid min-w-0 content-start gap-6">
          {/* CTA Principal: Fazer Lance */}
          <div className="glass-panel p-6 space-y-4">
            <h2 className="text-lg font-bold text-[var(--color-fg)]">Ação da Proposta</h2>
            {canSubmitProposal ? (
              <div className="space-y-3">
                <ProposalActionButton
                  className="w-full py-3.5 text-base font-bold shadow-lg"
                  label="Fazer lance"
                  orderId={opportunity.orderId}
                  proposalUrl={opportunity.proposalUrl}
                />
                <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed">
                  Copia o número do orçamento automaticamente e abre o portal SGD para registrar sua proposta no envelope fechado.
                </p>
                {opportunity.proposalUrl && (
                  <a
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-sm font-semibold text-[var(--color-fg)] hover:bg-[var(--color-border)] transition-colors"
                    href={opportunity.proposalUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Abrir processo direto
                  </a>
                )}
              </div>
            ) : isQuotation && opportunity.proposalBlocked ? (
              <div className="rounded-lg border border-[var(--color-warning)] bg-[var(--color-bg-subtle)] p-4 text-sm text-[var(--color-fg)]">
                <p className="font-bold text-[var(--color-warning)]">
                  A escola indicou que não é para enviar proposta.
                </p>
                {opportunity.proposalBlockedReason && (
                  <p className="mt-2 text-xs text-[var(--color-fg-muted)] whitespace-pre-wrap">
                    {opportunity.proposalBlockedReason}
                  </p>
                )}
              </div>
            ) : isQuotation ? (
              <div className="space-y-3">
                <ProposalActionButton
                  className="w-full"
                  disabled={true}
                  disabledReason="Cotação encerrada no portal"
                  label="Fazer lance"
                  orderId={opportunity.orderId}
                />
                <a
                  className="action-secondary inline-flex min-h-11 w-full items-center justify-center text-sm font-semibold"
                  href={opportunity.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Consultar no portal
                </a>
              </div>
            ) : (
              <a
                className="action-primary inline-flex min-h-11 w-full items-center justify-center rounded-lg text-sm font-bold"
                href={opportunity.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                Ver no portal da transparência
              </a>
            )}
          </div>

          {/* Dados do Fornecedor Vencedor (para histórico) */}
          {!isQuotation && (
            <Panel title="Fornecedor Vencedor">
              <dl className="grid gap-3 text-sm">
                <Fact label="Nome" value={opportunity.supplierName ?? "Não informado"} />
                <Fact label="Documento" value={opportunity.supplierDocument ?? "Não informado"} />
                <Fact label="Status compra" value={opportunity.purchaseOrderStatus ?? "Não informado"} />
                <Fact label="Prestação de contas" value={opportunity.accountabilityStatus ?? "Não informado"} />
              </dl>
            </Panel>
          )}

          {/* Anexos */}
          <Panel title="Anexos do Processo">
            {opportunity.attachments.length === 0 ? (
              <p className="text-sm text-[var(--color-fg-muted)]">Nenhum anexo informado.</p>
            ) : (
              <ul className="grid gap-2">
                {opportunity.attachments.map((attachment) => (
                  <li
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3 text-sm"
                    key={attachment.id}
                  >
                    <p className="font-semibold text-[var(--color-fg)]">{attachment.filename}</p>
                    <p className="mt-1 break-all text-xs text-[var(--color-fg-muted)]">
                      {attachment.thumbUrl}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Identificadores Técnicos */}
          <Panel title="Identificadores no Portal">
            <dl className="grid gap-3 text-sm">
              <Fact label={isQuotation ? "Orçamento nº" : "Pedido"} selectable value={opportunity.orderId} />
              <Fact label="ID escola" value={String(opportunity.idSchool)} />
              <Fact label="ID subprograma" value={String(opportunity.idSubprogram)} />
              <Fact label="ID orçamento" value={String(opportunity.idBudget)} />
            </dl>
          </Panel>
        </aside>
      </section>
    </main>
  );
}

function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="glass-panel min-w-0 p-5 sm:p-6">
      <h2 className="text-xl font-bold text-[var(--color-fg)]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Fact({ label, value, selectable = false }: { label: string; value: string; selectable?: boolean }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className={`mt-1 font-semibold text-[var(--color-fg)] ${selectable ? "select-all tabular-nums" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
