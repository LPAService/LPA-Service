"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ProposalActionButton } from "@/components/proposal-action-button";
import type { NormalizedOpportunity, OpportunityItem } from "@/lib/contracts/opportunity";
import { formatQuantityWithUnit } from "@/lib/quantity-format";
import { canSubmitQuotationProposal } from "@/lib/quotation-ui";

type OpportunityCardProps = { opportunity: NormalizedOpportunity };

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("modal") === opportunity.externalId);
  const topItems = opportunity.topItems.length > 0 ? opportunity.topItems.slice(0, 3).join(" · ") : "Itens não informados";
  const isQuotation = opportunity.kind === "quotation";
  const href = `/opportunity/${opportunity.externalId}`;
  const canSubmitProposal = canSubmitQuotationProposal(opportunity);
  const quantitySummary = firstQuantitySummary(opportunity);
  const categoryColor = "text-[var(--color-primary)] bg-[var(--color-bg)] border border-[var(--color-border)]";

  return (
    <>
    <article
      className={`opportunity-card group relative grid min-w-0 gap-6 overflow-hidden bg-[var(--color-bg)] p-6 border border-[var(--color-border)] rounded-[var(--radius-card)] ${isQuotation ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]" : ""}`}
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className={`category-badge text-xs font-semibold px-3 py-1 ${categoryColor}`}>
              {opportunity.expenseGroup || "Categoria"}
            </span>
            {opportunity.category?.name && <span className="text-xs font-medium text-[var(--color-fg-muted)]">• {opportunity.category.name}</span>}
          </div>
          <h2 className="mt-3 text-2xl font-bold leading-[1.15] text-[var(--color-fg)] tracking-tight">{opportunity.headline}</h2>
          {isQuotation && <p className="mt-3 inline-flex items-center gap-2 border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-1 text-xs font-bold tabular-nums text-[var(--color-fg)] rounded-md">Orçamento nº {opportunity.orderId}</p>}
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums text-[var(--color-success)]">R$</span>
            <span className="text-3xl font-bold tabular-nums text-[var(--color-success)]">{formatOpportunityValue(opportunity).replace("a partir de ", "").replace("R$", "")}</span>
          </div>
          {isQuotation && opportunity.isTotalValuePartial && <p className="mt-1 text-xs font-bold text-[var(--color-fg-muted)]">a partir de</p>}
          <p className="mt-1 text-xs font-medium text-[var(--color-fg-muted)]">{pluralize(opportunity.itemCount, "item", "itens")}</p>
          {opportunity.statusLabel && <p className="mt-2 text-xs font-bold text-[var(--color-primary)]">{opportunity.statusLabel}</p>}
        </div>
      </div>

      <div className="border-t border-[var(--color-border)] pt-6">
        <p className="eyebrow text-xs mb-2">O que precisam</p>
        <p className="text-[15px] leading-relaxed text-[var(--color-fg)] line-clamp-3">{opportunity.summary || "Resumo não informado."}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
        <div>
          <p className="eyebrow">Escola</p>
          <p className="font-medium text-[var(--color-fg)] mt-0.5">{opportunity.school}</p>
        </div>
        <div>
          <p className="eyebrow">Cidade</p>
          <p className="font-medium text-[var(--color-fg)] mt-0.5">{opportunity.city || "Não informado"}</p>
        </div>
        {isQuotation && <div>
          <p className="eyebrow">Prazo</p>
          <p className="font-medium text-[var(--color-fg)] mt-0.5">{formatDate(opportunity.proposalDeadline ?? opportunity.proposalDate)}</p>
        </div>}
        <div>
          <p className="eyebrow">Entrega</p>
          <p className="font-medium text-[var(--color-fg)] mt-0.5">{formatDate(opportunity.deliveryDate)}</p>
        </div>
      </div>

      {isQuotation && quantitySummary && <div className="text-sm font-medium text-[var(--color-fg)] pt-4 border-t border-[var(--color-border)]">{quantitySummary}</div>}
      <p className="text-xs text-[var(--color-fg-muted)] line-clamp-2"><span className="font-semibold">Principais itens: </span>{topItems}</p>

      <div className="mt-auto pt-6 border-t border-[var(--color-border)]">
        {canSubmitProposal ? (
          <ProposalActionButton className="card-link w-full items-center justify-between text-left text-sm font-bold text-[var(--color-primary)]" orderId={opportunity.orderId} />
        ) : isQuotation && opportunity.proposalBlocked ? (
          <div className="rounded-md border border-[var(--color-warning)] bg-[var(--color-bg-subtle)] p-3 text-sm font-bold text-[var(--color-fg)]">
            A escola indicou que não é para enviar proposta{blockedCountText(opportunity)}.
          </div>
        ) : isQuotation ? (
          <a className="card-link inline-flex w-full items-center justify-between border-t border-[var(--color-border)] pt-4 text-sm font-bold text-[var(--color-fg-muted)]" href={`/opportunity/${opportunity.externalId}`} onClick={(event) => event.stopPropagation()}>
            Consultar cotação encerrada <span aria-hidden="true" className="ml-1">→</span>
          </a>
        ) : (
          <Link className="card-link inline-flex w-full items-center justify-between border-t border-[var(--color-border)] pt-4 text-sm font-bold text-[var(--color-primary)]" href={href}>
            Ver oportunidade <span aria-hidden="true" className="ml-1">→</span>
          </Link>
        )}
      </div>
    </article>
    {isQuotation && <QuotationModal onClose={() => setIsModalOpen(false)} open={isModalOpen} seed={opportunity} />}
    </>
  );
}

