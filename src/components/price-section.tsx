import React from "react";
import type { NormalizedOpportunity, OpportunityItem } from "@/lib/contracts/opportunity";
import { formatQuantityWithUnit } from "@/lib/quantity-format";
import {
  cleanDisplayedDescription,
  formatCurrency,
  formatOpportunityValue,
  pluralize
} from "@/lib/format/opportunity";

export function getItemReferencePrice(item: OpportunityItem): number | null {
  const ref = (item as unknown as { referenceValue?: number | null }).referenceValue ?? item.unitValue;
  if (ref === null || ref === undefined || !Number.isFinite(ref)) return null;
  return ref;
}

export function getItemTotalPrice(item: OpportunityItem): number | null {
  if (item.totalValue !== null && item.totalValue !== undefined && Number.isFinite(item.totalValue)) {
    return item.totalValue;
  }
  const unitPrice = getItemReferencePrice(item);
  if (unitPrice !== null && Number.isFinite(item.quantity) && item.quantity > 0) {
    return item.quantity * unitPrice;
  }
  return null;
}

export function formatItemUnitPrice(item: OpportunityItem): string {
  const price = getItemReferencePrice(item);
  if (price === null) return "Sem preço de referência";
  return formatCurrency(price);
}

export function formatItemTotalPrice(item: OpportunityItem): string {
  const total = getItemTotalPrice(item);
  if (total === null) return "Sem preço de referência";
  return formatCurrency(total);
}

export function OpportunityPriceSection({ opportunity }: { opportunity: NormalizedOpportunity }) {
  const isQuotation = opportunity.kind === "quotation";
  const pricedItems = opportunity.items.filter((i) => getItemReferencePrice(i) !== null);
  const pricedCount = pricedItems.length;
  const totalCount = opportunity.itemCount;

  return (
    <div className="flex flex-col gap-6">
      {/* Bloco de Destaque do Preço de Referência */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <span className="eyebrow text-xs font-bold text-[var(--color-fg-muted)]">
              {isQuotation ? "Preço de Referência Total (SGD)" : "Valor Total Adjudicado"}
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tabular-nums text-[var(--color-success)] sm:text-4xl">
                {formatOpportunityValue(opportunity)}
              </span>
            </div>
            {isQuotation && opportunity.isTotalValuePartial && (
              <p className="mt-1 text-xs font-bold text-[var(--color-warning)]">
                ⚠️ Valor de referência parcial ({pricedCount} de {totalCount} itens com preço informado)
              </p>
            )}
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-[var(--color-fg-muted)]">
              Total de itens:
            </span>
            <p className="text-lg font-bold tabular-nums text-[var(--color-fg)]">
              {pluralize(totalCount, "item", "itens")}
            </p>
          </div>
        </div>

        {isQuotation && (
          <div className="mt-4 border-t border-[var(--color-border)] pt-3 text-xs leading-relaxed text-[var(--color-fg-muted)]">
            <span className="font-semibold text-[var(--color-fg)]">Transparência comercial: </span>
            Valores publicados pela escola no SGD como teto e balizador para elaboração de proposta. O SGD opera em envelope fechado (sem divulgação de lances concorrentes).
          </div>
        )}
      </div>

      {/* Tabela / Lista Detalhada de Itens com Preços */}
      <section className="min-w-0">
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <h3 className="text-xl font-bold text-[var(--color-fg)]">
            Lista de Itens Solicitados · {pluralize(totalCount, "item", "itens")}
          </h3>
          {isQuotation && pricedCount > 0 && pricedCount < totalCount && (
            <span className="text-xs font-semibold text-[var(--color-warning)]">
              {pricedCount}/{totalCount} com valor de referência
            </span>
          )}
        </div>

        {opportunity.items.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">Itens não informados.</p>
        ) : (
          <div className="grid min-w-0 max-w-full gap-3">
            {opportunity.items.map((item) => {
              const unitPrice = getItemReferencePrice(item);
              const totalValue = getItemTotalPrice(item);
              const description = cleanDisplayedDescription(item.description, unitPrice);
              const hasUnitPrice = unitPrice !== null;
              const hasTotalPrice = totalValue !== null;

              return (
                <article
                  className="min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4 transition-colors hover:border-[var(--color-primary)]/40"
                  key={item.order}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--color-bg-subtle)] text-xs font-bold tabular-nums text-[var(--color-fg)]">
                      {item.order}
                    </span>
                    <h4 className="min-w-0 flex-1 break-words text-base font-bold leading-snug text-[var(--color-fg)]">
                      {item.name}
                    </h4>
                  </div>

                  {description && (
                    <p className="mt-2 min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--color-fg-muted)]">
                      {description}
                    </p>
                  )}

                  <dl className="mt-4 grid min-w-0 grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-3 text-sm sm:grid-cols-4">
                    <div className="rounded-md bg-[var(--color-bg-subtle)] px-3 py-2">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg-muted)]">
                        Unidade
                      </dt>
                      <dd className="mt-1 font-semibold text-[var(--color-fg)]">
                        {item.unit || "Não informado"}
                      </dd>
                    </div>

                    <div className="rounded-md bg-[var(--color-bg-subtle)] px-3 py-2">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg-muted)]">
                        Quantidade
                      </dt>
                      <dd className="mt-1 font-semibold text-[var(--color-fg)]">
                        {formatQuantityWithUnit(item.quantity, item.unit)}
                      </dd>
                    </div>

                    <div className="rounded-md bg-[var(--color-bg-subtle)] px-3 py-2">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg-muted)]">
                        Preço unitário
                      </dt>
                      <dd
                        className={`mt-1 tabular-nums ${
                          hasUnitPrice
                            ? "font-bold text-[var(--color-fg)]"
                            : "font-normal italic text-[var(--color-fg-muted)] text-xs"
                        }`}
                      >
                        {formatItemUnitPrice(item)}
                      </dd>
                    </div>

                    <div className="rounded-md bg-[var(--color-bg-subtle)] px-3 py-2">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg-muted)]">
                        Total do item
                      </dt>
                      <dd
                        className={`mt-1 tabular-nums ${
                          hasTotalPrice
                            ? "font-extrabold text-[var(--color-success)]"
                            : "font-normal italic text-[var(--color-fg-muted)] text-xs"
                        }`}
                      >
                        {formatItemTotalPrice(item)}
                      </dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
