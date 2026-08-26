"use client";

import { useEffect, useState, useTransition } from "react";

type WatchButtonProps = {
  externalId: string;
  initialWatched?: boolean | null;
  onWatchedChange?: (watched: boolean) => void;
  compact?: boolean;
};

export function WatchButton({ externalId, initialWatched = null, onWatchedChange, compact = false }: WatchButtonProps) {
  const [watched, setWatched] = useState<boolean | null>(initialWatched);
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (initialWatched !== null) return;
    let active = true;
    fetch(`/api/quotations/${encodeURIComponent(externalId)}/watch`)
      .then(async (response) => {
        if (response.status === 401) {
          if (active) setHidden(true);
          return;
        }
        if (!response.ok) throw new Error(`Falha HTTP ${response.status}`);
        const data = (await response.json()) as { watched: boolean };
        if (active) setWatched(data.watched);
      })
      .catch((fetchError) => {
        console.error("Falha ao carregar acompanhamento", { externalId, error: fetchError });
      });
    return () => {
      active = false;
    };
  }, [externalId, initialWatched]);

  const isWatched = watched === true;

  function toggle() {
    const previous = watched;
    const next = !isWatched;
    setWatched(next);
    setError(false);
    onWatchedChange?.(next);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/quotations/${encodeURIComponent(externalId)}/watch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ watched: next })
        });
        if (response.status === 401) {
          setWatched(previous);
          onWatchedChange?.(previous === true);
          setHidden(true);
          return;
        }
        if (!response.ok) throw new Error(`Falha HTTP ${response.status}`);
        const data = (await response.json()) as { watched: boolean };
        setWatched(data.watched);
        onWatchedChange?.(data.watched);
      } catch (toggleError) {
        console.error("Falha ao alternar acompanhamento", { externalId, error: toggleError });
        setWatched(previous);
        onWatchedChange?.(previous === true);
        setError(true);
      }
    });
  }

  if (hidden) return null;

  const label = isWatched ? "Deixar de acompanhar" : "Acompanhar cotação";

  return (
    <button
      aria-label={label}
      aria-pressed={isWatched}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border transition-colors disabled:opacity-60 ${
        isWatched
          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
          : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg-subtle)]"
      } ${compact ? "h-9 w-9 text-base" : "min-h-11 px-4 text-sm font-semibold"}`}
      disabled={pending || watched === null}
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        toggle();
      }}
      title={error ? "Falha ao salvar. Tente novamente." : label}
      type="button"
    >
      <span aria-hidden="true">{isWatched ? "🔔" : "🔕"}</span>
      {!compact && <span>{isWatched ? "Acompanhando" : "Acompanhar"}</span>}
    </button>
  );
}
