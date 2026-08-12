import Link from "next/link";
import { OpportunityCard } from "@/components/opportunity-card";
import { opportunitySource } from "@/lib/data/source";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const PAGE_SIZE = 12;

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const currentParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (typeof value === "string" && value) currentParams.set(key, value);
  }

  const page = Number(currentParams.get("page") ?? "1");
  const filters = {
    city: currentParams.get("city") ?? undefined,
    category: currentParams.get("category") ?? undefined,
    expenseGroup: currentParams.get("expenseGroup") ?? undefined,
    school: currentParams.get("school") ?? undefined,
    periodStart: currentParams.get("periodStart") ?? undefined,
    periodEnd: currentParams.get("periodEnd") ?? undefined,
    query: currentParams.get("query") ?? undefined
  };
  const result = await opportunitySource.listOpportunities(filters, {
    page,
    pageSize: PAGE_SIZE
  });
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-emerald-700">
                Caixa Escolar MG
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-normal text-slate-950 sm:text-3xl">
                Compras fechadas mastigadas para fornecedor
              </h1>
            </div>
            <div className="grid grid-cols-3 gap-2 text-right text-sm">
              <Metric label="registros" value={result.totalAvailable.toString()} />
              <Metric
                label="resultado"
                value={result.total.toString()}
              />
              <Metric
                label="página"
                value={`${result.page}/${result.totalPages}`}
              />
            </div>
          </div>

          <form className="grid min-w-0 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:grid-cols-12">
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-3">
              Busca
              <input
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none focus:border-emerald-600"
                defaultValue={filters.query}
                name="query"
                placeholder="item, escola, fornecedor"
              />
            </label>
            <Select
              className="lg:col-span-2"
              label="Cidade"
              name="city"
              options={result.facets.cities.map((city) => [city, city])}
              value={filters.city}
            />
            <Select
              className="lg:col-span-2"
              label="Categoria"
              name="category"
              options={result.facets.categories.map((category) => [
                category.slug,
                category.name
              ])}
              value={filters.category}
            />
            <Select
              className="lg:col-span-2"
              label="Grupo"
              name="expenseGroup"
              options={result.facets.expenseGroups.map((group) => [group, group])}
              value={filters.expenseGroup}
            />
            <Select
              className="lg:col-span-3"
              label="Escola"
              name="school"
              options={result.facets.schools.map((school) => [school, school])}
              value={filters.school}
            />
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              De
              <input
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none focus:border-emerald-600"
                defaultValue={filters.periodStart}
                name="periodStart"
                type="date"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Até
              <input
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none focus:border-emerald-600"
                defaultValue={filters.periodEnd}
                name="periodEnd"
                type="date"
              />
            </label>
            <div className="flex items-end gap-2 lg:col-span-8">
              <button className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
                Filtrar
              </button>
              <Link
                className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                href="/"
              >
                Limpar
              </Link>
            </div>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {result.data.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <h2 className="text-lg font-bold text-slate-950">
              Nenhum resultado com esses filtros
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Remova algum filtro ou amplie período para ver mais compras.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.data.map((opportunity) => (
              <OpportunityCard
                key={opportunity.externalId}
                opportunity={opportunity}
              />
            ))}
          </div>
        )}

        <Pagination
          currentParams={currentParams}
          page={result.page}
          totalPages={result.totalPages}
        />
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-lg font-bold leading-none text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function Select({
  className,
  label,
  name,
  options,
  value
}: {
  className?: string;
  label: string;
  name: string;
  options: string[][];
  value?: string;
}) {
  return (
    <label className={`grid gap-1 text-sm font-semibold text-slate-700 ${className}`}>
      {label}
      <select
        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none focus:border-emerald-600"
        defaultValue={value ?? ""}
        name={name}
      >
        <option value="">Todos</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function Pagination({
  currentParams,
  page,
  totalPages
}: {
  currentParams: URLSearchParams;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const previousParams = new URLSearchParams(currentParams);
  previousParams.set("page", Math.max(1, page - 1).toString());
  const nextParams = new URLSearchParams(currentParams);
  nextParams.set("page", Math.min(totalPages, page + 1).toString());

  return (
    <nav className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <a
        aria-disabled={page <= 1}
        className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 aria-disabled:pointer-events-none aria-disabled:opacity-40"
        href={`/?${previousParams.toString()}`}
      >
        Anterior
      </a>
      <p className="text-sm font-semibold text-slate-700">
        Página {page} de {totalPages}
      </p>
      <a
        aria-disabled={page >= totalPages}
        className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 aria-disabled:pointer-events-none aria-disabled:opacity-40"
        href={`/?${nextParams.toString()}`}
      >
        Próxima
      </a>
    </nav>
  );
}
