"use client";

export default function Error({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-bg)] px-4">
      <section className="glass-panel w-full max-w-lg p-6 text-center">
        <p className="text-sm font-semibold text-[var(--color-danger)]">Erro</p>
        <h1 className="mt-2 text-xl font-bold text-[var(--color-fg)]">
          Dashboard não carregou
        </h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Falha inesperada ao montar oportunidades.
        </p>
        <button
          className="action-primary mt-5"
          onClick={reset}
        >
          Tentar de novo
        </button>
      </section>
    </main>
  );
}
