"use client";

import Link from "next/link";
import React, { useState } from "react";
import type { CatalogSupplier } from "@/lib/catalog/source";

type SupplierForm = {
  name: string;
  document: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  notes: string;
};

const EMPTY_FORM: SupplierForm = {
  name: "",
  document: "",
  contactName: "",
  phone: "",
  email: "",
  city: "",
  notes: ""
};

export function CatalogSuppliersPanel({ initialSuppliers }: { initialSuppliers: CatalogSupplier[] }) {
  const [suppliers, setSuppliers] = useState<CatalogSupplier[]>(initialSuppliers);
  const [form, setForm] = useState<SupplierForm | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        editingId === null ? "/api/catalog/suppliers" : `/api/catalog/suppliers/${editingId}`,
        {
          method: editingId === null ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form)
        }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Falha ao salvar fornecedor.");
      if (editingId === null) {
        setSuppliers((current) => [...current, payload.supplier].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      } else {
        setSuppliers((current) =>
          current.map((supplier) => (supplier.id === editingId ? payload.supplier : supplier))
        );
      }
      setForm(null);
      setEditingId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao salvar fornecedor.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(supplier: CatalogSupplier) {
    if (!window.confirm(`Excluir fornecedor "${supplier.name}" e todos os itens dele?`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/catalog/suppliers/${supplier.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Falha ao excluir fornecedor.");
      }
      setSuppliers((current) => current.filter((item) => item.id !== supplier.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao excluir fornecedor.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(supplier: CatalogSupplier) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/catalog/suppliers/${supplier.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !supplier.active })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Falha ao atualizar fornecedor.");
      setSuppliers((current) =>
        current.map((item) => (item.id === supplier.id ? payload.supplier : item))
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao atualizar fornecedor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-sm font-semibold text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-fg-muted)]">
          {suppliers.length.toLocaleString("pt-BR")} fornecedor{suppliers.length === 1 ? "" : "es"} no catálogo
        </p>
        {form === null && (
          <button className="action-primary" onClick={() => setForm(EMPTY_FORM)} type="button">
            + Novo fornecedor
          </button>
        )}
      </div>

      {form !== null && (
        <SupplierForm
          busy={busy}
          editingId={editingId}
          form={form}
          onCancel={() => {
            setForm(null);
            setEditingId(null);
          }}
          onChange={setForm}
          onSubmit={submit}
        />
      )}

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {suppliers.map((supplier) => (
          <li
            className="flex flex-col justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 shadow-[var(--shadow-card)]"
            key={supplier.id}
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-bold leading-snug text-[var(--color-fg)]">{supplier.name}</h3>
                <button
                  aria-label={supplier.active ? "Desativar fornecedor" : "Ativar fornecedor"}
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                    supplier.active
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                      : "border-zinc-600 bg-zinc-800 text-zinc-400"
                  }`}
                  disabled={busy}
                  onClick={() => toggleActive(supplier)}
                  title={supplier.active ? "Ativo no catálogo" : "Inativo no catálogo"}
                  type="button"
                >
                  {supplier.active ? "ATIVO" : "INATIVO"}
                </button>
              </div>
              {supplier.document && (
                <p className="mt-1 text-xs font-semibold tabular-nums text-[var(--color-fg-muted)]">
                  {supplier.document}
                </p>
              )}
              <dl className="mt-3 space-y-1 text-sm">
                {(supplier.city || supplier.contactName) && (
                  <div className="text-[var(--color-fg-muted)]">
                    {[supplier.city, supplier.contactName].filter(Boolean).join(" · ")}
                  </div>
                )}
                {supplier.phone && <div className="tabular-nums text-[var(--color-fg-muted)]">📞 {supplier.phone}</div>}
                {supplier.email && <div className="break-all text-[var(--color-fg-muted)]">✉️ {supplier.email}</div>}
              </dl>
              {supplier.notes && (
                <p className="mt-2 border-l-2 border-[var(--color-border)] pl-2 text-xs leading-relaxed text-[var(--color-fg-muted)]">
                  {supplier.notes}
                </p>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
              <Link
                className="inline-flex min-h-9 items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 text-xs font-semibold text-[var(--color-fg)] hover:bg-[var(--color-border)] transition-colors"
                href={`/fornecedores/${supplier.id}`}
              >
                {supplier.itemCount.toLocaleString("pt-BR")} {supplier.itemCount === 1 ? "item" : "itens"} →
              </Link>
              <div className="flex items-center gap-2">
                <button
                  className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
                  disabled={busy}
                  onClick={() => {
                    setEditingId(supplier.id);
                    setForm({
                      name: supplier.name,
                      document: supplier.document ?? "",
                      contactName: supplier.contactName ?? "",
                      phone: supplier.phone ?? "",
                      email: supplier.email ?? "",
                      city: supplier.city ?? "",
                      notes: supplier.notes ?? ""
                    });
                  }}
                  type="button"
                >
                  Editar
                </button>
                <button
                  className="text-xs font-semibold text-red-400 hover:underline"
                  disabled={busy}
                  onClick={() => remove(supplier)}
                  type="button"
                >
                  Excluir
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {suppliers.length === 0 && form === null && (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center">
          <p className="text-sm text-[var(--color-fg-muted)]">
            Nenhum fornecedor cadastrado ainda. Adicione o primeiro para começar a precificar cotações.
          </p>
        </div>
      )}
    </div>
  );
}

function SupplierForm({
  form,
  editingId,
  busy,
  onSubmit,
  onChange,
  onCancel
}: {
  form: SupplierForm;
  editingId: number | null;
  busy: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onChange: (form: SupplierForm) => void;
  onCancel: () => void;
}) {
  return (
    <form className="grid gap-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-bg)] p-5 shadow-[var(--shadow-card)] sm:grid-cols-2" onSubmit={onSubmit}>
      <h3 className="text-base font-bold text-[var(--color-fg)] sm:col-span-2">
        {editingId === null ? "Novo fornecedor" : "Editar fornecedor"}
      </h3>
      <label className="sm:col-span-2">
        <span className="field-label">Nome do fornecedor *</span>
        <input
          autoFocus
          className="field mt-1"
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          placeholder="Ex: Distribuidora Alimentos MG Ltda"
          required
          value={form.name}
        />
      </label>
      <label>
        <span className="field-label">CNPJ / CPF</span>
        <input className="field mt-1" onChange={(event) => onChange({ ...form, document: event.target.value })} value={form.document} />
      </label>
      <label>
        <span className="field-label">Contato</span>
        <input className="field mt-1" onChange={(event) => onChange({ ...form, contactName: event.target.value })} placeholder="Nome da pessoa de contato" value={form.contactName} />
      </label>
      <label>
        <span className="field-label">Telefone</span>
        <input className="field mt-1" onChange={(event) => onChange({ ...form, phone: event.target.value })} placeholder="(31) 9 9999-9999" value={form.phone} />
      </label>
      <label>
        <span className="field-label">E-mail</span>
        <input className="field mt-1" onChange={(event) => onChange({ ...form, email: event.target.value })} placeholder="contato@empresa.com.br" type="email" value={form.email} />
      </label>
      <label>
        <span className="field-label">Cidade</span>
        <input className="field mt-1" onChange={(event) => onChange({ ...form, city: event.target.value })} value={form.city} />
      </label>
      <label className="sm:col-span-2">
        <span className="field-label">Observações</span>
        <textarea
          className="field mt-1"
          onChange={(event) => onChange({ ...form, notes: event.target.value })}
          placeholder="Prazo de entrega, condições de pagamento, etc."
          rows={2}
          value={form.notes}
        />
      </label>
      <div className="flex items-center gap-2 sm:col-span-2">
        <button className="action-primary" disabled={busy} type="submit">
          {busy ? "Salvando…" : "Salvar"}
        </button>
        <button className="action-secondary" disabled={busy} onClick={onCancel} type="button">
          Cancelar
        </button>
      </div>
    </form>
  );
}
