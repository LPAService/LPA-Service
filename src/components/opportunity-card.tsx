"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ProposalActionButton } from "@/components/proposal-action-button";
import type { NormalizedOpportunity, OpportunityItem } from "@/lib/contracts/opportunity";
import { formatQuantityWithUnit } from "@/lib/quantity-format";
import { canSubmitQuotationProposal } from "@/lib/quotation-ui";

type OpportunityCardProps = { opportunity: NormalizedOpportunity };

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("modal") === opportunity.externalId
  );
  const topItems =
    opportunity.topItems.length > 0 ? opportunity.topItems.slice(0, 3).join(" · ") : "Itens não informados";
  const isQuotation = opportunity.kind === "quotation";
  const href = `/opportunity/${opportunity.externalId}`;
  const canSubmitProposal = canSubmitQuotationProposal(opportunity);
  const quantitySummary = firstQuantitySummary(opportunity);
  const categoryColor = "text-[var(--color-primary)] bg-[var(--color-bg)] border border-[var(--color-border)]";

  return (
    <>
      <article
        className={`opportunity-card group relative flex flex-col justify-between min-w-0 gap-5 overflow-hidden bg-[var(--color-bg)] p-6 border border-[var(--color-border)] rounded-[var(--radius-card)] shadow-lg transition-all duration-300 hover:border-[var(--color-primary)]/50 ${
          isQuotation ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]" : ""
        }`}
        onClick={(event) => {
          if (!isQuotation || isInteractiveCardClick(event.target)) return;
          setIsModalOpen(true);
        }}
        onKeyDown={(event) => {
          if (!isQuotation) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsModalOpen(true);
          }
        }}
        role={isQuotation ? "button" : undefined}
        tabIndex={isQuotation ? 0 : undefined}
      >
        <div className="flex flex-col gap-4">
          {/* Header da Cotação / Categoria & Urgência */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`category-badge text-xs font-semibold px-3 py-1 ${categoryColor}`}>
                {opportunity.expenseGroup || "Categoria"}
              </span>
              {opportunity.category?.name && (
                <span className="text-xs font-medium text-[var(--color-fg-muted)]">
                  • {opportunity.category.name}
                </span>
              )}
            </div>

            {/* Badge de Status / Urgência */}
            {opportunity.statusLabel && (
              <StatusBadge statusLabel={opportunity.statusLabel} />
            )}
          </div>

          {/* Título & Número do Orçamento */}
          <div>
            <h2 className="text-2xl font-bold leading-tight text-[var(--color-fg)] tracking-tight">
              {opportunity.headline}
            </h2>
            {isQuotation && (
              <p className="mt-2 inline-flex items-center gap-2 border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-2.5 py-0.5 text-xs font-bold tabular-nums text-[var(--color-fg)] rounded-md">
                Orçamento nº {opportunity.orderId}
              </p>
            )}
          </div>

          {/* SEÇÃO DE PREÇO DE REFERÊNCIA EM DESTAQUE */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)]/70 p-4 shadow-sm">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <span className="eyebrow text-[11px] text-[var(--color-fg-muted)]">
                  {isQuotation ? "Preço de referência" : "Valor homologado"}
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-bold tabular-nums text-[var(--color-success)] sm:text-3xl">
                    {formatOpportunityValue(opportunity)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold tabular-nums text-[var(--color-fg)]">
                  {pluralize(opportunity.itemCount, "item", "itens")}
                </span>
                {isQuotation && opportunity.isTotalValuePartial && (
                  <p className="text-[10px] font-bold uppercase text-[var(--color-warning)]">
                    Valor parcial
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* O que precisam / Resumo */}
          <div className="border-t border-[var(--color-border)] pt-4">
            <p className="eyebrow text-xs mb-1.5">O que precisam</p>
            <p className="text-[14px] leading-relaxed text-[var(--color-fg)] line-clamp-3">
              {opportunity.summary || "Resumo não informado."}
            </p>
          </div>

          {/* Informações operacionais */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <p className="eyebrow">Escola</p>
              <p className="font-semibold text-[var(--color-fg)] mt-0.5 line-clamp-2 text-xs sm:text-sm">
                {opportunity.school}
              </p>
            </div>
            <div>
              <p className="eyebrow">Cidade</p>
              <p className="font-semibold text-[var(--color-fg)] mt-0.5 text-xs sm:text-sm">
                {opportunity.city || "Não informado"}
              </p>
            </div>
            {isQuotation && (
              <div>
                <p className="eyebrow">Prazo Proposta</p>
                <p className="font-semibold text-[var(--color-fg)] mt-0.5 text-xs sm:text-sm">
                  {formatDate(opportunity.proposalDeadline ?? opportunity.proposalDate)}
                </p>
              </div>
            )}
            <div>
              <p className="eyebrow">Entrega</p>
              <p className="font-semibold text-[var(--color-fg)] mt-0.5 text-xs sm:text-sm">
                {formatDate(opportunity.deliveryDate)}
              </p>
            </div>
          </div>

          {isQuotation && quantitySummary && (
            <div className="text-xs font-semibold text-[var(--color-fg)] pt-3 border-t border-[var(--color-border)]">
              {quantitySummary}
            </div>
          )}

          <p className="text-xs text-[var(--color-fg-muted)] line-clamp-2">
            <span className="font-semibold">Principais itens: </span>
            {topItems}
          </p>
        </div>

        {/* CTA: BOTÃO FAZER LANCE / AÇÕES */}
        <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
          {canSubmitProposal ? (
            <ProposalActionButton
              className="w-full"
              label="Fazer lance"
              orderId={opportunity.orderId}
              proposalUrl={opportunity.proposalUrl}
            />
          ) : isQuotation && opportunity.proposalBlocked ? (
            <div className="rounded-lg border border-[var(--color-warning)] bg-[var(--color-bg-subtle)] p-3 text-xs font-bold text-[var(--color-fg)]">
              A escola indicou que não é para enviar proposta{blockedCountText(opportunity)}.
            </div>
          ) : isQuotation ? (
            <a
              className="card-link inline-flex w-full items-center justify-between border-t border-[var(--color-border)] pt-2 text-sm font-bold text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              href={`/opportunity/${opportunity.externalId}`}
              onClick={(event) => event.stopPropagation()}
            >
              Consultar cotação encerrada <span aria-hidden="true" className="ml-1">→</span>
            </a>
          ) : (
            <Link
              className="card-link inline-flex w-full items-center justify-between border-t border-[var(--color-border)] pt-2 text-sm font-bold text-[var(--color-primary)] hover:underline"
              href={href}
            >
              Ver oportunidade <span aria-hidden="true" className="ml-1">→</span>
            </Link>
          )}
        </div>
      </article>

      {isQuotation && (
        <QuotationModal onClose={() => setIsModalOpen(false)} open={isModalOpen} seed={opportunity} />
      )}
    </>
  );
}

function StatusBadge({ statusLabel }: { statusLabel: string }) {
  if (statusLabel === "Encerrando em breve") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-300">
        <span className="animate-pulse">⚡</span> Encerrando em breve
      </span>
    );
  }
  if (statusLabel === "Nova") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
        ✨ Nova
      </span>
    );
  }
  if (statusLabel === "Encerrada") {
    return (
      <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-400">
        Encerrada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/15 px-2.5 py-0.5 text-xs font-bold text-[var(--color-primary)]">
      {statusLabel}
    </span>
  );
}