function QuotationModal({ onClose, open, seed }: { onClose: () => void; open: boolean; seed: NormalizedOpportunity }) {
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
          console.error("Falha ao carregar cotação", { externalId: seed.externalId, orderId: seed.orderId, status: response.status });
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
        console.error("Erro de rede ao carregar cotação", { externalId: seed.externalId, orderId: seed.orderId, error });
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
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/45 p-3 sm:p-6" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <div aria-labelledby={titleId} aria-modal="true" className="mx-auto flex max-h-[calc(100svh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-bg)] shadow-2xl sm:max-h-[calc(100vh-3rem)]" ref={dialogRef} role="dialog" tabIndex={-1}>
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--color-border)] p-4 sm:p-6">
          <div className="min-w-0">
            <p className="eyebrow">Orçamento nº <span className="select-all tabular-nums">{data.orderId}</span></p>
            <h2 className="mt-2 text-2xl font-bold leading-tight text-[var(--color-fg)] sm:text-3xl" id={titleId}>{data.headline}</h2>
          </div>
          <button aria-label="Fechar detalhes" className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[var(--color-border)] text-2xl leading-none text-[var(--color-fg)]" onClick={onClose} type="button">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Escola" value={data.school} />
            <Fact label="Cidade" value={data.city ?? "Não informado"} />
            <Fact label="Prazo da proposta" value={formatDateTime(data.proposalDeadline ?? data.proposalDate)} />
            <Fact label="Entrega" value={formatDate(data.deliveryDate)} />
            <Fact label="Grupo de despesa" value={data.expenseGroup} />
            <Fact label="Valor de referência" value={formatOpportunityValue(data)} />
          </div>
          <div className="mt-5 border-l-4 border-[var(--color-accent)] pl-4">
            <p className="eyebrow">Resumo</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--color-fg)]">{data.summary || "Resumo não informado."}</p>
          </div>
          {data.proposalBlocked && <div className="mt-5 rounded-md border border-[var(--color-warning)] bg-[var(--color-bg-subtle)] p-4 text-sm text-[var(--color-fg)]">
            <p className="font-bold">A escola indicou que não é para enviar proposta{blockedCountText(data)}.</p>
            <p className="mt-2 font-semibold text-[var(--color-fg-muted)]">Trecho original:</p>
            <p className="mt-1 whitespace-pre-wrap break-words">{data.proposalBlockedReason || "Trecho não informado."}</p>
          </div>}
          <section className="mt-6 min-w-0">
            <h3 className="text-xl font-bold text-[var(--color-fg)]">Lista completa de itens · {pluralize(data.itemCount, "item", "itens")}</h3>
            {status === "loading" && <p className="mt-4 text-sm font-semibold text-[var(--color-fg-muted)]">Carregando itens...</p>}
            {status === "not-found" && <p className="mt-4 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4 text-sm font-semibold text-[var(--color-fg)]">Cotação não encontrada. Verifique o identificador interno.</p>}
            {status === "network-error" && <p className="mt-4 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4 text-sm font-semibold text-[var(--color-fg)]">Falha de rede ao carregar os itens. Tente novamente.</p>}
            {status === "idle" && <ItemsTable items={data.items} />}
          </section>
        </div>
        <div className="flex shrink-0 flex-col gap-3 border-t border-[var(--color-border)] p-4 sm:flex-row sm:items-center sm:justify-end sm:p-5">
          {data.proposalUrl && <a className="action-secondary inline-flex min-h-11 items-center justify-center" href={data.proposalUrl} rel="noreferrer" target="_blank">Abrir processo direto</a>}
          {canSubmitProposal ? <ProposalActionButton className="action-primary inline-flex min-h-11 items-center justify-center gap-2" orderId={data.orderId} /> : data.proposalBlocked ? <span className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--color-warning)] px-4 text-sm font-bold text-[var(--color-fg)]">Não enviar proposta</span> : null}
        </div>
      </div>
    </div>
  );
}

