import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/format/opportunity";
import {
  PrequoteWorksheet,
  type WorksheetRow
} from "@/components/prequote/prequote-worksheet";
import { ProposalActionButton } from "@/components/proposal-action-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import type { CatalogItemLite, CatalogMatch } from "@/lib/catalog/match";
import { matchCatalogItems } from "@/lib/catalog/match";
import type { ReferenceMatch } from "@/lib/catalog/reference-match";
import { matchReferenceProducts } from "@/lib/catalog/reference-match";
import { listReferenceBrands } from "@/lib/catalog/reference";
import { catalogSource } from "@/lib/data/catalog";
import { quotationSource } from "@/lib/data/source";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/prequote/calc";
import { extractRequiredBrands } from "@/lib/prequote/required-brands";

export const dynamic = "force-dynamic";

type WorksheetPageProps = {
  params: Promise<{ externalId: string }>;
};

export default async function WorksheetPage({ params }: WorksheetPageProps) {
  const { externalId } = await params;
  const quotation = await quotationSource.getOpportunity(externalId);
  if (!quotation || quotation.kind !== "quotation") notFound();

  const [preQuote, catalogItems, referenceBrands] = await Promise.all([
    catalogSource.getLatestPreQuoteForQuotation(externalId),
    catalogSource.listAllCatalogItems(),
    listReferenceBrands(db)
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
    ? preQuote.items.map((item) => {
        const itemAny = item as typeof item & {
          brandOptions?: string[];
          chosenBrand?: string | null;
        };
        const quoteItem = quotation.items.find((qi) => qi.order === item.itemOrder);
        const quoteItemAny = quoteItem as typeof quoteItem & {
          brandOptions?: string[];
        };
        const brandOptions = resolveBrandOptions(item.description, itemAny, quoteItemAny);
        return {
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
          notes: item.notes,
          warranty: item.warranty,
          brandOptions,
          chosenBrand: typeof itemAny.chosenBrand === "string" ? itemAny.chosenBrand : null
        };
      })
    : quotation.items.map((item) => {
        const itemAny = item as typeof item & {
          brandOptions?: string[];
          chosenBrand?: string | null;
        };
        const brandOptions = resolveBrandOptions(item.description, itemAny);
        return {
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
          notes: null,
          warranty: null,
          brandOptions,
          chosenBrand: typeof itemAny.chosenBrand === "string" ? itemAny.chosenBrand : null
        };
      });

  const suggestions: Record<number, CatalogMatch[]> = {};
  const referenceSuggestions: Record<number, ReferenceMatch[]> = {};
  const referenceMatchJobs: Promise<{ itemOrder: number; matches: ReferenceMatch[] }>[] = [];
  for (const row of rows) {
    if (row.unitCost !== null) continue;
    const matches = matchCatalogItems(`${row.name} ${row.description}`, liteCatalogItems, 3);
    if (matches.length > 0) suggestions[row.itemOrder] = matches;
    referenceMatchJobs.push(
      matchReferenceProducts(db, `${row.name} ${row.description}`, 3, {
        categorySlug: quotation.category?.slug ?? null,
        categoryName: quotation.category?.name ?? null,
        expenseGroup: quotation.expenseGroup
      })
        .catch((error: unknown) => {
          console.error("Failed to match reference products for prequote item", {
            error,
            externalId: quotation.externalId,
            itemOrder: row.itemOrder
          });
          return [];
        })
        .then((referenceMatches) => ({
          itemOrder: row.itemOrder,
          matches: referenceMatches
        }))
    );
  }
  for (const { itemOrder, matches } of await Promise.all(referenceMatchJobs)) {
    if (matches.length > 0) referenceSuggestions[itemOrder] = matches;
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
                Prazo de envio: {formatDate(quotation.proposalDeadline ?? quotation.proposalDate)}
              </span>
              <ProposalActionButton
                className="mt-2 w-full"
                canSubmitProposal={quotation.canSubmitProposal}
                disabled={quotation.proposalBlocked}
                disabledReason={quotation.proposalBlockedReason}
                label="Fazer lance no portal"
                orderId={quotation.orderId}
                proposalUrl={quotation.proposalUrl}
              />
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
          referenceBrands={referenceBrands}
          initialStatus={(preQuote?.status === "closed" ? "closed" : "draft")}
          quotation={{
            externalId: quotation.externalId,
            orderId: quotation.orderId,
            school: quotation.school,
            city: quotation.city,
            expenseGroup: quotation.expenseGroup,
            headline: quotation.headline,
            proposalDeadline: quotation.proposalDeadline ?? null,
            deliveryDate: quotation.deliveryDate ?? null,
            proposalUrl: quotation.proposalUrl,
            canSubmitProposal: quotation.canSubmitProposal,
            proposalBlocked: quotation.proposalBlocked,
            proposalBlockedReason: quotation.proposalBlockedReason,
            totalReferenceValue: quotation.totalReferenceValue ?? null,
            categorySlug: quotation.category?.slug ?? null,
            categoryName: quotation.category?.name ?? null
          }}
          referenceSuggestions={referenceSuggestions}
          suggestions={suggestions}
        />
      </section>
    </main>
  );
}

function resolveBrandOptions(
  description: string | null | undefined,
  ...sources: Array<{ brandOptions?: string[] } | null | undefined>
) {
  for (const source of sources) {
    if (Array.isArray(source?.brandOptions) && source.brandOptions.length > 0) {
      return source.brandOptions;
    }
  }

  return extractRequiredBrands(description);
}