export function QuotationModal({
  onClose,
  open,
  seed
}: {
  onClose: () => void;
  open: boolean;
  seed: NormalizedOpportunity;
}) {
  const [quotation, setQuotation] = useState<NormalizedOpportunity | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "not-found" | "network-error">("idle");
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    setStatus("loading");
    setQuotation(null);
    fetch(`/api/quotations/${encodeURIComponent(seed.externalId)}`)
      .then(async (response) => {
        if (!response.ok) {
          console.error("Falha ao carregar cotação", {
            externalId: seed.externalId,
            orderId: seed.orderId,
            status: response.status
          });
          if (response.status === 404) {
            setStatus("not-found");
            return null;
          }
          throw new Error(`Falha HTTP ${response.status}`);
        }
        return response.json() as Promise<{ quotation: NormalizedOpportunity }>;
      })
      .then((data) => {
        if (!data) return;
        setQuotation(data.quotation);
        setStatus("idle");
      })
      .catch((error) => {
        console.error("Erro de rede ao carregar cotação", {
          externalId: seed.externalId,
          orderId: seed.orderId,
          error
        });
        setStatus("network-error");
      });
    requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      active?.focus();
    };
  }, [open, seed.externalId, seed.orderId]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = getFocusable(dialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;
  const data = quotation ?? seed;
  const canSubmitProposal = canSubmitQuotationProposal(data);

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-sm p-3 sm:p-6"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="mx-auto flex max-h-[calc(100svh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-bg)] border border-[var(--color-border)] shadow-2xl sm:max-h-[calc(100vh-3rem)]"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        {/* Header do Modal */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--color-border)] p-4 sm:p-6 bg-[var(--color-bg-subtle)]/50">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="eyebrow text-xs">
                Orçamento nº <span className="select-all tabular-nums text-[var(--color-fg)]">{data.orderId}</span>
              </span>
              {data.statusLabel && <StatusBadge statusLabel={data.statusLabel} />}
            </div>
            <h2
              className="mt-2 text-2xl font-bold leading-tight text-[var(--color-fg)] sm:text-3xl"
              id={titleId}
            >
              {data.headline}
            </h2>
          </div>
          <button
            aria-label="Fechar detalhes"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[var(--color-border)] text-2xl leading-none text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg-subtle)]"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Fatos Comerciais */}
          <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Escola" value={data.school} />
            <Fact label="Cidade" value={data.city ?? "Não informado"} />
            <Fact label="Prazo da proposta" value={formatDateTime(data.proposalDeadline ?? data.proposalDate)} />
            <Fact label="Entrega" value={formatDate(data.deliveryDate)} />
            <Fact label="Grupo de despesa" value={data.expenseGroup} />
            <Fact label="Valor de referência" value={formatOpportunityValue(data)} />
          </div>

          {/* Resumo */}
          <div className="border-l-4 border-[var(--color-accent)] bg-[var(--color-bg-subtle)]/50 p-4 rounded-r-lg">
            <p className="eyebrow text-xs">Resumo das necessidades</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-[var(--color-fg)]">
              {data.summary || "Resumo não informado."}
            </p>
          </div>

          {/* Alerta de Proposta Bloqueada */}
          {data.proposalBlocked && (
            <div className="rounded-lg border border-[var(--color-warning)] bg-amber-500/10 p-4 text-sm text-[var(--color-fg)]">
              <p className="font-bold text-amber-300">
                A escola indicou que não é para enviar proposta{blockedCountText(data)}.
              </p>
              <p className="mt-2 font-semibold text-[var(--color-fg-muted)]">Trecho original:</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-xs text-amber-200">
                {data.proposalBlockedReason || "Trecho não informado."}
              </p>
            </div>
          )}

          {/* Seção de Preços e Itens */}
          <section className="min-w-0">
            <div className="flex items-baseline justify-between gap-4 mb-4">
              <h3 className="text-xl font-bold text-[var(--color-fg)]">
                Lista de Itens Solicitados · {pluralize(data.itemCount, "item", "itens")}
              </h3>
            </div>

            {status === "loading" && (
              <div className="flex items-center justify-center p-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
                <p className="text-sm font-semibold text-[var(--color-fg-muted)] animate-pulse">
                  Carregando itens e valores da cotação...
                </p>
              </div>
            )}
            {status === "not-found" && (
              <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4 text-sm font-semibold text-[var(--color-fg)]">
                Cotação não encontrada. Verifique o identificador interno.
              </p>
            )}
            {status === "network-error" && (
              <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4 text-sm font-semibold text-[var(--color-fg)]">
                Falha de rede ao carregar os itens. Tente novamente.
              </p>
            )}
            {status === "idle" && <ItemsList items={data.items} />}
          </section>
        </div>

        {/* Footer do Modal com Botão Fazer Lance */}
        <div className="flex shrink-0 flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-[var(--color-border)] p-4 sm:p-5 bg-[var(--color-bg-subtle)]/60">
          <div className="text-xs text-[var(--color-fg-muted)]">
            {canSubmitProposal
              ? "Ao clicar, o número do orçamento é copiado e o portal SGD é aberto."
              : data.proposalBlocked
                ? "Envio bloqueado conforme instrução da escola."
                : "Esta cotação já foi encerrada."}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {data.proposalUrl && (
              <a
                className="action-secondary inline-flex min-h-11 items-center justify-center px-4 rounded-lg text-sm font-semibold"
                href={data.proposalUrl}
                rel="noreferrer"
                target="_blank"
              >
                Abrir processo direto
              </a>
            )}
            {canSubmitProposal ? (
              <ProposalActionButton
                className="min-h-11 min-w-[180px]"
                label="Fazer lance"
                orderId={data.orderId}
                proposalUrl={data.proposalUrl}
              />
            ) : data.proposalBlocked ? (
              <span className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--color-warning)] px-4 text-sm font-bold text-[var(--color-warning)]">
                Não enviar proposta
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ItemsList({ items }: { items: OpportunityItem[] }) {
  if (items.length === 0) return <p className="mt-4 text-sm text-[var(--color-fg-muted)]">Itens não informados.</p>;
  return (
    <div className="mt-4 grid min-w-0 max-w-full gap-3">
      {items.map((item) => {
        const unitPrice = (item as unknown as { referenceValue?: number | null }).referenceValue ?? item.unitValue;
        const hasUnitPrice = unitPrice !== null && unitPrice !== undefined && Number.isFinite(unitPrice);
        const totalValue = item.totalValue ?? (hasUnitPrice && item.quantity ? item.quantity * unitPrice : null);
        const hasTotalValue = totalValue !== null && totalValue !== undefined && Number.isFinite(totalValue);
        const description = cleanDisplayedDescription(item.description, unitPrice);

        return (
          <article
            className="min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4 transition-colors"
            key={item.order}
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--color-bg-subtle)] text-xs font-bold tabular-nums text-[var(--color-fg)]">
                {item.order}
              </span>
              <h4 className="min-w-0 flex-1 break-words text-sm font-bold leading-5 text-[var(--color-fg)] sm:text-base">
                {item.name}
              </h4>
            </div>

            {description && (
              <p className="mt-2 min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--color-fg-muted)]">
                {description}
              </p>
            )}

            <dl className="mt-3 grid min-w-0 grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-3 text-sm lg:grid-cols-4">
              <ItemMetric label="Unidade" value={item.unit || "Não informado"} />
              <ItemMetric label="Quantidade" value={formatQuantityWithUnit(item.quantity, item.unit)} />
              <ItemMetric
                label="Preço unitário"
                value={hasUnitPrice ? formatCurrency(unitPrice) : "Sem preço de referência"}
              />
              <ItemMetric
                strong
                label="Total do item"
                value={hasTotalValue ? formatCurrency(totalValue) : "Sem preço de referência"}
              />
            </dl>
          </article>
        );
      })}
    </div>
  );
}

