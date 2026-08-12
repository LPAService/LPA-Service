"use client";

export default function Error({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-bg-subtle)] px-4">
      <section className="w-full max-w-lg rounded-[var(--radius-card)] border border-[var(--color-danger)] bg-[var(--color-bg)] p-6 text-center shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold text-[var(--color-danger)]">Erro</p>
        <h1 className="mt-2 text-xl font-bold text-[var(--color-fg)]">
          Dashboard não carregou
        </h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Falha inesperada ao montar oportunidades.
        </p>
        <button
          className="mt-5 h-10 rounded-md bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-fg)] hover:opacity-90"
          onClick={reset}
        >
          Tentar de novo
        </button>
      </section>
    </main>
  );
}
