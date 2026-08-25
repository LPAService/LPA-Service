import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-bg)] px-4">
      <section className="glass-panel w-full max-w-lg p-6 text-center">
        <p className="text-sm font-semibold text-[var(--color-fg-muted)]">404</p>
        <h1 className="mt-2 text-xl font-bold text-[var(--color-fg)]">
          Oportunidade não encontrada
        </h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Esse identificador não foi encontrado na fonte de dados.
        </p>
        <Link
          className="action-primary mt-5"
          href="/"
        >
          Voltar ao dashboard
        </Link>
      </section>
    </main>
  );
}
