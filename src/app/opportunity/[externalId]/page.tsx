import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCurrency, formatDate, formatOpportunityValue, pluralize } from "@/components/opportunity-card";
import { ProposalActionButton } from "@/components/proposal-action-button";
import { opportunitySource, quotationSource } from "@/lib/data/source";
import { formatQuantityWithUnit } from "@/lib/quantity-format";
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
      <section className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--color-primary)]" href={isQuotation ? "/" : "/?view=history"}>
            ← {isQuotation ? "Cotações abertas" : "Histórico de compras"}
          </Link>
          <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <p className="eyebrow">
                {isQuotation ? "Orçamento nº" : "Pedido"} <span className="select-all tabular-nums">{opportunity.orderId}</span>
              </p>
              <h1 className="mt-2 text-3xl font-bold leading-none tracking-normal text-[var(--color-fg)] sm:text-5xl">
                {opportunity.headline}
              </h1>
              <div className="mt-5 max-w-3xl border-l-4 border-[var(--color-accent)] pl-4">
                <p className="eyebrow">O que precisam</p>
                <p className="mt-2 text-base font-semibold leading-6 text-[var(--color-fg)]">
                  {opportunity.summary || "Resumo não informado."}
                </p>
              </div>
            </div>
            <div className="grid min-w-0 content-start gap-2 border-l-4 border-[var(--color-success)] bg-[var(--color-bg-subtle)] p-5 text-right shadow-[var(--shadow-card)]">
              <p className="text-3xl font-bold tabular-nums text-[var(--color-success)]">
                {formatOpportunityValue(opportunity)}
              </p>
              {isQuotation && opportunity.isTotalValuePartial && <p className="text-xs font-bold text-[var(--color-fg-muted)]">valor de referência parcial</p>}
              <p className="text-sm text-[var(--color-fg-muted)]">
                {pluralize(opportunity.itemCount, "item", "itens")} · {opportunity.expenseGroup}
              </p>
              {opportunity.statusLabel && <p className="text-sm font-bold text-[var(--color-primary)]">{opportunity.statusLabel}</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="shell grid min-w-0 gap-6 py-8 sm:py-10 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <div className="grid min-w-0 gap-6">
          <Panel title="Contexto comercial">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Fact label="Escola" value={opportunity.school} />
              <Fact label="Cidade" value={opportunity.city ?? "Não informado"} />
              <Fact label="Regional" value={opportunity.regional ?? "Não informado"} />
              {isQuotation && <Fact label="Prazo da proposta" value={formatDate(opportunity.proposalDeadline ?? opportunity.proposalDate)} />}
              <Fact label="Entrega" value={formatDate(opportunity.deliveryDate)} />
              {!isQuotation && <Fact label="Compra" value={formatDate(opportunity.purchaseDate)} />}
              {!isQuotation && <Fact label="Proposta" value={formatDate(opportunity.proposalDate)} />}
              <Fact label="Grupo de despesa" value={opportunity.expenseGroup} />
              <Fact label="Subprograma" value={opportunity.subprogram} />
            </dl>
            <div className="mt-5">
              <p className="font-bold text-[var(--color-fg)]">Principais itens:</p>
              <p className="mt-1 text-sm leading-6 text-[var(--color-fg-muted)]">
                {topItems}
              </p>
            </div>
          </Panel>

          <Panel title={isQuotation ? `Lista de Itens Solicitados · ${pluralize(opportunity.itemCount, "item", "itens")}` : `Itens solicitados · ${pluralize(opportunity.itemCount, "item", "itens")}`}>
            {opportunity.items.length === 0 ? (
              <p className="text-sm text-[var(--color-fg-muted)]">Itens não informados.</p>
            ) : (
              <div className="min-w-0 max-w-full overflow-x-auto">
                <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="bg-[var(--color-bg-subtle)] text-xs uppercase tracking-normal text-[var(--color-fg-muted)]">
                      <th className="border-b border-[var(--color-border)] px-3 py-3">Item</th>
                      <th className="border-b border-[var(--color-border)] px-3">Descrição</th>
                      <th className="border-b border-[var(--color-border)] px-3">Un.</th>
                      <th className="border-b border-[var(--color-border)] px-3 text-right">Qtd</th>
                      <th className="border-b border-[var(--color-border)] px-3 text-right">
                        Valor unit.
                      </th>
                      <th className="border-b border-[var(--color-border)] pl-3 text-right">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunity.items.map((item) => (
                      <tr key={item.order} className="align-top">
                        <td className="border-b border-[var(--color-border)] px-3 py-4 font-semibold text-[var(--color-fg)]">
                          {item.name}
                        </td>
                        <td className="max-w-md border-b border-[var(--color-border)] px-3 py-4 leading-5 text-[var(--color-fg-muted)]">
                          {item.description}
                        </td>
                        <td className="border-b border-[var(--color-border)] px-3 py-4 text-[var(--color-fg-muted)]">
                          {item.unit}
                        </td>
                        <td className="border-b border-[var(--color-border)] px-3 py-4 text-right tabular-nums text-[var(--color-fg-muted)]">
                          {formatQuantityWithUnit(item.quantity, item.unit)}
                        </td>
                        <td className="border-b border-[var(--color-border)] px-3 py-4 text-right tabular-nums text-[var(--color-fg-muted)]">
                          {formatCurrency(item.unitValue)}
                        </td>
                        <td className="border-b border-[var(--color-border)] px-3 py-4 text-right font-semibold tabular-nums text-[var(--color-fg)]">
                          {formatCurrency(item.totalValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <aside className="grid min-w-0 content-start gap-5">
          {!isQuotation && <Panel title="Fornecedor vencedor">
            <dl className="grid gap-3 text-sm">
              <Fact
                label="Nome"
                value={opportunity.supplierName ?? "Não informado"}
              />
              <Fact
                label="Documento"
                value={opportunity.supplierDocument ?? "Não informado"}
              />
              <Fact
                label="Status compra"
                value={opportunity.purchaseOrderStatus ?? "Não informado"}
              />
              <Fact
                label="Prestação de contas"
                value={opportunity.accountabilityStatus ?? "Não informado"}
              />
            </dl>
          </Panel>}

          <Panel title="Anexos">
            {opportunity.attachments.length === 0 ? (
              <p className="text-sm text-[var(--color-fg-muted)]">Nenhum anexo informado.</p>
            ) : (
              <ul className="grid gap-2">
                {opportunity.attachments.map((attachment) => (
                  <li
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3 text-sm"
                    key={attachment.id}
                  >
                    <p className="font-semibold text-[var(--color-fg)]">
                      {attachment.filename}
                    </p>
                    <p className="mt-1 break-all text-xs text-[var(--color-fg-muted)]">
                      {attachment.thumbUrl}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Identificadores no portal">
            <dl className="grid gap-3 text-sm">
              <Fact label={isQuotation ? "Orçamento nº" : "Pedido"} value={opportunity.orderId} selectable />
              <Fact label="ID escola" value={String(opportunity.idSchool)} />
              <Fact label="ID subprograma" value={String(opportunity.idSubprogram)} />
              <Fact label="ID orçamento" value={String(opportunity.idBudget)} />
            </dl>
          </Panel>

          {canSubmitProposal ? (
            <div className="grid gap-3">
              <ProposalActionButton className="action-primary inline-flex min-h-11 w-full items-center justify-center gap-2" orderId={opportunity.orderId} />
              {opportunity.proposalUrl && (
                <a className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-[var(--color-fg-muted)] underline-offset-4 hover:underline" href={opportunity.proposalUrl} rel="noreferrer" target="_blank">
                  Abrir processo direto
                </a>
              )}
            </div>
          ) : <a className="action-primary" href={opportunity.sourceUrl} rel="noreferrer" target="_blank">{isQuotation ? "Consultar cotação no portal" : "Ver no portal da transparência"}</a>}
        </aside>
      </section>
    </main>
  );
}

function Panel({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="min-w-0 border-t-2 border-[var(--color-fg)] bg-[var(--color-bg)] p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-xl font-bold text-[var(--color-fg)]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Fact({ label, value, selectable = false }: { label: string; value: string; selectable?: boolean }) {
  return (
    <div>
      <dt className="eyebrow">
        {label}
      </dt>
      <dd className={`mt-1 font-semibold text-[var(--color-fg)] ${selectable ? "select-all tabular-nums" : ""}`}>{value}</dd>
    </div>
  );
}
