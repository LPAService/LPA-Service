import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import {
  getSchool,
  getSchoolQuotations,
  getSchoolOpportunities,
  splitQuotations,
  isQuotationOpen,
  INT4_MAX,
  type SchoolQuotationRow,
  type SchoolOpportunityRow,
} from "@/lib/data/schools";
import { formatCurrency, formatDate } from "@/lib/format/opportunity";
import { getCurrentUserId } from "@/lib/session";
import { FavoriteButton } from "../favorite-button";

export const dynamic = "force-dynamic";

const getCachedSchool = cache(getSchool);

function parseSchoolId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0 || id > INT4_MAX) return null;
  return id;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ idSchool: string }>;
}) {
  const { idSchool } = await params;
  const id = parseSchoolId(idSchool);
  if (id === null) return { title: "Escola não encontrada · LPA Leo" };
  const school = await getCachedSchool(id);
  if (!school) return { title: "Escola não encontrada · LPA Leo" };
  return {
    title: `${school.name} · Escolas · LPA Leo`,
    description: `Cotações e compras da escola ${school.name} em ${school.city || "MG"}.`,
  };
}

export default async function EscolaDetailPage({
  params,
}: {
  params: Promise<{ idSchool: string }>;
}) {
  const { idSchool } = await params;
  const id = parseSchoolId(idSchool);
  if (id === null) notFound();

  const userId = await getCurrentUserId();
  const school = await getCachedSchool(id, userId);
  if (!school) notFound();

  const [quotationRows, opportunityRows] = await Promise.all([
    getSchoolQuotations(id),
    getSchoolOpportunities(id),
  ]);

  const { open, closed } = splitQuotations(quotationRows);

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="shell py-8 sm:py-10">
          <nav
            aria-label="Navegação principal"
            className="flex flex-wrap items-center gap-2"
          >
            <Link className="action-secondary text-sm" href="/">
              Cotações abertas
            </Link>
            <Link className="action-secondary text-sm" href="/?view=history">
              Histórico de compras
            </Link>
            <Link className="action-secondary text-sm" href="/relatorios">
              📊 Relatório &amp; Análise
            </Link>
            <Link className="action-secondary text-sm" href="/fornecedores">
              📦 Fornecedores
            </Link>
            <Link className="action-secondary text-sm" href="/preorcamento">
              🧮 Pré-Orçamento
            </Link>
            <Link className="action-primary text-sm font-bold" href="/escolas">
              🏫 Escolas
            </Link>
            <span className="ml-auto" />
            <NotificationBell />
            <ThemeToggle />
          </nav>

          <div className="mt-6">
            <Link
              href="/escolas"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)] no-underline hover:underline"
            >
              <span aria-hidden="true">←</span> Voltar para escolas
            </Link>
          </div>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow text-[var(--color-primary)]">Escola</p>
              <div className="mt-2 flex items-start gap-3">
                <h1 className="text-3xl font-bold leading-tight tracking-tighter text-[var(--color-fg)] sm:text-4xl">
                  {school.name}
                </h1>
                <FavoriteButton
                  idSchool={school.idSchool}
                  isFavorite={school.isFavorite}
                  schoolName={school.name}
                />
              </div>
              <p className="mt-2 text-base text-[var(--color-fg-muted)]">
                {school.city || "Cidade não informada"}
                {school.regional ? ` · ${school.regional}` : ""}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 self-end">
              <div className="metric-card">
                <p className="text-2xl font-extrabold tabular-nums tracking-tight text-[var(--color-success)]">
                  {open.length}
                </p>
                <p className="eyebrow mt-1">em aberto</p>
              </div>
              <div className="metric-card">
                <p className="text-2xl font-extrabold tabular-nums tracking-tight text-[var(--color-fg)]">
                  {closed.length}
                </p>
                <p className="eyebrow mt-1">cotações encerradas</p>
              </div>
              <div className="metric-card">
                <p className="text-2xl font-extrabold tabular-nums tracking-tight text-[var(--color-fg)]">
                  {opportunityRows.length}
                </p>
                <p className="eyebrow mt-1">compras (histórico)</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Cotações em Aberto */}
      <section className="shell py-6">
        <h2 className="mb-4 text-xl font-bold text-[var(--color-fg)]">
          🟢 Cotações em aberto ({open.length})
        </h2>
        {open.length === 0 ? (
          <div className="glass-panel p-6">
            <p className="text-sm text-[var(--color-fg-muted)]">
              Nenhuma cotação em aberto para esta escola.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {open.map((q) => (
              <QuotationCard key={q.id} quotation={q} />
            ))}
          </div>
        )}
      </section>

      {/* Cotações Encerradas */}
      <section className="shell py-6">
        <h2 className="mb-4 text-xl font-bold text-[var(--color-fg)]">
          📋 Cotações encerradas ({closed.length})
        </h2>
        {closed.length === 0 ? (
          <div className="glass-panel p-6">
            <p className="text-sm text-[var(--color-fg-muted)]">
              Nenhuma cotação encerrada para esta escola.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {closed.map((q) => (
              <QuotationCard key={q.id} quotation={q} />
            ))}
          </div>
        )}
      </section>

      {/* Histórico de Compras (Opportunities) */}
      {opportunityRows.length > 0 && (
        <section className="shell py-6">
          <h2 className="mb-4 text-xl font-bold text-[var(--color-fg)]">
            🗂️ Histórico de compras ({opportunityRows.length})
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {opportunityRows.map((o) => (
              <OpportunityCard key={o.id} opportunity={o} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function QuotationCard({ quotation }: { quotation: SchoolQuotationRow }) {
  const open = isQuotationOpen(quotation);
  const status = open ? "Em aberto" : "Encerrada";
  const badgeClass = open ? "badge-success" : "badge-muted";

  return (
    <Link
      href={`/opportunity/${quotation.external_id}`}
      className="opportunity-card group relative flex flex-col gap-3 p-5 border border-[var(--color-border)] rounded-[var(--radius-card)] no-underline transition-all duration-300 hover:border-[var(--color-primary)]/50"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold px-3 py-1 text-[var(--color-primary)] bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded-full">
          {quotation.expense_group}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${badgeClass}`}
        >
          {status}
        </span>
      </div>

      <h3 className="text-lg font-bold leading-tight text-[var(--color-fg)]">
        {quotation.headline}
      </h3>

      {quotation.nu_budget_order && (
        <p className="inline-flex items-center gap-2 border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-2.5 py-0.5 text-xs font-bold tabular-nums text-[var(--color-fg)] rounded-md w-fit">
          Orçamento nº {quotation.nu_budget_order}
        </p>
      )}

      <p className="text-sm text-[var(--color-fg-muted)] line-clamp-2">
        {quotation.summary}
      </p>

      <div className="grid grid-cols-3 gap-3 text-sm border-t border-[var(--color-border)] pt-3">
        <div>
          <p className="eyebrow">Prazo</p>
          <p className="mt-0.5 text-xs font-semibold text-[var(--color-fg)]">
            {formatDate(toIso(quotation.proposal_deadline))}
          </p>
        </div>
        <div>
          <p className="eyebrow">Entrega</p>
          <p className="mt-0.5 text-xs font-semibold text-[var(--color-fg)]">
            {formatDate(toIso(quotation.delivery_date))}
          </p>
        </div>
        <div>
          <p className="eyebrow">Valor ref.</p>
          <p className="mt-0.5 text-xs font-semibold text-[var(--color-success)]">
            {formatCurrency(quotation.total_reference_value)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
        <span className="text-xs font-semibold text-[var(--color-fg-muted)]">
          {quotation.item_count}{" "}
          {quotation.item_count === 1 ? "item" : "itens"}
          {quotation.category_name ? ` · ${quotation.category_name}` : ""}
        </span>
        <span className="text-sm font-bold text-[var(--color-primary)]">
          Ver detalhes <span aria-hidden="true">→</span>
        </span>
      </div>
    </Link>
  );
}

function OpportunityCard({
  opportunity,
}: {
  opportunity: SchoolOpportunityRow;
}) {
  return (
    <Link
      href={`/opportunity/${opportunity.external_id}`}
      className="opportunity-card group relative flex flex-col gap-3 p-5 border border-[var(--color-border)] rounded-[var(--radius-card)] no-underline transition-all duration-300 hover:border-[var(--color-primary)]/50"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold px-3 py-1 text-[var(--color-primary)] bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded-full">
          {opportunity.expense_group}
        </span>
        {opportunity.purchase_order_status && (
          <span className="inline-flex items-center rounded-full badge-muted px-2.5 py-0.5 text-xs font-semibold">
            {opportunity.purchase_order_status}
          </span>
        )}
      </div>

      <h3 className="text-lg font-bold leading-tight text-[var(--color-fg)]">
        {opportunity.headline}
      </h3>

      <p className="text-sm text-[var(--color-fg-muted)] line-clamp-2">
        {opportunity.summary}
      </p>

      <div className="grid grid-cols-3 gap-3 text-sm border-t border-[var(--color-border)] pt-3">
        <div>
          <p className="eyebrow">Compra</p>
          <p className="mt-0.5 text-xs font-semibold text-[var(--color-fg)]">
            {formatDate(toIso(opportunity.purchase_date))}
          </p>
        </div>
        <div>
          <p className="eyebrow">Entrega</p>
          <p className="mt-0.5 text-xs font-semibold text-[var(--color-fg)]">
            {formatDate(toIso(opportunity.delivery_date))}
          </p>
        </div>
        <div>
          <p className="eyebrow">Valor</p>
          <p className="mt-0.5 text-xs font-semibold text-[var(--color-success)]">
            {formatCurrency(opportunity.total_value)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
        <span className="text-xs font-semibold text-[var(--color-fg-muted)]">
          {opportunity.item_count}{" "}
          {opportunity.item_count === 1 ? "item" : "itens"}
          {opportunity.category_name ? ` · ${opportunity.category_name}` : ""}
        </span>
        <span className="text-sm font-bold text-[var(--color-primary)]">
          Ver detalhes <span aria-hidden="true">→</span>
        </span>
      </div>
    </Link>
  );
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
