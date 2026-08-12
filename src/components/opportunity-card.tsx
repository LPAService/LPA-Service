import Link from "next/link";
import type { NormalizedOpportunity } from "@/lib/contracts/opportunity";

type OpportunityCardProps = {
  opportunity: NormalizedOpportunity;
};

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const topItems =
    opportunity.topItems.length > 0
      ? opportunity.topItems.map((item) => `· ${item}`).join(" ")
      : "Itens não informados";

  return (
    <article className="grid min-w-0 gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-tight text-[var(--color-fg)]">
            {opportunity.headline}
          </h2>
          <p className="mt-1 text-xs font-medium uppercase tracking-normal text-[var(--color-fg-muted)]">
            {opportunity.expenseGroup}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold text-[var(--color-success)]">
            {formatCurrency(opportunity.totalValue)}
          </p>
          <p className="text-xs text-[var(--color-fg-muted)]">{opportunity.itemCount} itens</p>
        </div>
      </div>

      <dl className="grid gap-1 text-sm text-[var(--color-fg-muted)]">
        <div>
          <dt className="inline font-semibold text-[var(--color-fg)]">Escola: </dt>
          <dd className="inline">{opportunity.school}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-[var(--color-fg)]">Cidade: </dt>
          <dd className="inline">{opportunity.city ?? "Não informado"}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-[var(--color-fg)]">Entrega: </dt>
          <dd className="inline">{formatDate(opportunity.deliveryDate)}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-[var(--color-fg)]">Fornecedor: </dt>
          <dd className="inline">{opportunity.supplierName ?? "Não informado"}</dd>
        </div>
      </dl>

      <div>
        <p className="font-bold text-[var(--color-fg)]">O que precisam:</p>
        <p className="mt-1 text-sm leading-6 text-[var(--color-fg-muted)]">
          {opportunity.summary || "Resumo não informado."}
        </p>
      </div>

      <div>
        <p className="font-bold text-[var(--color-fg)]">Principais itens:</p>
        <p className="mt-1 text-sm leading-6 text-[var(--color-fg-muted)]">
          {topItems}
        </p>
      </div>

      <Link
        className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-fg)] transition hover:opacity-90"
        href={`/opportunity/${opportunity.externalId}`}
      >
        Ver oportunidade
      </Link>
    </article>
  );
}

export function formatCurrency(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Valor não informado";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

export function formatDate(value: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) return "Não informado";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}