function ItemMetric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-md bg-[var(--color-bg-subtle)] px-3 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-fg-muted)]">{label}</dt>
      <dd
        className={`mt-1 min-w-0 break-words text-sm tabular-nums ${
          strong
            ? "font-extrabold text-[var(--color-fg)]"
            : value === "Sem preço de referência"
              ? "italic text-xs font-normal text-[var(--color-fg-muted)]"
              : "font-semibold text-[var(--color-fg)]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export function cleanDisplayedDescription(description: string, unitValue: number | null | undefined) {
  if (unitValue === null || unitValue === undefined || !Number.isFinite(unitValue)) return description;
  return description
    .replace(/\s*(?:[-–—]\s*)?pre[cç]o\s+de\s+refer[eê]ncia\s*:?\s*r\$\s*\d{1,3}(?:\.\d{3})*,\d{2}\s*\.?\s*$/i, "")
    .trim();
}

function getFocusable(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute("disabled") && element.offsetParent !== null);
}

function firstQuantitySummary(opportunity: NormalizedOpportunity) {
  const item = opportunity.items[0];
  if (!item) return null;
  return `${formatQuantityWithUnit(item.quantity, item.unit)} · ${item.name}`;
}

function blockedCountText(opportunity: NormalizedOpportunity) {
  const blocked = opportunity.proposalBlockedItemCount ?? 0;
  const total = opportunity.itemCount;
  if (blocked > 0 && total > 0) return ` (${blocked} de ${total} itens marcados)`;
  return "";
}

function isInteractiveCardClick(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest(".card-link, a, button"));
}

function Fact({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-[var(--color-fg)]">{value}</dd>
    </div>
  );
}

export function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Sem preço de referência";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatOpportunityValue(opportunity: NormalizedOpportunity) {
  if (opportunity.kind === "quotation" && (opportunity.totalValue === null || opportunity.totalValue === undefined)) {
    return "Sem preço de referência";
  }
  const value = formatCurrency(opportunity.totalValue);
  return opportunity.kind === "quotation" && opportunity.isTotalValuePartial ? `a partir de ${value}` : value;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
