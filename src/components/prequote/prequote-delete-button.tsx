"use client";

import React, { useState } from "react";

export function PrequoteDeleteButton({ id, name }: { id: number; name: string }) {
  const [deleted, setDeleted] = useState(false);
  const [busy, setBusy] = useState(false);

  if (deleted) return null;

  async function remove() {
    if (!window.confirm(`Excluir o pré-orçamento "${name}"?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/prequotes/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json();
        window.alert(payload.error ?? "Falha ao excluir pré-orçamento.");
        setBusy(false);
        return;
      }
      setDeleted(true);
    } catch {
      window.alert("Falha ao excluir pré-orçamento.");
      setBusy(false);
    }
  }

  return (
    <button
      className="text-xs font-semibold text-[var(--color-danger)] hover:underline"
      disabled={busy}
      onClick={remove}
      type="button"
    >
      {busy ? "Excluindo…" : "Excluir"}
    </button>
  );
}
