import Link from "next/link";
import type { NormalizedOpportunity } from "@/lib/contracts/opportunity";
import { formatQuantityWithUnit } from "@/lib/quantity-format";
import { canSubmitQuotationProposal } from "@/lib/quotation-ui";

type OpportunityCardProps = { opportunity: NormalizedOpportunity };

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const topItems = opportunity.topItems.length > 0 ? opportunity.topItems.slice(0, 3).join(" · ") : "Itens não informados";
  const isQuotation = opportunity.kind === "quotation";
  const href = isQuotation ? opportunity.proposalUrl ?? opportunity.sourceUrl : `/opportunity/${opportunity.externalId}`;
  const canSubmitProposal = canSubmitQuotationProposal(opportunity);
  const quantitySummary = firstQuantitySummary(opportunity);

  return (
    <article className="opportunity-card group relative grid min-w-0 gap-5 overflow-hidden border-l-4 border-l-[var(--color-accent)] bg-[var(--color-bg)] p-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-4">
        <div className="min-w-0">
          <p className="eyebrow">{opportunity.expenseGroup || "Categoria não informada"}</p>
          <h2 className="mt-2 text-xl font-bold leading-[1.12] text-[var(--color-fg)]">{opportunity.headline}</h2>
          {isQuotation && <p className="mt-3 inline-flex select-all border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-2 py-1 text-xs font-bold tabular-nums text-[var(--color-fg)]">Orçamento nº {opportunity.orderId}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-bold tabular-nums text-[var(--color-success)]">{isQuotation && opportunity.totalValue === null ? "Valor a definir" : formatCurrency(opportunity.totalValue)}</p>
          <p className="mt-1 text-xs font-medium text-[var(--color-fg-muted)]">{pluralize(opportunity.itemCount, "item", "itens")}</p>
          {opportunity.statusLabel && <p className="mt-2 text-xs font-bold text-[var(--color-primary)]">{opportunity.statusLabel}</p>}
        </div>
      </div>

      <div className="border-y border-[var(--color-border)] py-4">
        <p className="eyebrow">O que precisam</p>
        <p className="mt-2 text-base font-semibold leading-6 text-[var(--color-fg)]">{opportunity.summary || "Resumo não informado."}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm sm:grid-cols-3">
        <Fact className="sm:col-span-3" label="Escola" value={opportunity.school} />
        <Fact label="Cidade" value={opportunity.city ?? "Não informado"} />
        {isQuotation && <Fact label="Prazo" value={formatDate(opportunity.proposalDeadline ?? opportunity.proposalDate)} />}
        <Fact label="Entrega" value={formatDate(opportunity.deliveryDate)} />
      </dl>
      {isQuotation && quantitySummary && <p className="text-sm font-bold leading-5 text-[var(--color-fg)]">{quantitySummary}</p>}
      <p className="line-clamp-2 text-sm leading-5 text-[var(--color-fg-muted)]"><span className="font-semibold text-[var(--color-fg)]">Principais itens: </span>{topItems}</p>
      {canSubmitProposal ? (
        <a className="card-link inline-flex min-h-11 items-center justify-between border-t border-[var(--color-border)] pt-4 text-sm font-bold text-[var(--color-primary)]" href={href} rel="noreferrer" target="_blank">
          Enviar proposta <span aria-hidden="true">→</span>
        </a>
      ) : isQuotation ? (
        <a className="card-link inline-flex min-h-11 items-center justify-between border-t border-[var(--color-border)] pt-4 text-sm font-bold text-[var(--color-fg-muted)]" href={`/opportunity/${opportunity.externalId}`}>
          Consultar cotação encerrada <span aria-hidden="true">→</span>
        </a>
      ) : (
        <Link className="card-link inline-flex min-h-11 items-center justify-between border-t border-[var(--color-border)] pt-4 text-sm font-bold text-[var(--color-primary)]" href={href}>
          Ver oportunidade <span aria-hidden="true">→</span>
        </Link>
      )}
    </article>
  );
}

function firstQuantitySummary(opportunity: NormalizedOpportunity) {
  const item = opportunity.items[0];
  if (!item) return null;
  return `${formatQuantityWithUnit(item.quantity, item.unit)} · ${item.name}`;
}

function Fact({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return <div className={`min-w-0 ${className}`}><dt className="eyebrow">{label}</dt><dd className="mt-1 break-words font-medium text-[var(--color-fg)]">{value}</dd></div>;
}

export function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatCurrency(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Valor não informado";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatDate(value: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}