function ItemsTable({ items }: { items: OpportunityItem[] }) {
  if (items.length === 0) return <p className="mt-4 text-sm text-[var(--color-fg-muted)]">Itens não informados.</p>;
  return <div className="mt-4 min-w-0 max-w-full overflow-x-auto overscroll-x-contain"><table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm"><thead><tr className="bg-[var(--color-bg-subtle)] text-xs uppercase text-[var(--color-fg-muted)]"><th className="border-b border-[var(--color-border)] px-3 py-3">Nº</th><th className="border-b border-[var(--color-border)] px-3">Item</th><th className="border-b border-[var(--color-border)] px-3">Descrição</th><th className="border-b border-[var(--color-border)] px-3">Unidade</th><th className="border-b border-[var(--color-border)] px-3 text-right">Quantidade</th><th className="border-b border-[var(--color-border)] px-3 text-right">Preço de referência</th><th className="border-b border-[var(--color-border)] px-3 text-right">Total do item</th></tr></thead><tbody>{items.map((item) => <tr className="align-top" key={item.order}><td className="border-b border-[var(--color-border)] px-3 py-4 font-semibold tabular-nums text-[var(--color-fg)]">{item.order}</td><td className="border-b border-[var(--color-border)] px-3 py-4 font-semibold text-[var(--color-fg)]">{item.name}</td><td className="max-w-md border-b border-[var(--color-border)] px-3 py-4 leading-5 text-[var(--color-fg-muted)]">{item.description}</td><td className="border-b border-[var(--color-border)] px-3 py-4 text-[var(--color-fg-muted)]">{item.unit}</td><td className="border-b border-[var(--color-border)] px-3 py-4 text-right tabular-nums text-[var(--color-fg-muted)]">{formatQuantityWithUnit(item.quantity, item.unit)}</td><td className="border-b border-[var(--color-border)] px-3 py-4 text-right tabular-nums text-[var(--color-fg-muted)]">{formatCurrency(item.unitValue)}</td><td className="border-b border-[var(--color-border)] px-3 py-4 text-right font-semibold tabular-nums text-[var(--color-fg)]">{formatCurrency(item.totalValue)}</td></tr>)}</tbody></table></div>;
}

function getFocusable(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute("disabled") && element.offsetParent !== null);
}

function firstQuantitySummary(opportunity: NormalizedOpportunity) {
  const item = opportunity.items[0];
  if (!item) return null;
  return `${formatQuantityWithUnit(item.quantity, item.unit)} · ${item.name}`;
}

function blockedCountText(opportunity: NormalizedOpportunity) {
  const blocked = opportunity.proposalBlockedItemCount ?? 0;
  const total = opportunity.itemCount;
  if (blocked > 0 && total > 0 && blocked < total) return ` (${blocked} de ${total} itens marcados)`;
  if (blocked > 0 && total > 0) return ` (${blocked} de ${total} itens marcados)`;
  return "";
}

function isInteractiveCardClick(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest(".card-link, a, button"));
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

export function formatOpportunityValue(opportunity: NormalizedOpportunity) {
  if (opportunity.kind === "quotation" && opportunity.totalValue === null) return "Valor a definir";
  const value = formatCurrency(opportunity.totalValue);
  return opportunity.kind === "quotation" && opportunity.isTotalValuePartial ? `a partir de ${value}` : value;
}

export function formatDate(value: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function formatDateTime(value: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
