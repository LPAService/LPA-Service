import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-slate-500">404</p>
        <h1 className="mt-2 text-xl font-bold text-slate-950">
          Oportunidade não encontrada
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Esse identificador não foi encontrado na fonte de dados.
        </p>
        <Link
          className="mt-5 inline-flex h-10 items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          href="/"
        >
          Voltar ao dashboard
        </Link>
      </section>
    </main>
  );
}
