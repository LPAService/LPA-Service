"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import type { BestPriceResult } from "@/lib/search/best-price";
import { providerLabel } from "@/lib/search/best-price";
import type { CatalogItemLite, CatalogMatch } from "@/lib/catalog/match";
import type { ReferenceMatch } from "@/lib/catalog/reference-match";
import { isRelevantReferenceTitle } from "@/lib/catalog/reference-name-match";
import { calcPreQuoteTotals, formatBRL, formatPercent } from "@/lib/prequote/calc";
import { ProposalActionButton } from "@/components/proposal-action-button";

export type WorksheetRow = {
  itemOrder: number;
  name: string;
  description: string;
  unit: string;
  quantity: number;
  referenceUnitValue: number | null;
  supplierId: number | null;
  catalogItemId: number | null;
  unitCost: number | null;
  source: "none" | "catalog" | "manual" | "web";
  webTitle: string | null;
  webPrice: number | null;
  webUrl: string | null;
  notes: string | null;
};

export type WorksheetQuotation = {
  externalId: string;
  orderId: string;
  school: string;
  city: string | null;
  expenseGroup: string;
  headline: string;
  proposalDeadline: string | null;
  proposalUrl?: string | null;
  canSubmitProposal?: boolean;
  proposalBlocked?: boolean;
  proposalBlockedReason?: string | null;
  totalReferenceValue: number | null;
  categoryName: string | null;
};

type PrequoteWorksheetProps = {
  quotation: WorksheetQuotation;
  initialPreQuoteId: number | null;
  initialRows: WorksheetRow[];
  referenceSuggestions?: Record<number, ReferenceMatch[]>;
  suggestions: Record<number, CatalogMatch[]>;
  catalogItems: CatalogItemLite[];
  initialMarginPercent?: number;
  initialFreightCost?: number;
  initialStatus?: "draft" | "closed";
  initialNotes?: string;
};

