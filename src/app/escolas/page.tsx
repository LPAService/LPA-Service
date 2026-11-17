import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import {
  countFavoriteSchools,
  listSchools,
  listSchoolCities,
  type SchoolWithCounts,
} from "@/lib/data/schools";
import { getCurrentUserId } from "@/lib/session";
import { FavoriteButton } from "./favorite-button";

export const metadata = {
  title: "Escolas · LPA Leo",
  description:
    "Escolas da região coberta pelo LPA Leo com suas cotações em aberto e histórico.",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EscolasPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const city = str(params?.city);
  const query = str(params?.query);
  const showFavorites = str(params?.view) === "favoritas";

  const userId = await getCurrentUserId();

  const [allSchools, cities, favoritesCount] = await Promise.all([
    listSchools({ city, query, userId, favoritesOnly: showFavorites }),
    listSchoolCities(),
    countFavoriteSchools(userId),
  ]);

  // Group schools by city
  const byCity = new Map<string, SchoolWithCounts[]>();
  for (const school of allSchools) {
    const key = school.city || "Cidade não informada";
    const list = byCity.get(key) ?? [];
    list.push(school);
    byCity.set(key, list);
  }

  const sortedCities = [...byCity.keys()].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );

  const totalOpen = allSchools.reduce((s, x) => s + x.openQuotations, 0);
  const totalSchools = allSchools.length;

  const allHref = buildHref({ city, query });
  const favoritesHref = buildHref({ city, query, view: "favoritas" });

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="shell py-8 sm:py-10">
          <nav
            aria-label="Navegação principal"
            className="flex flex-wrap items-center gap-2"
          >
            <Link className="action-secondary text-sm" href="/">
              Cotações abertas
            </Link>
            <Link
              className="action-secondary text-sm"
              href="/?view=history"
            >
              Histórico de compras
            </Link>
            <Link
              className="action-secondary text-sm"
              href="/relatorios"
            >
              📊 Relatório &amp; Análise
            </Link>
            <Link
              className="action-secondary text-sm"
              href="/fornecedores"
            >
              📦 Fornecedores
            </Link>
            <Link
              className="action-secondary text-sm"
              href="/preorcamento"
            >
              🧮 Pré-Orçamento
            </Link>
            <Link
              className="action-primary text-sm font-bold"
              href="/escolas"
            >
              🏫 Escolas
            </Link>
            <span className="ml-auto" />
            <NotificationBell />
            <ThemeToggle />
          </nav>
          <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow text-[var(--color-primary)]">
                Por escola
              </p>
              <h1 className="mt-2 text-4xl font-bold leading-none tracking-tighter text-[var(--color-fg)] sm:text-5xl">
                Escolas.
              </h1>
              <p className="mt-3 max-w-xl text-base text-[var(--color-fg-muted)]">
                Veja as escolas da região que cobrimos, suas cotações em aberto e
                o histórico completo de compras.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 self-end">
              <div className="metric-card">
                <p className="text-2xl font-extrabold tabular-nums tracking-tight text-[var(--color-fg)]">
                  {totalSchools.toLocaleString("pt-BR")}
                </p>
                <p className="eyebrow mt-1">escolas</p>
              </div>
              <div className="metric-card">
                <p className="text-2xl font-extrabold tabular-nums tracking-tight text-[var(--color-fg)]">
                  {totalOpen.toLocaleString("pt-BR")}
                </p>
                <p className="eyebrow mt-1">cotações em aberto</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="shell pt-6">
        <nav aria-label="Filtrar escolas" className="flex flex-wrap gap-2">
          <Link
            href={allHref}
            aria-current={showFavorites ? undefined : "page"}
            className={
              showFavorites
                ? "action-secondary text-sm"
                : "action-primary text-sm font-bold"
            }
          >
            Todas as escolas
          </Link>
          <Link
            href={favoritesHref}
            aria-current={showFavorites ? "page" : undefined}
            className={
              showFavorites
                ? "action-primary text-sm font-bold"
                : "action-secondary text-sm"
            }
          >
            ★ Favoritas ({favoritesCount})
          </Link>
        </nav>
      </section>

      <section className="shell py-6">
        <div className="glass-toolbar p-4 sm:p-5">
          <form
            className="grid gap-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto]"
            role="search"
          >
            {showFavorites && (
              <input type="hidden" name="view" value="favoritas" />
            )}
            <label className="relative block">
              <span className="sr-only">Buscar escola</span>
              <input
                className="field"
                defaultValue={query}
                name="query"
                placeholder="🔎 Busque por nome da escola"
              />
            </label>
            <label>
              <span className="field-label">Cidade</span>
              <select
                className="field mt-1"
                defaultValue={city ?? ""}
                name="city"
              >
                <option value="">Todas</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <button className="action-primary self-end" type="submit">
              Buscar
            </button>
          </form>
        </div>
      </section>

      <section className="shell py-4 sm:py-6">
        {allSchools.length === 0 ? (
          <div className="glass-panel p-8">
            {showFavorites && favoritesCount === 0 ? (
              <>
                <h2 className="text-lg font-bold">
                  Você ainda não favoritou nenhuma escola
                </h2>
                <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
                  Clique na estrela de uma escola para guardá-la aqui.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold">
                  Nenhuma escola encontrada com esses filtros
                </h2>
                <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
                  Remova algum filtro ou tente outro termo de busca.
                </p>
              </>
            )}
          </div>
        ) : (
          sortedCities.map((cityName) => {
            const citySchools = byCity.get(cityName)!;
            return (
              <div key={cityName} className="mb-8">
                <div className="mb-4 flex items-baseline gap-3">
                  <h2 className="text-xl font-bold text-[var(--color-fg)]">
                    {cityName}
                  </h2>
                  <span className="text-sm font-semibold text-[var(--color-fg-muted)]">
                    {citySchools.length}{" "}
                    {citySchools.length === 1 ? "escola" : "escolas"}
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {citySchools.map((school) => (
                    <SchoolCard key={school.idSchool} school={school} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}

function SchoolCard({ school }: { school: SchoolWithCounts }) {
  const totalProcesses = school.totalQuotations + school.totalOpportunities;
  return (
    <div className="opportunity-card group relative flex flex-col gap-4 p-5 border border-[var(--color-border)] rounded-[var(--radius-card)] transition-all duration-300 hover:border-[var(--color-primary)]/50">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/escolas/${school.idSchool}`}
          className="min-w-0 no-underline"
        >
          <h3 className="text-base font-bold leading-tight text-[var(--color-fg)]">
            {school.name}
          </h3>
          <p className="mt-1 text-xs font-semibold text-[var(--color-fg-muted)]">
            {school.city || "Cidade não informada"}
            {school.regional ? ` · ${school.regional}` : ""}
          </p>
        </Link>
        <FavoriteButton
          idSchool={school.idSchool}
          isFavorite={school.isFavorite}
          schoolName={school.name}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-2.5 text-center">
          <p className="text-lg font-extrabold tabular-nums text-[var(--color-success)]">
            {school.openQuotations}
          </p>
          <p className="text-[10px] font-bold uppercase text-[var(--color-fg-muted)]">
            Em aberto
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-2.5 text-center">
          <p className="text-lg font-extrabold tabular-nums text-[var(--color-fg)]">
            {school.totalQuotations}
          </p>
          <p className="text-[10px] font-bold uppercase text-[var(--color-fg-muted)]">
            Cotações
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-2.5 text-center">
          <p className="text-lg font-extrabold tabular-nums text-[var(--color-fg)]">
            {school.totalOpportunities}
          </p>
          <p className="text-[10px] font-bold uppercase text-[var(--color-fg-muted)]">
            Compras
          </p>
        </div>
      </div>

      <Link
        href={`/escolas/${school.idSchool}`}
        className="flex items-center justify-between border-t border-[var(--color-border)] pt-3 no-underline"
      >
        <span className="text-xs font-semibold text-[var(--color-fg-muted)]">
          {totalProcesses}{" "}
          {totalProcesses === 1 ? "processo" : "processos"} no total
        </span>
        <span className="text-sm font-bold text-[var(--color-primary)]">
          Ver detalhes <span aria-hidden="true">→</span>
        </span>
      </Link>
    </div>
  );
}

function buildHref(params: { city?: string; query?: string; view?: string }) {
  const search = new URLSearchParams();
  if (params.query) search.set("query", params.query);
  if (params.city) search.set("city", params.city);
  if (params.view) search.set("view", params.view);
  const qs = search.toString();
  return qs ? `/escolas?${qs}` : "/escolas";
}

function str(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}
