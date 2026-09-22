"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { BestPriceResult } from "@/lib/search/best-price";
import { providerLabel } from "@/lib/search/best-price";
import type { CatalogItemLite, CatalogMatch } from "@/lib/catalog/match";
import type { ReferenceMatch } from "@/lib/catalog/reference-match";
import { isRelevantReferenceTitle } from "@/lib/catalog/reference-name-match";
import { describeUnitHint, extractUnitHint } from "@/lib/prequote/unit-hint";
import { calcPreQuoteLineTotals, calcPreQuoteTotals, formatBRL, formatPercent } from "@/lib/prequote/calc";
import { removeBrandFromText } from "@/lib/prequote/remove-brand";
import { generatePrequoteDescription } from "@/lib/prequote/generate-description";
import { generatePrequoteWarranty } from "@/lib/prequote/generate-warranty";
import { ProposalActionButton } from "@/components/proposal-action-button";
import { buildBestPriceSearchQuery } from "@/lib/search/best-price-query";
import { pingPilotExtension, sendPilotJob } from "@/lib/prequote/pilot-bridge";

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
  warranty: string | null;
  brandOptions?: string[];
  chosenBrand?: string | null;
};

export type WorksheetQuotation = {
  externalId: string;
  orderId: string;
  school: string;
  city: string | null;
  expenseGroup: string;
  headline: string;
  proposalDeadline: string | null;
  deliveryDate: string | null;
  proposalUrl?: string | null;
  canSubmitProposal?: boolean;
  proposalBlocked?: boolean;
  proposalBlockedReason?: string | null;
  totalReferenceValue: number | null;
  categorySlug: string | null;
  categoryName: string | null;
};

export const SERVICE_CATEGORIES = new Set<string>([
  "servicos",
  "transporte",
  "capacitacao-formacao"
]);

