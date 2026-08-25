"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type CategoryOption = { id: number; slug: string; name: string };

export type SubscriptionRow = {
  id: number;
  categoryId: number | null;
  city: string | null;
  school: string | null;
  keyword: string | null;
  active: boolean;
  categoryName: string | null;
  categorySlug: string | null;
};

type AlertsPanelProps = {
  initial: SubscriptionRow[];
  categories: CategoryOption[];
};

export function AlertsPanel({ initial, categories }: AlertsPanelProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createAlert(formData: FormData) {
    setBusy(true);
    setError(null);
    const payload = {
      categoryId: formData.get("categoryId") || null,
      city: formData.get("city") || null,
      school: formData.get("school") || null,
      keyword: formData.get("keyword") || null
    };
    try {
      const response = await fetch("/api/notifications/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Não foi possível salvar o alerta.");
        return;
      }
      (document.getElementById("alert-form") as HTMLFormElement | null)?.reset();
      router.refresh();
    } catch {
      setError("Falha de rede ao salvar o alerta.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(subscription: SubscriptionRow) {
    await fetch(`/api/notifications/subscriptions/${subscription.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !subscription.active })
    });
    router.refresh();
  }

  async function remove(subscription: SubscriptionRow) {
    await fetch(`/api/notifications/subscriptions/${subscription.id}`, { method: "DELETE" });
    router.refresh();
  }

  function criteriaLabel(subscription: SubscriptionRow) {
    const parts: string[] = [];
    if (subscription.categoryName) parts.push(subscription.categoryName);
    if (subscription.city) parts.push(`cidade: ${subscription.city}`);
    if (subscription.school) parts.push(`escola: ${subscription.school}`);
    if (subscription.keyword) parts.push(`busca: “${subscription.keyword}”`);
    return parts.join(" · ") || "sem critérios";
  }

  return (
    <div>
      <form action={createAlert} className="glass-toolbar grid gap-4 p-5 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end" id="alert-form">
        <label>
          <span className="field-label">Categoria</span>
          <select className="field mt-1" defaultValue="" name="categoryId">
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Cidade</span>
          <input className="field mt-1" name="city" placeholder="Ex.: Contagem" />
        </label>
        <label>
          <span className="field-label">Escola</span>
          <input className="field mt-1" name="school" placeholder="Ex.: E.E. Santos Dumont" />
        </label>
        <label>
          <span className="field-label">Palavra-chave</span>
          <input className="field mt-1" name="keyword" placeholder="Ex.: notebook" />
        </label>
        <button className="action-primary" disabled={busy} type="submit">
          {busy ? "Salvando…" : "+ Criar alerta"}
        </button>
        <p className="text-xs text-[var(--color-fg-muted)] sm:col-span-5">
          Quando uma licitação nova bater com algum critério, você recebe email e aviso no sino do app.
        </p>
      </form>

      {error && (
        <p className="mt-3 rounded-lg border border-[var(--color-danger)] bg-[var(--color-bg-subtle)] p-3 text-sm font-semibold text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <h2 className="mb-4 mt-8 text-xl font-bold text-[var(--color-fg)]">Meus alertas</h2>
      {initial.length === 0 ? (
        <div className="glass-panel p-8 text-center">
          <span className="block text-3xl">🔔</span>
          <p className="mt-3 font-bold text-[var(--color-fg)]">Nenhum alerta criado ainda.</p>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">Use o formulário acima para criar o primeiro.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {initial.map((subscription) => (
            <article
              className="glass-panel flex flex-wrap items-center justify-between gap-3 p-4"
              key={subscription.id}
            >
              <div className="min-w-0">
                <p className="font-semibold text-[var(--color-fg)]">{criteriaLabel(subscription)}</p>
                <p className="mt-1 text-xs font-bold">
                  <span className={subscription.active ? "text-[var(--color-success)]" : "text-[var(--color-fg-muted)]"}>
                    {subscription.active ? "● Ativo" : "○ Pausado"}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  className="action-secondary min-h-[36px] text-xs"
                  onClick={() => toggle(subscription)}
                  type="button"
                >
                  {subscription.active ? "Pausar" : "Ativar"}
                </button>
                <button
                  className="action-secondary min-h-[36px] text-xs !text-[var(--color-danger)]"
                  onClick={() => remove(subscription)}
                  type="button"
                >
                  Excluir
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
