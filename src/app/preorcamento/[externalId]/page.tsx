import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/format/opportunity";
import {
  PrequoteWorksheet,
  type WorksheetRow
} from "@/components/prequote/prequote-worksheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import type { CatalogItemLite, CatalogMatch } from "@/lib/catalog/match";
import { matchCatalogItems } from "@/lib/catalog/match";
import { catalogSource } from "@/lib/data/catalog";
import { quotationSource } from "@/lib/data/source";
import { formatBRL } from "@/lib/prequote/calc";

export const dynamic = "force-dynamic";

type WorksheetPageProps = {
  params: Promise<{ externalId: string }>;
};

export default async function WorksheetPage({ params }: WorksheetPageProps) {
  const { externalId } = await params;
  const quotation = await quotationSource.getOpportunity(externalId);
  if (!quotation || quotation.kind !== "quotation") notFound();

  const [preQuote, catalogItems] = await Promise.all([
    catalogSource.getLatestPreQuoteForQuotation(externalId),
    catalogSource.listAllCatalogItems()
  ]);

  const liteCatalogItems: CatalogItemLite[] = catalogItems.map((item) => ({
    id: item.id,
    supplierId: item.supplierId,
    supplierName: item.supplierName,
    name: item.name,
    normalizedName: item.normalizedName,
    unit: item.unit,
    unitPrice: item.unitPrice
  }));

  const rows: WorksheetRow[] = preQuote
    ? preQuote.items.map((item) => ({
        itemOrder: item.itemOrder,
        name: item.name,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        referenceUnitValue: item.referenceValue,
        supplierId: item.supplierId,
        catalogItemId: item.catalogItemId,
        unitCost: item.unitCost,
        source: (["catalog", "manual", "web"].includes(item.source) ? item.source : "none") as WorksheetRow["source"],
        webTitle: item.webTitle,
        webPrice: item.webPrice,
        webUrl: item.webUrl,
        notes: item.notes
      }))
    : quotation.items.map((item) => ({
        itemOrder: item.order,
        name: item.name,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        referenceUnitValue: item.referenceValue ?? null,
        supplierId: null,
        catalogItemId: null,
        unitCost: null,
        source: "none" as const,
        webTitle: null,
        webPrice: null,
        webUrl: null,
        notes: null
      }));

  const suggestions: Record<number, CatalogMatch[]> = {};
  for (const row of rows) {
    if (row.unitCost !== null) continue;
    const matches = matchCatalogItems(`${row.name} ${row.description}`, liteCatalogItems, 3);
    if (matches.length > 0) suggestions[row.itemOrder] = matches;
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg-subtle)] text-[var(--color-fg)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="shell py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--color-primary)] hover:underline" href="/preorcamento">
              ← Pré-Orçamento
            </Link>
            <Link className="action-secondary inline-flex min-h-9 items-center px-3 text-xs font-semibold" href={`/opportunity/${quotation.externalId}`}>
              Ver processo completo →
            </Link>
            <NotificationBell /><ThemeToggle />
          </div>
          <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <p className="eyebrow text-xs">
                Orçamento nº <span className="select-all tabular-nums font-bold text-[var(--color-fg)]">{quotation.orderId}</span>
              </p>
              <h1 className="mt-2 min-w-0 break-words text-2xl font-bold leading-tight tracking-tight text-[var(--color-fg)] sm:text-3xl">
                {quotation.school}
              </h1>
              <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                {[quotation.city, quotation.expenseGroup].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex flex-col justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 text-right shadow-[var(--shadow-card)]">
              <span className="eyebrow text-xs text-[var(--color-fg-muted)]">Referência da escola</span>
              <span className="text-2xl font-extrabold tabular-nums text-[var(--color-success)]">
                {quotation.totalReferenceValue !== null ? formatBRL(quotation.totalReferenceValue) : "—"}
              </span>
              <span className="text-xs tabular-nums text-[var(--color-fg-muted)]">
                Prazo: {formatDate(quotation.proposalDeadline ?? quotation.proposalDate)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="shell py-8">
        <PrequoteWorksheet
          catalogItems={liteCatalogItems}
          initialFreightCost={preQuote?.freightCost}
          initialMarginPercent={preQuote?.marginPercent}
          initialNotes={preQuote?.notes ?? ""}
          initialPreQuoteId={preQuote?.id ?? null}
          initialRows={rows}
          initialStatus={(preQuote?.status === "closed" ? "closed" : "draft")}
          quotation={{
            externalId: quotation.externalId,
            orderId: quotation.orderId,
            school: quotation.school,
            city: quotation.city,
            expenseGroup: quotation.expenseGroup,
            headline: quotation.headline,
            proposalDeadline: quotation.proposalDeadline ?? null,
            totalReferenceValue: quotation.totalReferenceValue ?? null,
            categoryName: quotation.category?.name ?? null
          }}
          suggestions={suggestions}
        />
      </section>
    </main>
  );
}
