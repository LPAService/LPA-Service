import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-bg-subtle)] px-4">
      <section className="w-full max-w-lg rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 text-center shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold text-[var(--color-fg-muted)]">404</p>
        <h1 className="mt-2 text-xl font-bold text-[var(--color-fg)]">
          Oportunidade não encontrada
        </h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Esse identificador não foi encontrado na fonte de dados.
        </p>
        <Link
          className="mt-5 inline-flex h-10 items-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-fg)] hover:opacity-90"
          href="/"
        >
          Voltar ao dashboard
        </Link>
      </section>
    </main>
  );
}