export function PrequoteWorksheet({
  quotation,
  initialPreQuoteId,
  initialRows,
  referenceSuggestions = {},
  suggestions,
  catalogItems,
  initialMarginPercent = 0,
  initialFreightCost = 0,
  initialStatus = "draft",
  initialNotes = ""
}: PrequoteWorksheetProps) {
  const [rows, setRows] = useState<WorksheetRow[]>(initialRows);
  const [preQuoteId, setPreQuoteId] = useState<number | null>(initialPreQuoteId);
  const [marginText, setMarginText] = useState(String(initialMarginPercent));
  const [freightText, setFreightText] = useState(String(initialFreightCost));
  const [status, setStatus] = useState<"draft" | "closed">(initialStatus);
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchingRow, setSearchingRow] = useState<number | null>(null);
  const [searchResults, setSearchResults] = useState<Record<number, BestPriceResult>>({});
  const [openSearchRow, setOpenSearchRow] = useState<number | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<Record<string, BestPriceResult>>({});

  useEffect(() => {
    let active = true;
    const rowsWithoutCost = initialRows.filter((r) => r.unitCost === null && r.name.trim());
    const queries = Array.from(new Set(rowsWithoutCost.map((r) => r.name.trim()))).slice(0, 40);

    if (queries.length === 0) return;

    setBatchLoading(true);
    fetch("/api/search/best-price/batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ queries })
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (data.results && typeof data.results === "object") {
          setBatchResults(data.results as Record<string, BestPriceResult>);
        }
      })
      .catch(() => {
        // Silêncio em caso de erro na busca em lote
      })
      .finally(() => {
        if (active) {
          setBatchLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [initialRows]);

  const marginPercent = parseNonNegative(marginText);
  const freightCost = parseNonNegative(freightText);
  const totals = useMemo(
    () => calcPreQuoteTotals(rows, marginPercent, freightCost),
    [rows, marginPercent, freightCost]
  );
  const referenceDiff = quotation.totalReferenceValue !== null ? totals.suggestedValue - quotation.totalReferenceValue : null;

  const catalogById = useMemo(() => new Map(catalogItems.map((item) => [item.id, item])), [catalogItems]);
  const suppliers = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of catalogItems) map.set(item.supplierId, item.supplierName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [catalogItems]);

  function updateRow(itemOrder: number, patch: Partial<WorksheetRow>) {
    setRows((current) =>
      current.map((row) => (row.itemOrder === itemOrder ? { ...row, ...patch } : row))
    );
  }

  function pickCatalogItem(itemOrder: number, catalogItemId: number | null) {
    const row = rows.find((candidate) => candidate.itemOrder === itemOrder);
    if (!row) return;
    if (catalogItemId === null) {
      updateRow(itemOrder, {
        supplierId: null,
        catalogItemId: null,
        unitCost: null,
        source: "none",
        webTitle: null,
        webPrice: null,
        webUrl: null
      });
      return;
    }
    const item = catalogById.get(catalogItemId);
    if (!item) return;
    updateRow(itemOrder, {
      supplierId: item.supplierId,
      catalogItemId: item.id,
      unitCost: item.unitPrice,
      source: "catalog",
      webTitle: null,
      webPrice: null,
      webUrl: null
    });
  }

  function setManualCost(itemOrder: number, value: string) {
    const parsed = value.trim() === "" ? null : Number(value.replace(",", "."));
    const unitCost = parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    updateRow(itemOrder, {
      unitCost,
      source: "manual",
      catalogItemId: null,
      supplierId: null,
      webTitle: null,
      webPrice: null,
      webUrl: null
    });
  }

  async function searchWeb(itemOrder: number) {
    const row = rows.find((candidate) => candidate.itemOrder === itemOrder);
    if (!row || searchingRow !== null) return;
    setSearchingRow(itemOrder);
    setError(null);
    setOpenSearchRow(itemOrder);
    setSearchResults((current) => ({ ...current, [itemOrder]: { query: row.name, provider: "…", offers: [], error: null } }));
    try {
      const response = await fetch(
        `/api/search/best-price?q=${encodeURIComponent(row.name)}&limit=5`
      );
      const payload = (await response.json()) as BestPriceResult;
      setSearchResults((current) => ({ ...current, [itemOrder]: payload }));
    } catch {
      setSearchResults((current) => ({
        ...current,
        [itemOrder]: { query: row.name, provider: "none", offers: [], error: "Falha ao buscar preços." }
      }));
    } finally {
      setSearchingRow(null);
    }
  }

  function applyWebOffer(itemOrder: number, title: string, price: number, url: string) {
    updateRow(itemOrder, {
      unitCost: price,
      source: "web",
      catalogItemId: null,
      supplierId: null,
      webTitle: title,
      webPrice: price,
      webUrl: url
    });
    setOpenSearchRow(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSavedAt(null);
    const payload = {
      quotationExternalId: quotation.externalId,
      orderId: quotation.orderId,
      schoolName: quotation.school,
      city: quotation.city,
      expenseGroup: quotation.expenseGroup,
      headline: quotation.headline,
      marginPercent,
      freightCost,
      status,
      notes,
      items: rows.map((row) => ({
        itemOrder: row.itemOrder,
        name: row.name,
        description: row.description,
        unit: row.unit,
        quantity: row.quantity,
        referenceValue: row.referenceUnitValue,
        supplierId: row.supplierId,
        catalogItemId: row.catalogItemId,
        unitCost: row.unitCost,
        source: row.source,
        webTitle: row.webTitle,
        webPrice: row.webPrice,
        webUrl: row.webUrl,
        notes: row.notes
      }))
    };
    try {
      const response = await fetch(
        preQuoteId === null ? "/api/prequotes" : `/api/prequotes/${preQuoteId}`,
        {
          method: preQuoteId === null ? "POST" : "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Falha ao salvar pré-orçamento.");
      setPreQuoteId(result.preQuote.id);
      setSavedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao salvar pré-orçamento.");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const header = ["Item", "Descrição", "Unidade", "Quantidade", "Ref. unitário", "Custo unitário", "Total", "Origem", "Fornecedor/Anúncio", "Link"];
    const lines = rows.map((row) => {
      const supplierName =
        row.catalogItemId !== null ? catalogById.get(row.catalogItemId)?.supplierName ?? "" : "";
      return [
        row.name,
        row.description,
        row.unit,
        String(row.quantity),
        row.referenceUnitValue ?? "",
        row.unitCost ?? "",
        row.unitCost !== null ? String(row.unitCost * row.quantity) : "",
        sourceLabel(row.source),
        row.source === "web" ? row.webTitle ?? "" : supplierName,
        row.webUrl ?? ""
      ].map((cell) => String(cell)).map(escapeCsv).join(";");
    });
    const summary = [
      ["", "", "", "", "", "", "", "", "", ""],
      ["Custo dos itens", "", "", "", "", "", formatBRL(totals.costSubtotal), "", "", ""],
      ["Frete", "", "", "", "", "", formatBRL(totals.freightCost), "", "", ""],
      [`Margem (${totals.marginPercent}%)`, "", "", "", "", "", formatBRL(totals.marginValue), "", "", ""],
      ["Valor sugerido da proposta", "", "", "", "", "", formatBRL(totals.suggestedValue), "", "", ""],
      ["Referência da escola", "", "", "", "", "", quotation.totalReferenceValue !== null ? formatBRL(quotation.totalReferenceValue) : "—", "", "", ""]
    ].map((line) => line.map(escapeCsv).join(";"));
    const content = "\uFEFF" + [header.map(escapeCsv).join(";"), ...lines, ...summary].join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pre-orcamento-${quotation.orderId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(19rem,1fr)]">
      <div className="grid min-w-0 gap-4 content-start">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-fg-muted)]">
            Esta cotação não possui itens publicados no portal. Sem itens não há o que pré-orçar.
          </div>
        ) : (
          rows.map((row) => {
            const lineRef = row.referenceUnitValue !== null ? row.referenceUnitValue * row.quantity : null;
            const lineCost = row.unitCost !== null ? row.unitCost * row.quantity : null;
            const rowSuggestions = suggestions[row.itemOrder] ?? [];
            const rowReferenceSuggestions = getUniqueReferenceMatches(referenceSuggestions[row.itemOrder] ?? []);
            const autoPriceResult = batchResults[row.name.trim()] ?? batchResults[row.name];
            const autoRealOffer = autoPriceResult?.offers?.find((offer) => isRelevantReferenceTitle(row.name, offer.title));
            const hasAnySuggestions =
              rowSuggestions.length > 0 ||
              batchLoading ||
              Boolean(autoRealOffer) ||
              rowReferenceSuggestions.length > 0;
            const result = searchResults[row.itemOrder];
            const isSearching = searchingRow === row.itemOrder;
            const isSearchOpen = openSearchRow === row.itemOrder;
            return (
              <article
                className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 shadow-[var(--shadow-card)]"
                key={row.itemOrder}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="eyebrow text-xs">Item {row.itemOrder}</p>
                    <h3 className="mt-1 min-w-0 break-words font-bold leading-snug text-[var(--color-fg)]">
                      {row.name}
                    </h3>
                  </div>
                  {row.source !== "none" && (
                    <span className="shrink-0 rounded-full border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/15 px-2.5 py-0.5 text-[10px] font-bold text-[var(--color-primary)]">
                      {sourceLabel(row.source)}
                    </span>
                  )}
                </div>
                {row.description && (
                  <p className="mt-2 text-xs leading-relaxed text-[var(--color-fg-muted)]">{row.description}</p>
                )}
                <p className="mt-2 text-xs font-semibold tabular-nums text-[var(--color-fg-muted)]">
                  {formatQuantity(row.quantity)} {row.unit} · ref. escola:{" "}
                  {row.referenceUnitValue !== null ? formatBRL(row.referenceUnitValue) : "sem referência"}
                  {lineRef !== null && <span className="font-normal"> (linha: {formatBRL(lineRef)})</span>}
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9.5rem_9.5rem]">
                  <label>
                    <span className="field-label">Item do catálogo</span>
                    <select
                      className="field mt-1"
                      onChange={(event) =>
                        pickCatalogItem(row.itemOrder, event.target.value === "" ? null : Number(event.target.value))
                      }
                      value={row.catalogItemId ?? ""}
                    >
                      <option value="">— definir manualmente ou buscar —</option>
                      {suppliers.map(([supplierId, supplierName]) => (
                        <optgroup key={supplierId} label={supplierName}>
                          {catalogItems
                            .filter((item) => item.supplierId === supplierId)
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.unit}) — {formatBRL(item.unitPrice)}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Custo unitário (R$)</span>
                    <input
                      className="field mt-1 tabular-nums"
                      min="0"
                      onChange={(event) => setManualCost(row.itemOrder, event.target.value)}
                      placeholder="0,00"
                      step="0.01"
                      type="number"
                      value={row.unitCost ?? ""}
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      className="action-secondary inline-flex min-h-11 w-full items-center justify-center gap-1.5 text-sm font-semibold"
                      disabled={isSearching}
                      onClick={() => searchWeb(row.itemOrder)}
                      title="Busca o menor preço na internet para este item"
                      type="button"
                    >
                      {isSearching ? "Buscando…" : "🔎 Internet"}
                    </button>
                  </div>
                </div>

                {row.unitCost === null && hasAnySuggestions && (
                  <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)]/70 p-3 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-fg-muted)]">
                      <span>💡 Sugestões para este item</span>
                    </div>

                    {/* a. Catálogo próprio */}
                    {rowSuggestions.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-fg-muted)]">
                          Catálogo próprio:
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {rowSuggestions.map((suggestion) => (
                            <button
                              className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-xs font-semibold text-[var(--color-fg)] hover:border-[var(--color-primary)]/50 transition-colors"
                              key={suggestion.item.id}
                              onClick={() => pickCatalogItem(row.itemOrder, suggestion.item.id)}
                              title={`Usar preço do catálogo: ${suggestion.item.supplierName}`}
                              type="button"
                            >
                              {suggestion.item.supplierName} · {suggestion.item.name} — {formatBRL(suggestion.item.unitPrice)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* b. Real Distribuidora */}
                    {batchLoading && (
                      <div className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                        <span>Buscando preço na Real Distribuidora…</span>
                      </div>
                    )}

                    {!batchLoading && autoRealOffer && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-fg-muted)]">
                          Oferta encontrada ({providerLabel(autoRealOffer.provider || "realdist")}):
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded bg-[var(--color-primary)]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-primary)]">
                                {providerLabel(autoRealOffer.provider || "realdist")}
                              </span>
                              <span className="font-semibold text-xs text-[var(--color-fg)] break-words" title={autoRealOffer.title}>
                                {autoRealOffer.title}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-fg-muted)]">
                              {autoRealOffer.seller && <span>Vendido por: <strong>{autoRealOffer.seller}</strong></span>}
                              {autoRealOffer.url && (
                                <a
                                  className="text-[var(--color-primary)] underline hover:opacity-80"
                                  href={autoRealOffer.url}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  ver anúncio ↗
                                </a>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className="text-sm font-extrabold tabular-nums text-[var(--color-success)]">
                              {formatBRL(autoRealOffer.price)}
                            </span>
                            <button
                              className="action-primary !min-h-8 !px-3 !py-1 text-xs"
                              onClick={() => applyWebOffer(row.itemOrder, autoRealOffer.title, autoRealOffer.price, autoRealOffer.url)}
                              type="button"
                            >
                              Usar preço
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* c. Cescom (Identificação do produto, SEM preço) */}
                    {rowReferenceSuggestions.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-fg-muted)]">
                          Identificação do produto (Cescom):
                        </p>
                        <div className="grid gap-1.5">
                          {rowReferenceSuggestions.map((match) => (
                            <div
                              className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg)]/80 p-2 text-xs"
                              key={match.item.id}
                            >
                              <div className="flex flex-wrap items-baseline justify-between gap-1.5">
                                <span className="font-medium text-[var(--color-fg)] break-words">
                                  {match.item.name}
                                </span>
                                {match.item.url && (
                                  <a
                                    className="text-[11px] text-[var(--color-primary)] hover:underline shrink-0"
                                    href={match.item.url}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    ver no Cescom ↗
                                  </a>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--color-fg-muted)]">
                                {match.item.brand && (
                                  <span>Marca: <strong className="text-[var(--color-fg)]">{match.item.brand}</strong></span>
                                )}
                                {match.item.ean && (
                                  <span>EAN: <strong className="tabular-nums text-[var(--color-fg)]">{match.item.ean}</strong></span>
                                )}
                                {match.item.department && (
                                  <span>Depto: {match.item.department}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {row.source === "web" && row.webTitle && (
                  <div className="mt-3 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-bg-subtle)] p-3 text-xs text-[var(--color-fg-muted)]">
                    <p className="font-bold">🌐 Menor preço encontrado na internet:</p>
                    <p className="mt-1">{row.webTitle}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      <span className="font-bold tabular-nums">{formatBRL(row.webPrice ?? row.unitCost ?? 0)}</span>
                      {row.webUrl && (
                        <a className="text-[var(--color-primary)] underline" href={row.webUrl} rel="noreferrer" target="_blank">
                          ver anúncio ↗
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {lineCost !== null && (
                  <p className="mt-3 text-right text-sm font-extrabold tabular-nums text-[var(--color-success)]">
                    Total da linha: {formatBRL(lineCost)}
                  </p>
                )}

                {isSearchOpen && (
                  <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-fg-muted)]">
                        Resultados da internet{result && result.provider !== "none" && ` · ${result.provider.split("+").map(providerLabel).join(" + ")}`}
                      </p>
                      <button
                        className="text-xs font-semibold text-[var(--color-fg-muted)] hover:underline"
                        onClick={() => setOpenSearchRow(null)}
                        type="button"
                      >
                        fechar ✕
                      </button>
                    </div>
                    {isSearching && <p className="mt-3 text-sm text-[var(--color-fg-muted)]">Buscando melhores preços…</p>}
                    {!isSearching && result?.error && (
                      <p className="mt-3 text-sm font-semibold text-[var(--color-warning)]">{result.error}</p>
                    )}
                    {!isSearching && result && result.offers.length === 0 && !result.error && (
                      <p className="mt-3 text-sm text-[var(--color-fg-muted)]">Nenhuma oferta encontrada para este item.</p>
                    )}
                    {!isSearching && result && result.offers.length > 0 && (
                      <ul className="mt-3 grid gap-2">
                        {result.offers.map((offer, index) => (
                          <li
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
                            key={`${offer.url}-${index}`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-[var(--color-fg)]" title={offer.title}>
                                {offer.title}
                              </p>
                              <p className="text-xs text-[var(--color-fg-muted)]">
                                {offer.seller ? `${offer.seller} · ` : ""}
                                {offer.condition === "new" ? "novo" : offer.condition ?? ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-extrabold tabular-nums text-[var(--color-success)]">
                                {formatBRL(offer.price)}
                              </span>
                              <button
                                className="action-primary !px-3 !py-1.5 text-xs"
                                onClick={() => applyWebOffer(row.itemOrder, offer.title, offer.price, offer.url)}
                                type="button"
                              >
                                Usar preço
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      <aside className="grid h-fit content-start gap-5 lg:sticky lg:top-24">
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-xl">
          <h2 className="text-lg font-bold text-[var(--color-fg)]">Resumo do Pré-Orçamento</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[var(--color-fg-muted)]">Custo dos itens</dt>
              <dd className="font-bold tabular-nums text-[var(--color-fg)]">{formatBRL(totals.costSubtotal)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[var(--color-fg-muted)]">Itens sem preço</dt>
              <dd className={`font-bold tabular-nums ${totals.missingCount > 0 ? "text-[var(--color-warning)]" : "text-[var(--color-success)]"}`}>
                {totals.missingCount} de {rows.length}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[var(--color-fg-muted)]">Referência da escola</dt>
              <dd className="font-bold tabular-nums text-[var(--color-fg)]">
                {quotation.totalReferenceValue !== null ? formatBRL(quotation.totalReferenceValue) : "—"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[var(--color-fg-muted)]">Valor sugerido</dt>
              <dd className="text-xl font-extrabold tabular-nums text-[var(--color-primary)]">
                {formatBRL(totals.suggestedValue)}
              </dd>
            </div>
            {referenceDiff !== null && (
              <div className="flex items-baseline justify-between gap-3 border-t border-[var(--color-border)] pt-3">
                <dt className="text-[var(--color-fg-muted)]">Vs. referência</dt>
                <dd className={`font-bold tabular-nums ${referenceDiff <= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                  {formatBRL(referenceDiff)}{" "}
                  <span className="text-xs">({formatPercent(referenceDiff / (quotation.totalReferenceValue || 1) * 100)})</span>
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-5 grid gap-3 border-t border-[var(--color-border)] pt-4">
            <label>
              <span className="field-label">Frete / outros custos (R$)</span>
              <input
                className="field mt-1 tabular-nums"
                min="0"
                onChange={(event) => setFreightText(event.target.value)}
                step="0.01"
                type="number"
                value={freightText}
              />
            </label>
            <label>
              <span className="field-label">Margem (%)</span>
              <input
                className="field mt-1 tabular-nums"
                min="0"
                onChange={(event) => setMarginText(event.target.value)}
                step="0.5"
                type="number"
                value={marginText}
              />
            </label>
            <label>
              <span className="field-label">Situação</span>
              <select className="field mt-1" onChange={(event) => setStatus(event.target.value === "closed" ? "closed" : "draft")} value={status}>
                <option value="draft">Rascunho (ainda orçando)</option>
                <option value="closed">Fechado (preços definidos)</option>
              </select>
            </label>
            <label>
              <span className="field-label">Anotações</span>
              <textarea
                className="field mt-1"
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Condições comerciais, prazo de validade da proposta…"
                rows={3}
                value={notes}
              />
            </label>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-bg-subtle)] p-3 text-xs font-semibold text-[var(--color-danger)]">
              {error}
            </div>
          )}
          {savedAt && !error && (
            <div className="mt-4 rounded-lg badge-success p-3 text-xs font-semibold">
              ✓ Pré-orçamento salvo às {savedAt}.
            </div>
          )}

          <div className="mt-4 grid gap-2">
            <button className="action-primary w-full" disabled={busy} onClick={save} type="button">
              {busy ? "Salvando…" : "Salvar pré-orçamento"}
            </button>
            <button className="action-secondary w-full" onClick={exportCsv} type="button">
              Exportar CSV
            </button>
            <ProposalActionButton
              className="w-full"
              canSubmitProposal={quotation.canSubmitProposal}
              disabled={quotation.proposalBlocked}
              disabledReason={quotation.proposalBlockedReason}
              label="Fazer lance no portal"
              orderId={quotation.orderId}
              proposalUrl={quotation.proposalUrl}
            />
            <Link className="action-secondary inline-flex min-h-11 items-center justify-center" href="/preorcamento">
              ← Voltar para pré-orçamentos
            </Link>
          </div>
        </section>
      </aside>
    </div>
  );
}

function parseNonNegative(value: string) {
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function formatQuantity(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function sourceLabel(source: WorksheetRow["source"]) {
  switch (source) {
    case "catalog":
      return "CATÁLOGO";
    case "manual":
      return "MANUAL";
    case "web":
      return "INTERNET";
    default:
      return "—";
  }
}

function escapeCsv(value: string) {
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function getUniqueReferenceMatches(matches: ReferenceMatch[] = []): ReferenceMatch[] {
  const seen = new Set<string>();
  const result: ReferenceMatch[] = [];
  for (const match of matches) {
    const key = match.item.name.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(match);
    }
  }
  return result;
}
