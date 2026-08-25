"use client";

import React, { useState } from "react";
import type { CatalogItem, CatalogSupplier } from "@/lib/catalog/source";

type ItemForm = {
  name: string;
  unit: string;
  unitPrice: string;
  notes: string;
};

const EMPTY_FORM: ItemForm = { name: "", unit: "UN", unitPrice: "", notes: "" };

export function SupplierItemsEditor({
  supplier,
  initialItems
}: {
  supplier: CatalogSupplier;
  initialItems: CatalogItem[];
}) {
  const [items, setItems] = useState<CatalogItem[]>(initialItems);
  const [form, setForm] = useState<ItemForm | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: form.name,
        unit: form.unit,
        unitPrice: Number(form.unitPrice.replace(",", ".")),
        notes: form.notes
      };
      const response = await fetch(
        editingId === null
          ? `/api/catalog/suppliers/${supplier.id}/items`
          : `/api/catalog/items/${editingId}`,
        {
          method: editingId === null ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Falha ao salvar item.");
      if (editingId === null) {
        setItems(payload.items);
      } else {
        setItems((current) =>
          current.map((item) =>
            item.id === editingId ? { ...item, ...body, unitPrice: Number(body.unitPrice) } : item
          )
        );
      }
      setForm(null);
      setEditingId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao salvar item.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: CatalogItem) {
    if (!window.confirm(`Excluir "${item.name}" do catálogo deste fornecedor?`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/catalog/items/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Falha ao excluir item.");
      }
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao excluir item.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-bg-subtle)] p-3 text-sm font-semibold text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-fg-muted)]">
          {items.length.toLocaleString("pt-BR")} {items.length === 1 ? "item precificado" : "itens precificados"}
        </p>
        {form === null && (
          <button className="action-primary" onClick={() => setForm(EMPTY_FORM)} type="button">
            + Novo item
          </button>
        )}
      </div>

      {form !== null && (
        <form
          className="grid gap-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-bg)] p-5 shadow-[var(--shadow-card)] sm:grid-cols-[minmax(0,2fr)_8rem_10rem]"
          onSubmit={submit}
        >
          <h3 className="text-base font-bold text-[var(--color-fg)] sm:col-span-3">
            {editingId === null ? "Novo item do fornecedor" : "Editar item"}
          </h3>
          <label>
            <span className="field-label">Nome do item *</span>
            <input
              autoFocus
              className="field mt-1"
              onChange={(event) => onChangeName(event.target.value)}
              placeholder="Ex: Papel A4 500 folhas"
              required
              value={form.name}
            />
          </label>
          <label>
            <span className="field-label">Unidade *</span>
            <input
              className="field mt-1"
              onChange={(event) => onChangeUnit(event.target.value)}
              placeholder="UN, CX, KG, L…"
              required
              value={form.unit}
            />
          </label>
          <label>
            <span className="field-label">Preço unitário (R$) *</span>
            <input
              className="field mt-1"
              min="0"
              onChange={(event) => onChangePrice(event.target.value)}
              placeholder="0,00"
              required
              step="0.01"
              type="number"
              value={form.unitPrice}
            />
          </label>
          <label className="sm:col-span-3">
            <span className="field-label">Observações</span>
            <input
              className="field mt-1"
              onChange={(event) => onChangeNotes(event.target.value)}
              placeholder="Marca, validade da cotação, condição comercial…"
              value={form.notes}
            />
          </label>
          <div className="flex items-center gap-2 sm:col-span-3">
            <button className="action-primary" disabled={busy} type="submit">
              {busy ? "Salvando…" : "Salvar"}
            </button>
            <button
              className="action-secondary"
              disabled={busy}
              onClick={() => {
                setForm(null);
                setEditingId(null);
              }}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg-muted)]">
            <tr>
              <th className="p-3">Item</th>
              <th className="p-3">Unidade</th>
              <th className="p-3 text-right">Preço unitário</th>
              <th className="p-3">Atualizado</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {items.map((item) => (
              <tr className="hover:bg-[var(--color-bg-subtle)]/50" key={item.id}>
                <td className="p-3">
                  <p className="font-semibold text-[var(--color-fg)]">{item.name}</p>
                  {item.notes && (
                    <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">{item.notes}</p>
                  )}
                </td>
                <td className="p-3 tabular-nums text-[var(--color-fg-muted)]">{item.unit}</td>
                <td className="p-3 text-right font-bold tabular-nums text-[var(--color-success)]">
                  {formatBRL(item.unitPrice)}
                </td>
                <td className="p-3 text-xs text-[var(--color-fg-muted)]">
                  {formatDate(item.lastPriceAt)}
                </td>
                <td className="p-3 text-right">
                  <div className="inline-flex items-center gap-3">
                    <button
                      className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
                      disabled={busy}
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({
                          name: item.name,
                          unit: item.unit,
                          unitPrice: String(item.unitPrice),
                          notes: item.notes ?? ""
                        });
                      }}
                      type="button"
                    >
                      Editar
                    </button>
                    <button
                      className="text-xs font-semibold text-[var(--color-danger)] hover:underline"
                      disabled={busy}
                      onClick={() => remove(item)}
                      type="button"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="p-6 text-center text-sm text-[var(--color-fg-muted)]" colSpan={5}>
                  Nenhum item cadastrado para este fornecedor ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  function onChangeName(value: string) {
    setForm((current) => (current ? { ...current, name: value } : current));
  }
  function onChangeUnit(value: string) {
    setForm((current) => (current ? { ...current, unit: value } : current));
  }
  function onChangePrice(value: string) {
    setForm((current) => (current ? { ...current, unitPrice: value } : current));
  }
  function onChangeNotes(value: string) {
    setForm((current) => (current ? { ...current, notes: value } : current));
  }
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";
}
