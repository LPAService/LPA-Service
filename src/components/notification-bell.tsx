"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export function NotificationBell() {
  const [count, setCount] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/unread-count", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { count?: number };
      setCount(data.count ?? 0);
    } catch {
      // rede fora: mantém o último valor
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  return (
    <Link
      aria-label={`Notificações${count ? ` (${count} não lidas)` : ""}`}
      className="bell"
      href="/notificacoes"
      title="Notificações"
    >
      🔔
      {count ? <span className="bell-badge">{count > 99 ? "99+" : count}</span> : null}
    </Link>
  );
}