type PrequoteWorksheetProps = {
  quotation: WorksheetQuotation;
  initialPreQuoteId: number | null;
  initialRows: WorksheetRow[];
  referenceSuggestions?: Record<number, ReferenceMatch[]>;
  suggestions: Record<number, CatalogMatch[]>;
  catalogItems: CatalogItemLite[];
  referenceBrands?: string[];
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
  referenceBrands = [],
  initialMarginPercent = 0,
  initialFreightCost = 0,
  initialStatus = "draft",
  initialNotes = ""
}: PrequoteWorksheetProps) {
  const isServiceCategory = Boolean(quotation.categorySlug && SERVICE_CATEGORIES.has(quotation.categorySlug));
  const [rows, setRows] = useState<WorksheetRow[]>(() => initialRows.map((row) => {
    const generatedDescription = row.notes?.trim()
      ? row.notes
      : generatePrequoteDescription(row.name, row.description, row.quantity, row.unit, referenceBrands);
    const generatedWarranty = row.warranty !== null && row.warranty !== undefined
      ? row.warranty
      : generatePrequoteWarranty(quotation.categorySlug, referenceBrands);
    return {
      ...row,
      brandOptions: row.brandOptions ?? [],
      chosenBrand: row.chosenBrand ?? null,
      notes: generatedDescription || row.notes,
      warranty: generatedWarranty || row.warranty
    };
  }));
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
  const [copiedItemOrder, setCopiedItemOrder] = useState<number | null>(null);
  const [copiedWarrantyItemOrder, setCopiedWarrantyItemOrder] = useState<number | null>(null);
  const [copiedDeliveryDate, setCopiedDeliveryDate] = useState(false);
  const copyFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pilotLoading, setPilotLoading] = useState(false);
  const [pilotMode, setPilotMode] = useState<"extension" | "clipboard" | null>(null);
  const [pilotBlockers, setPilotBlockers] = useState<string[] | null>(null);
  const [pilotError, setPilotError] = useState<string | null>(null);
  const [pilotExtension, setPilotExtension] = useState(false);

  useEffect(() => () => {
    if (copyFeedbackTimer.current) clearTimeout(copyFeedbackTimer.current);
  }, []);

  // A extensão marca o <html> ao carregar; o ping confirma que ela responde.
  useEffect(() => {
    let alive = true;
    pingPilotExtension().then((version) => {
      if (alive) setPilotExtension(Boolean(version));
    });
    return () => {
      alive = false;
    };
  }, []);

  function generatedDescription(row: WorksheetRow) {
    return generatePrequoteDescription(row.name, row.description, row.quantity, row.unit, referenceBrands);
  }

  function hasOnlyGeneratedDescription(row: WorksheetRow) {
    const generated = generatedDescription(row);
    return Boolean(generated) && row.notes?.trim() === generated;
  }

  useEffect(() => {
    if (isServiceCategory) return;
    let active = true;
    const rowsWithoutCost = initialRows.filter((r) => r.unitCost === null && r.name.trim());
    const queries = Array.from(new Set(rowsWithoutCost.map((r) => buildBestPriceSearchQuery(r.name, r.description))))
      .slice(0, 40)
      .map((query) => ({
        query,
        categorySlug: quotation.categorySlug,
        categoryName: quotation.categoryName,
        expenseGroup: quotation.expenseGroup
      }));

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
  }, [initialRows, isServiceCategory, quotation.categoryName, quotation.categorySlug, quotation.expenseGroup]);

  const marginPercent = parseNonNegative(marginText);
  const freightCost = parseNonNegative(freightText);
  const totals = useMemo(
    () => calcPreQuoteTotals(rows, marginPercent, freightCost),
    [rows, marginPercent, freightCost]
  );
  const hasMissingPrices = totals.missingCount > 0;
  const rowsWithBrandOptions = useMemo(
    () => rows.filter((r) => Array.isArray(r.brandOptions) && r.brandOptions.length > 0),
    [rows]
  );
  const missingBrandCount = useMemo(
    () => rowsWithBrandOptions.filter((r) => !r.chosenBrand).length,
    [rowsWithBrandOptions]
  );
  const hasMissingBrands = missingBrandCount > 0;

  const sumLineReferenceValue = useMemo(() => {
    let sum = 0;
    let hasAnyLineRef = false;
    for (const row of rows) {
      if (row.referenceUnitValue !== null && row.referenceUnitValue >= 0) {
        sum += row.referenceUnitValue * row.quantity;
        hasAnyLineRef = true;
      }
    }
    return hasAnyLineRef ? sum : null;
  }, [rows]);

  const isReferenceInconsistent = useMemo(() => {
    if (quotation.totalReferenceValue === null || sumLineReferenceValue === null) return false;
    if (quotation.totalReferenceValue === 0 && sumLineReferenceValue === 0) return false;
    const maxVal = Math.max(Math.abs(quotation.totalReferenceValue), Math.abs(sumLineReferenceValue));
    if (maxVal === 0) return false;
    const diff = Math.abs(quotation.totalReferenceValue - sumLineReferenceValue);
    return diff / maxVal > 0.05;
  }, [quotation.totalReferenceValue, sumLineReferenceValue]);

  const referenceDiff = !hasMissingPrices && quotation.totalReferenceValue !== null
    ? totals.suggestedValue - quotation.totalReferenceValue
    : null;

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
      webUrl: null,
      notes: row.notes?.trim() && !hasOnlyGeneratedDescription(row)
        ? row.notes
        : removeBrandFromText(item.name, referenceBrands)
    });
  }

  function applyReferenceSuggestion(itemOrder: number, title: string) {
    const row = rows.find((candidate) => candidate.itemOrder === itemOrder);
    if (!row || (row.notes?.trim() && !hasOnlyGeneratedDescription(row))) return;
    updateRow(itemOrder, {
      notes: removeBrandFromText(title, referenceBrands)
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
    const query = buildBestPriceSearchQuery(row.name, row.description);
    setSearchingRow(itemOrder);
    setError(null);
    setOpenSearchRow(itemOrder);
    setSearchResults((current) => ({ ...current, [itemOrder]: { query, provider: "…", offers: [], error: null } }));
    try {
      const params = new URLSearchParams({ q: query, limit: "5" });
      if (quotation.categorySlug) params.set("categorySlug", quotation.categorySlug);
      if (quotation.categoryName) params.set("categoryName", quotation.categoryName);
      if (quotation.expenseGroup) params.set("expenseGroup", quotation.expenseGroup);
      const response = await fetch(
        `/api/search/best-price?${params.toString()}`
      );
      const payload = (await response.json()) as BestPriceResult;
      setSearchResults((current) => ({ ...current, [itemOrder]: payload }));
    } catch {
      setSearchResults((current) => ({
        ...current,
        [itemOrder]: { query, provider: "none", offers: [], error: "Falha ao buscar preços." }
      }));
    } finally {
      setSearchingRow(null);
    }
  }

  function applyWebOffer(itemOrder: number, title: string, price: number, url: string) {
    const row = rows.find((candidate) => candidate.itemOrder === itemOrder);
    if (!row) return;
    updateRow(itemOrder, {
      unitCost: price,
      source: "web",
      catalogItemId: null,
      supplierId: null,
      webTitle: title,
      webPrice: price,
      webUrl: url,
      notes: row.notes?.trim() && !hasOnlyGeneratedDescription(row)
        ? row.notes
        : removeBrandFromText(title, referenceBrands)
    });
    setOpenSearchRow(null);
  }

  async function copyValue(value: string, onCopied: () => void, errorMessage: string) {
    if (!value.trim()) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const helper = document.createElement("textarea");
        helper.value = value;
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        helper.remove();
      }
      onCopied();
      if (copyFeedbackTimer.current) clearTimeout(copyFeedbackTimer.current);
      copyFeedbackTimer.current = setTimeout(() => {
        setCopiedItemOrder(null);
        setCopiedWarrantyItemOrder(null);
        setCopiedDeliveryDate(false);
      }, 1600);
    } catch {
      setError(errorMessage);
    }
  }

  async function copyDescription(itemOrder: number, value: string) {
    return copyValue(value, () => setCopiedItemOrder(itemOrder), "Não foi possível copiar a descrição.");
  }

  async function copyWarranty(itemOrder: number, value: string) {
    return copyValue(value, () => setCopiedWarrantyItemOrder(itemOrder), "Não foi possível copiar a garantia.");
  }

  async function copyDeliveryDate(value: string) {
    return copyValue(value, () => setCopiedDeliveryDate(true), "Não foi possível copiar o prazo de entrega.");
  }

  /**
   * Modo piloto: manda a proposta pronta para a extensão preencher no portal.
   *
   * Com a extensão instalada não sobra passo manual — ela acha/abre a aba do
   * portal, navega até o orçamento e preenche item a item, parando antes da data
   * de entrega, do Declaro e do Enviar Cotação.
   *
   * Sem extensão, cai no plano B de sempre: copia `/lance-portal <id>` para o
   * Claude in Chrome fazer o mesmo trabalho.
   */
  async function handlePilotMode() {
    if (pilotLoading) return;
    setPilotLoading(true);
    setPilotError(null);
    setPilotBlockers(null);
    setPilotMode(null);

    if (!preQuoteId) {
      setPilotError("Salve o pré-orçamento antes de acionar o modo piloto.");
      setPilotLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/prequotes/${preQuoteId}/proposta`);

      if (response.status === 409) {
        const data = await response.json();
        const blockers = Array.isArray(data.blockers)
          ? data.blockers
          : [data.error ?? "Pré-orçamento não está pronto para proposta."];
        setPilotBlockers(blockers);
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setPilotError(data?.error ?? "Erro ao consultar proposta.");
        return;
      }

      const data = await response.json();

      const extensionVersion = await pingPilotExtension();
      setPilotExtension(Boolean(extensionVersion));

      if (extensionVersion) {
        const dispatch = await sendPilotJob({ proposta: data.proposta, portal: data.portal });
        if (dispatch.ok) {
          setPilotMode("extension");
        } else {
          setPilotError(dispatch.error ?? "A extensão não conseguiu iniciar o piloto.");
        }
        return;
      }

      if (await copyToClipboard(`/lance-portal ${preQuoteId}`)) {
        setPilotMode("clipboard");
      } else {
        setPilotError("Não foi possível copiar o comando para a área de transferência.");
      }

      const portalUrl = data?.portal?.proposalUrl;
      if (typeof portalUrl === "string" && portalUrl.trim() && typeof window !== "undefined") {
        window.open(portalUrl, "_blank", "noopener");
      }
    } catch {
      setPilotError("Erro de conexão ao verificar proposta.");
    } finally {
      setPilotLoading(false);
    }
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
        notes: row.notes,
        warranty: row.warranty,
        chosenBrand: row.chosenBrand ?? null,
        brandOptions: row.brandOptions ?? []
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
    const header = [
      "Item",
      "Descrição",
      "Unidade",
      "Quantidade",
      "Ref. unitário",
      "Custo unitário",
      "Valor final unitário",
      "Total com margem",
      "Observações",
      "Origem",
      "Fornecedor/Anúncio",
      "Link"
    ];
    const lines = rows.map((row) => {
      const supplierName =
        row.catalogItemId !== null ? catalogById.get(row.catalogItemId)?.supplierName ?? "" : "";
      const lineTotals = calcPreQuoteLineTotals(row, marginPercent);
      return [
        row.name,
        row.description,
        row.unit,
        String(row.quantity),
        row.referenceUnitValue ?? "",
        row.unitCost ?? "",
        lineTotals.unitFinalCost ?? "",
        lineTotals.lineTotal ?? "",
        row.notes ?? "",
        sourceLabel(row.source),
        row.source === "web" ? row.webTitle ?? "" : supplierName,
        row.webUrl ?? ""
      ].map((cell) => String(cell)).map(escapeCsv).join(";");
    });
    const incompleteStatus = `INCOMPLETO — ${totals.missingCount} de ${rows.length} itens sem preço`;
    const summary = [
      ["", "", "", "", "", "", "", "", "", "", "", ""],
      ...(hasMissingPrices
        ? [["Status do pré-orçamento", "", "", "", "", "", incompleteStatus, "", "", "", "", ""]]
        : []),
      [hasMissingPrices ? "Custo dos itens precificados (parcial)" : "Custo dos itens", "", "", "", "", "", formatBRL(totals.costSubtotal), "", "", "", "", ""],
      ...(hasMissingPrices
        ? [["Itens sem preço", "", "", "", "", "", `${totals.missingCount} de ${rows.length}`, "", "", "", "", ""]]
        : []),
      ["Frete", "", "", "", "", "", formatBRL(totals.freightCost), "", "", "", "", ""],
      [`Margem (${totals.marginPercent}%)`, "", "", "", "", "", formatBRL(totals.marginValue), "", "", "", "", ""],
      ["Valor sugerido da proposta", "", "", "", "", "", hasMissingPrices ? "— (incompleto)" : formatBRL(totals.suggestedValue), "", "", "", "", ""],
      ["Referência da escola", "", "", "", "", "", quotation.totalReferenceValue !== null ? formatBRL(quotation.totalReferenceValue) : "—", "", "", "", "", ""]
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
        <section className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-bg-subtle)] p-4 shadow-[var(--shadow-card)]">
          <p className="eyebrow text-xs">Cadastro no portal</p>
          <h2 className="mt-1 text-base font-bold text-[var(--color-fg)]">Datas da solicitação de orçamento</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-fg-muted)]">Prazo de Envio de Propostas</p>
              <p className="select-all mt-1 font-bold tabular-nums text-[var(--color-fg)]">{formatPortalDate(quotation.proposalDeadline)}</p>
            </div>
            <div className="rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-bg)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-fg-muted)]">Prazo de Execução/Entrega</p>
                  <p className="select-all mt-1 font-bold tabular-nums text-[var(--color-primary)]">
                    {quotation.deliveryDate ? formatPortalDate(quotation.deliveryDate) : "Portal não informou a data de entrega"}
                  </p>
                </div>
                {quotation.deliveryDate && (
                  <button
                    aria-label="Copiar prazo de execução/entrega"
                    className="action-secondary shrink-0 !min-h-9 !px-3 text-xs font-semibold"
                    onClick={() => copyDeliveryDate(formatPortalDate(quotation.deliveryDate))}
                    type="button"
                  >
                    {copiedDeliveryDate ? "Copiado!" : "Copiar"}
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-[var(--color-fg-muted)]">No portal, informe a data de entrega no campo correspondente a bens ou serviços.</p>
        </section>
        <section className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-bg-subtle)] p-4 shadow-[var(--shadow-card)] lg:sticky lg:top-24 lg:z-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow text-xs">Preço de venda</p>
              <h2 className="mt-1 text-base font-bold text-[var(--color-fg)]">Margem global da cotação</h2>
              <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
                Aplicada ao valor final unitário e ao total de todos os itens com custo.
              </p>
            </div>
            <label className="w-36">
              <span className="field-label">Margem (%)</span>
              <input
                aria-label="Margem global (%)"
                className="field mt-1 tabular-nums"
                inputMode="decimal"
                min="0"
                onChange={(event) => setMarginText(event.target.value)}
                step="0.5"
                type="text"
                value={marginText}
              />
            </label>
          </div>
        </section>
        {isServiceCategory && (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-5 text-sm leading-relaxed text-[var(--color-fg-muted)]">
            Itens de serviço/locação não têm busca automática de preço. O valor vem do contato direto com fornecedores.
          </div>
        )}
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-fg-muted)]">
            Esta cotação não possui itens publicados no portal. Sem itens não há o que pré-orçar.
          </div>
        ) : (
          rows.map((row) => {
            const lineRef = row.referenceUnitValue !== null ? row.referenceUnitValue * row.quantity : null;
            // A escola escolhe a unidade num dropdown e descreve outra no texto.
            // Erro de unidade em licitação é prejuízo: avisa, não corrige sozinho.
            const unitWarning = describeUnitHint(
              extractUnitHint(row.description, row.unit),
              row.unit,
              row.quantity
            );
            const lineTotals = calcPreQuoteLineTotals(row, marginPercent);
            const rowSuggestions = suggestions[row.itemOrder] ?? [];
            const rowReferenceSuggestions = isServiceCategory
              ? []
              : getUniqueReferenceMatches(referenceSuggestions[row.itemOrder] ?? []);
            const searchQuery = buildBestPriceSearchQuery(row.name, row.description);
            const autoPriceResult = batchResults[searchQuery];
            const autoRealOffer = !isServiceCategory
              ? autoPriceResult?.offers?.find((offer) => isRelevantReferenceTitle(searchQuery, offer.title))
              : null;
            const hasAnySuggestions =
              rowSuggestions.length > 0 ||
              (!isServiceCategory && (batchLoading || Boolean(autoRealOffer))) ||
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
                  <div className="flex shrink-0 items-center gap-1.5">
                    {row.brandOptions && row.brandOptions.length > 0 && !row.chosenBrand && (
                      <span className="rounded-full badge-warning px-2.5 py-0.5 text-[10px] font-bold">
                        Sem marca
                      </span>
                    )}
                    {row.source !== "none" && (
                      <span className="rounded-full border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/15 px-2.5 py-0.5 text-[10px] font-bold text-[var(--color-primary)]">
                        {sourceLabel(row.source)}
                      </span>
                    )}
                  </div>
                </div>
                {row.description && (
                  <p className="mt-2 text-xs leading-relaxed text-[var(--color-fg-muted)]">{row.description}</p>
                )}
                <p className="mt-2 text-xs font-semibold tabular-nums text-[var(--color-fg-muted)]">
                  {formatQuantity(row.quantity)} {row.unit} · ref. escola:{" "}
                  {row.referenceUnitValue !== null ? formatBRL(row.referenceUnitValue) : "sem referência"}
                  {lineRef !== null && <span className="font-normal"> (linha: {formatBRL(lineRef)})</span>}
                </p>
                {unitWarning && (
                  <p className="badge-warning mt-2 rounded-lg p-2.5 text-xs font-semibold leading-relaxed" role="status">
                    ⚠️ {unitWarning}
                  </p>
                )}

                <div
                  className={`mt-4 grid gap-3 ${
                    isServiceCategory
                      ? "sm:grid-cols-[minmax(0,1fr)_12rem]"
                      : "sm:grid-cols-[minmax(0,1fr)_9.5rem_9.5rem]"
                  }`}
                >
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
                  {!isServiceCategory && (
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
                  )}
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
                    {!isServiceCategory && batchLoading && (
                      <div className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                        <span>Buscando preço na Real Distribuidora…</span>
                      </div>
                    )}

                    {!isServiceCategory && !batchLoading && autoRealOffer && (
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
                                <div className="flex shrink-0 items-center gap-2">
                                  <button
                                    className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline"
                                    onClick={() => applyReferenceSuggestion(row.itemOrder, match.item.name)}
                                    type="button"
                                  >
                                    Usar descrição
                                  </button>
                                  {match.item.url && (
                                    <a
                                      className="text-[11px] text-[var(--color-primary)] hover:underline"
                                      href={match.item.url}
                                      rel="noreferrer"
                                      target="_blank"
                                    >
                                      ver no Cescom ↗
                                    </a>
                                  )}
                                </div>
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

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-bg-subtle)] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-fg-muted)]">
                      Valor final unitário
                    </p>
                    <p className="select-all mt-1 text-lg font-extrabold tabular-nums text-[var(--color-primary)]">
                      {lineTotals.unitFinalCost === null ? "" : formatBRL(lineTotals.unitFinalCost)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-bg-subtle)] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-fg-muted)]">
                      Total da linha com margem
                    </p>
                    <p className="mt-1 text-lg font-extrabold tabular-nums text-[var(--color-success)]">
                      {lineTotals.lineTotal === null ? "" : formatBRL(lineTotals.lineTotal)}
                    </p>
                  </div>
                </div>

                {row.brandOptions && row.brandOptions.length > 0 && (
                  <div
                    className={`mt-4 rounded-lg p-3 ${
                      !row.chosenBrand
                        ? "badge-warning"
                        : "border border-[var(--color-border)] bg-[var(--color-bg-subtle)]"
                    }`}
                  >
                    <label>
                      <span className="field-label flex items-center justify-between">
                        <span className="font-bold">Marca ofertada</span>
                        {!row.chosenBrand ? (
                          <span className="text-[11px] font-bold text-[var(--color-warning)]">
                            ⚠️ Escolha obrigatória
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-[var(--color-success)]">
                            ✓ {row.chosenBrand}
                          </span>
                        )}
                      </span>
                      <select
                        aria-label={`Marca ofertada do item ${row.itemOrder}`}
                        className="field mt-1.5"
                        onChange={(event) =>
                          updateRow(row.itemOrder, {
                            chosenBrand: event.target.value ? event.target.value : null
                          })
                        }
                        value={row.chosenBrand ?? ""}
                      >
                        <option value="">— escolher marca —</option>
                        {Array.from(
                          new Set(
                            row.brandOptions.map((brand) => brand.trim()).filter(Boolean)
                          )
                        ).map((brand) => (
                          <option key={brand} value={brand}>
                            {brand}
                          </option>
                        ))}
                      </select>
                    </label>
                    {!row.chosenBrand && (
                      <p className="mt-2 text-xs font-semibold leading-relaxed">
                        Item sem marca: o portal exige que uma das marcas listadas seja informada no campo Garantia para aceitar a proposta.
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-4">
                  <span className="field-label">Observações</span>
                  <div className="mt-1 flex items-start gap-2">
                    <textarea
                      className="field min-w-0 flex-1"
                      onChange={(event) => updateRow(row.itemOrder, { notes: event.target.value })}
                      placeholder="Descreva o item sem citar marca."
                      rows={2}
                      value={row.notes ?? ""}
                    />
                    <button
                      aria-label={`Copiar observações do item ${row.itemOrder}`}
                      className="action-secondary shrink-0 !min-h-10 !px-3 text-xs font-semibold"
                      disabled={!row.notes?.trim()}
                      onClick={() => copyDescription(row.itemOrder, row.notes ?? "")}
                      title="Copiar descrição"
                      type="button"
                    >
                      {copiedItemOrder === row.itemOrder ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                  <span className="mt-1 block text-[11px] text-[var(--color-fg-muted)]">
                    Não cite marca; descreva características, quantidade e unidade.
                  </span>
                </div>

                <div className="mt-4">
                  <span className="field-label">Descrição da Garantia</span>
                  <div className="mt-1 flex items-start gap-2">
                    <textarea
                      aria-label={`Descrição da Garantia do item ${row.itemOrder}`}
                      className="field min-w-0 flex-1"
                      onChange={(event) => updateRow(row.itemOrder, { warranty: event.target.value })}
                      placeholder="Informe as condições de garantia ofertadas."
                      rows={2}
                      value={row.warranty ?? ""}
                    />
                    <button
                      aria-label={`Copiar garantia do item ${row.itemOrder}`}
                      className="action-secondary shrink-0 !min-h-10 !px-3 text-xs font-semibold"
                      disabled={!row.warranty?.trim()}
                      onClick={() => copyWarranty(row.itemOrder, row.warranty ?? "")}
                      title="Copiar garantia"
                      type="button"
                    >
                      {copiedWarrantyItemOrder === row.itemOrder ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                  <span className="mt-1 block text-[11px] text-[var(--color-fg-muted)]">
                    Revise o texto antes de cadastrar a proposta no portal.
                  </span>
                </div>

                {!isServiceCategory && isSearchOpen && (
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
          {(hasMissingPrices || hasMissingBrands) && (
            <div className="badge-warning mt-4 rounded-lg p-3 text-sm" role="status">
              <p className="font-bold">Pré-orçamento incompleto</p>
              <div className="mt-1 space-y-1 text-xs font-semibold">
                {hasMissingPrices && (
                  <p>
                    {totals.missingCount} de {rows.length} itens sem preço. Preencha todos os preços para liberar o valor sugerido e a comparação com a referência.
                  </p>
                )}
                {hasMissingBrands && (
                  <p>
                    {missingBrandCount} de {rowsWithBrandOptions.length} {rowsWithBrandOptions.length === 1 ? "item sem marca ofertada" : "itens sem marca ofertada"}. Escolha a marca para liberar o envio da proposta.
                  </p>
                )}
              </div>
            </div>
          )}
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[var(--color-fg-muted)]">{hasMissingPrices ? "Custo dos itens precificados (parcial)" : "Custo dos itens"}</dt>
              <dd className="font-bold tabular-nums text-[var(--color-fg)]">{formatBRL(totals.costSubtotal)}</dd>
            </div>
            <div className={`flex items-baseline justify-between gap-3 ${hasMissingPrices ? "badge-warning rounded-lg px-3 py-2" : ""}`}>
              <dt className="text-[var(--color-fg-muted)]">Itens sem preço</dt>
              <dd className={`font-bold tabular-nums ${totals.missingCount > 0 ? "text-[var(--color-warning)]" : "text-[var(--color-success)]"}`}>
                {totals.missingCount} de {rows.length}
              </dd>
            </div>
            {rowsWithBrandOptions.length > 0 && (
              <div className={`flex items-baseline justify-between gap-3 ${hasMissingBrands ? "badge-warning rounded-lg px-3 py-2" : ""}`}>
                <dt className="text-[var(--color-fg-muted)]">Itens sem marca</dt>
                <dd className={`font-bold tabular-nums ${hasMissingBrands ? "text-[var(--color-warning)]" : "text-[var(--color-success)]"}`}>
                  {missingBrandCount} de {rowsWithBrandOptions.length}
                </dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[var(--color-fg-muted)]">Referência da escola</dt>
              <dd className="font-bold tabular-nums text-[var(--color-fg)]">
                {quotation.totalReferenceValue !== null ? formatBRL(quotation.totalReferenceValue) : "—"}
              </dd>
            </div>
            {/* flex-wrap e obrigatorio: o aviso abaixo usa basis-full e, sem quebra de
                linha, os tres filhos se espremem na mesma linha em vez de o texto descer. */}
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <dt className="text-[var(--color-fg-muted)]">Valor sugerido</dt>
              <dd className={`text-xl font-extrabold tabular-nums ${hasMissingPrices ? "text-[var(--color-fg-muted)]" : "text-[var(--color-primary)]"}`}>
                {hasMissingPrices ? "—" : formatBRL(totals.suggestedValue)}
              </dd>
              {hasMissingPrices && (
                <p className="basis-full text-right text-xs font-semibold text-[var(--color-warning)]">
                  Aguardando todos os preços
                </p>
              )}
            </div>
            {!isReferenceInconsistent && referenceDiff !== null && (
              <div className="flex items-baseline justify-between gap-3 border-t border-[var(--color-border)] pt-3">
                <dt className="text-[var(--color-fg-muted)]">Vs. referência</dt>
                <dd className={`font-bold tabular-nums ${referenceDiff <= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                  {formatBRL(referenceDiff)}{" "}
                  <span className="text-xs">({formatPercent(referenceDiff / (quotation.totalReferenceValue || 1) * 100)})</span>
                </dd>
              </div>
            )}
          </dl>

          {isReferenceInconsistent && (
            <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3 text-xs">
              <p className="font-bold text-[var(--color-fg)]">
                Referência do portal inconsistente
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-fg-muted)]">
                O valor de referência total informado pelo portal diverge da soma das referências dos itens em mais de 5%.
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-2 text-xs">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-[var(--color-fg-muted)]">
                    Total publicado
                  </span>
                  <span className="mt-0.5 block font-bold tabular-nums text-[var(--color-fg)]">
                    {quotation.totalReferenceValue !== null ? formatBRL(quotation.totalReferenceValue) : "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-[var(--color-fg-muted)]">
                    Soma dos itens
                  </span>
                  <span className="mt-0.5 block font-bold tabular-nums text-[var(--color-fg)]">
                    {sumLineReferenceValue !== null ? formatBRL(sumLineReferenceValue) : "—"}
                  </span>
                </div>
              </div>
            </div>
          )}

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
            <button
              className="action-secondary w-full"
              disabled={pilotLoading || busy}
              onClick={handlePilotMode}
              type="button"
            >
              {pilotLoading
                ? "Verificando proposta…"
                : pilotExtension
                  ? "Modo piloto — preencher no portal"
                  : "Modo piloto (Claude in Chrome)"}
            </button>
            {pilotMode === "extension" && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3 text-xs space-y-2" role="status">
                <p className="font-bold text-[var(--color-fg)]">Piloto rodando na aba do portal.</p>
                <p className="text-[var(--color-fg-muted)] leading-relaxed">
                  Acompanhe o painel no canto da tela do portal: ele navega até o orçamento, preenche valor,
                  observações e garantia e confere total por total.
                </p>
                <p className="badge-warning rounded-lg p-2.5 font-semibold">
                  Você põe a data de entrega, marca o Declaro e clica Enviar Cotação.
                </p>
              </div>
            )}
            {pilotMode === "clipboard" && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3 text-xs space-y-2" role="status">
                <p className="text-[var(--color-fg-muted)] leading-relaxed">
                  Extensão do Modo piloto não encontrada — usando o Claude in Chrome. Para preencher sem copiar e
                  colar, instale a extensão em <code>extension/</code>.
                </p>
                <ol className="space-y-1.5 leading-relaxed">
                  <li className="flex items-start gap-1.5 text-[var(--color-fg)]">
                    <span className="font-bold text-[var(--color-fg-muted)] shrink-0">1.</span>
                    <span>Comando copiado. Cole no Claude (Cmd+V) e envie.</span>
                  </li>
                  <li className="flex items-start gap-1.5 text-[var(--color-fg)]">
                    <span className="font-bold text-[var(--color-fg-muted)] shrink-0">2.</span>
                    <span>O Claude preenche os itens e confere os totais.</span>
                  </li>
                  <li className="badge-warning rounded-lg p-2.5 font-semibold">
                    <div className="flex items-start gap-1.5">
                      <span className="shrink-0">3.</span>
                      <span>Você põe a data de entrega, marca o Declaro e envia.</span>
                    </div>
                  </li>
                </ol>
              </div>
            )}
            {pilotBlockers && pilotBlockers.length > 0 && (
              <div className="badge-warning rounded-lg p-3 text-xs" role="status">
                <p className="font-bold">Pendências para envio da proposta:</p>
                <ul className="mt-1.5 list-disc pl-4 space-y-1 font-semibold">
                  {pilotBlockers.map((blocker, index) => (
                    <li key={index}>{blocker}</li>
                  ))}
                </ul>
              </div>
            )}
            {pilotError && (
              <div className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-bg-subtle)] p-3 text-xs font-semibold text-[var(--color-danger)]" role="alert">
                {pilotError}
              </div>
            )}
            <Link className="action-secondary inline-flex min-h-11 items-center justify-center" href="/preorcamento">
              ← Voltar para pré-orçamentos
            </Link>
          </div>
        </section>
      </aside>
    </div>
  );
}

/** Clipboard API com fallback para navegador que nega permissão. */
async function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // segue para o fallback
  }

  try {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.left = "-9999px";
    helper.style.top = "0";
    document.body.appendChild(helper);
    helper.select();
    const copied = document.execCommand("copy");
    helper.remove();
    return copied;
  } catch {
    return false;
  }
}

function parseNonNegative(value: string) {
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function formatQuantity(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function formatPortalDate(value: string | null | undefined) {
  if (!value) return "Não informado";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
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
