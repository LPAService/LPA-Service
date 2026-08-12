import Link from "next/link";
import { OpportunityCard } from "@/components/opportunity-card";
import { opportunitySource, sanitizePageParam } from "@/lib/data/source";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const PAGE_SIZE = 12;

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const currentParams = new URLSearchParams();
  const cleanParams: Record<string, string | string[] | undefined> = {};

  for (const [key, value] of Object.entries(params ?? {})) {
    const cleanKey = key.trim();
    if (!cleanKey) continue;

    if (Array.isArray(value)) {
      cleanParams[cleanKey] = value;
      continue;
    }

    const cleanValue = value?.trim();
    if (cleanValue) {
      cleanParams[cleanKey] = cleanValue;
      currentParams.set(cleanKey, cleanValue);
    }
  }

  const page = sanitizePageParam(cleanParams.page);
  const filters = {
    city: getStringParam(cleanParams.city),
    category: getStringParam(cleanParams.category),
    expenseGroup: getStringParam(cleanParams.expenseGroup),
    school: getStringParam(cleanParams.school),
    periodStart: getStringParam(cleanParams.periodStart),
    periodEnd: getStringParam(cleanParams.periodEnd),
    query: getStringParam(cleanParams.query)
  };
  const result = await opportunitySource.listOpportunities(filters, {
    page,
    pageSize: PAGE_SIZE
  });
  return (
    <main className="min-h-screen bg-[var(--color-bg-subtle)]">
      <section className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[var(--color-primary)]">
                Caixa Escolar MG
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-normal text-[var(--color-fg)] sm:text-3xl">
                Oportunidades
              </h1>
              <p className="mt-1 text-sm text-[var(--color-fg-muted)]">Compras escolares organizadas para sua consulta.</p>
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

          <form className="grid min-w-0 gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3 lg:grid-cols-12">
            <label className="grid gap-1 text-sm font-semibold text-[var(--color-fg-muted)] lg:col-span-3">
              Busca
              <input
                className="h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 font-normal text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]"
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
            <label className="grid gap-1 text-sm font-semibold text-[var(--color-fg-muted)] lg:col-span-2">
              De
              <input
                className="h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 font-normal text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]"
                defaultValue={filters.periodStart}
                name="periodStart"
                type="date"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-[var(--color-fg-muted)] lg:col-span-2">
              Até
              <input
                className="h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 font-normal text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]"
                defaultValue={filters.periodEnd}
                name="periodEnd"
                type="date"
              />
            </label>
            <div className="flex items-end gap-2 lg:col-span-8">
              <button className="h-10 rounded-md bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-fg)] transition hover:opacity-90">
                Filtrar
              </button>
              <Link
                className="inline-flex h-10 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-4 text-sm font-semibold text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)]"
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
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-8 text-center shadow-[var(--shadow-card)]">
            <h2 className="text-lg font-bold text-[var(--color-fg)]">
              Nenhum resultado com esses filtros
            </h2>
            <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
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

function getStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2">
      <p className="text-lg font-bold leading-none text-[var(--color-fg)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--color-fg-muted)]">{label}</p>
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
    <label className={`grid gap-1 text-sm font-semibold text-[var(--color-fg-muted)] ${className}`}>
      {label}
      <select
        className="h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 font-normal text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]"
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
        className="inline-flex h-10 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-4 text-sm font-semibold text-[var(--color-fg-muted)] aria-disabled:pointer-events-none aria-disabled:opacity-40"
        href={`/?${previousParams.toString()}`}
      >
        Anterior
      </a>
      <p className="text-sm font-semibold text-[var(--color-fg-muted)]">
        Página {page} de {totalPages}
      </p>
      <a
        aria-disabled={page >= totalPages}
        className="inline-flex h-10 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-4 text-sm font-semibold text-[var(--color-fg-muted)] aria-disabled:pointer-events-none aria-disabled:opacity-40"
        href={`/?${nextParams.toString()}`}
      >
        Próxima
      </a>
    </nav>
  );
}
