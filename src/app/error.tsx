"use client";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <section className="w-full max-w-lg rounded-lg border border-red-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-red-700">Erro</p>
        <h1 className="mt-2 text-xl font-bold text-slate-950">
          Dashboard não carregou
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {error.message || "Falha inesperada ao montar oportunidades."}
        </p>
        <button
          className="mt-5 h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          onClick={reset}
        >
          Tentar de novo
        </button>
      </section>
    </main>
  );
}
