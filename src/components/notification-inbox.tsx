"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type InboxRow = {
  id: number;
  read: boolean;
  emailedAt: string | null;
  createdAt: string;
  externalId: string;
  orderId: string | null;
  schoolName: string;
  countyName: string | null;
  headline: string;
  proposalDeadline: string | null;
  categoryName: string | null;
};

type NotificationInboxProps = {
  initial: InboxRow[];
  unread: number;
};

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

export function NotificationInbox({ initial, unread }: NotificationInboxProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markRead(id?: number) {
    setBusy(true);
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id === undefined ? {} : { id })
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[var(--color-fg)]">
          {unread} não lida{unread === 1 ? "" : "s"}
        </h2>
        {unread > 0 && (
          <button className="action-secondary min-h-[38px]" disabled={busy} onClick={() => markRead()}>
            Marcar todas como lidas
          </button>
        )}
      </div>

      {initial.length === 0 ? (
        <div className="glass-panel p-8 text-center">
          <span className="block text-3xl">🫧</span>
          <p className="mt-3 font-bold text-[var(--color-fg)]">Nenhuma notificação ainda.</p>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Quando surgir uma licitação que bate com os seus alertas, ela aparece aqui e vai para o seu email.
          </p>
          <Link className="action-primary mt-5" href="/alertas">Criar alertas</Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {initial.map((row) => (
            <article
              className={`glass-panel flex min-w-0 flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between ${
                row.read ? "opacity-70" : "border-l-4 border-l-[var(--color-primary)]"
              }`}
              key={row.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {!row.read && <span className="badge-success px-2 py-0.5 text-[10px] font-bold">NOVA</span>}
                  {row.categoryName && (
                    <span className="badge-muted px-2 py-0.5 text-[10px] font-bold">{row.categoryName}</span>
                  )}
                  <span className="text-xs font-semibold text-[var(--color-fg-muted)]">
                    {dateFormat.format(new Date(row.createdAt))}
                  </span>
                </div>
                <h3 className="mt-2 font-extrabold tracking-tight text-[var(--color-fg)]">{row.schoolName}</h3>
                <p className="mt-1 text-sm leading-snug text-[var(--color-fg-muted)]">{row.headline}</p>
                <p className="mt-2 text-xs font-semibold text-[var(--color-fg-muted)]">
                  {row.countyName ? `📍 ${row.countyName}` : ""}
                  {row.orderId ? ` · Orçamento nº ${row.orderId}` : ""}
                  {row.proposalDeadline ? ` · prazo ${new Date(row.proposalDeadline).toLocaleDateString("pt-BR")}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link className="action-primary min-h-[38px] text-sm" href={`/opportunity/${row.externalId}`}>
                  Ver cotação →
                </Link>
                {!row.read && (
                  <button className="action-secondary min-h-[38px] text-sm" disabled={busy} onClick={() => markRead(row.id)}>
                    Marcar lida
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
