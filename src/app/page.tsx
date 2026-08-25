import Link from "next/link";
import { OpportunityCard } from "@/components/opportunity-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { opportunitySource, quotationSource, sanitizePageParam } from "@/lib/data/source";
import type { OpportunityFilters } from "@/lib/data/source";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
const PAGE_SIZE = 18;

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const currentParams = new URLSearchParams();
  const cleanParams: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    const cleanKey = key.trim(); if (!cleanKey) continue;
    if (Array.isArray(value)) { cleanParams[cleanKey] = value; continue; }
    const cleanValue = value?.trim(); if (cleanValue) { cleanParams[cleanKey] = cleanValue; currentParams.set(cleanKey, cleanValue); }
  }
  const page = sanitizePageParam(cleanParams.page);
  const view = str(cleanParams.view) === "history" ? "history" : "open";
  const situation = view === "history" ? undefined : quotationSituation(str(cleanParams.situation));
  const filters: OpportunityFilters = { city: str(cleanParams.city), category: str(cleanParams.category), expenseGroup: str(cleanParams.expenseGroup), school: str(cleanParams.school), periodStart: str(cleanParams.periodStart), periodEnd: str(cleanParams.periodEnd), query: str(cleanParams.query), situation };
  const source = view === "history" ? opportunitySource : quotationSource;
  const result = await source.listOpportunities(filters, { page, pageSize: PAGE_SIZE });
  const exportParams = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) exportParams.set(key, value);
  const active = Object.entries(filters).filter(([, value]) => value);
  return <main className="min-h-screen">
    <nav className="sticky top-0 z-50">
      <div className="shell nav-pill">
        <Link className="flex items-center gap-2.5 no-underline" href="/">
          <span className="brand-mark">L</span>
          <span className="leading-tight">
            <span className="block text-sm font-extrabold tracking-tight text-[var(--color-fg)]">LPA Leo</span>
            <span className="block text-[10px] font-semibold tracking-[0.04em] text-[var(--color-fg-muted)]">CAIXA ESCOLAR MG</span>
          </span>
        </Link>
        <Link className="pill-link" href="/">Cotações</Link>
        <Link className="pill-link" href="/?view=history">Histórico</Link>
        <Link className="pill-link" href="/relatorios">📊 Relatórios</Link>
        <Link className="pill-link" href="/fornecedores">📦 Fornecedores</Link>
        <Link className="pill-link" href="/preorcamento">🧮 Pré-Orçamento</Link>
        <a className="action-secondary ml-auto hidden min-h-[38px] sm:inline-flex" href={`/api/export?${exportParams.toString()}`}>Exportar</a>
        <NotificationBell /><ThemeToggle />
      </div>
    </nav>

    <header className="shell pt-10 pb-2 sm:pt-14">
      <div className="grid items-end gap-8 lg:grid-cols-[1.35fr_0.9fr]">
        <div>
          <span className="eyebrow-pill"><span className="pulse-dot" />Cotações abertas · Grande BH</span>
          <h1 className="mt-4 text-5xl font-extrabold leading-none tracking-tighter text-[var(--color-fg)] sm:text-6xl">Novas compras<br className="hidden sm:block" /> para <span className="grad-text">enviar proposta</span>.</h1>
          <p className="mt-4 max-w-xl text-lg leading-7 text-[var(--color-fg-muted)]">Prazos, escolas e itens do SGD em cards comerciais rápidos e visuais.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric label={view === "history" ? "histórico" : situationLabel(situation)} value={result.total.toLocaleString("pt-BR")} icon="📬" />
          <Metric label={view === "history" ? "encontradas" : "no SGD"} value={result.totalAvailable.toLocaleString("pt-BR")} icon="🗂️" />
          <Metric label="municípios" value="7" icon="🏙️" />
          <Metric label="em tempo real" value="SGD" icon="⚡" />
        </div>
      </div>
    </header>

    <section className="shell py-6">
      <div className="glass-toolbar p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link className={`pill-link ${view === "open" ? "active" : ""}`} href="/">Cotações abertas</Link>
          <Link className={`pill-link ${view === "history" ? "active" : ""}`} href="/?view=history">Histórico de compras</Link>
          <span className="ml-1 hidden h-6 w-px bg-[var(--color-border-strong)] sm:block" aria-hidden="true" />
          <Link className="pill-link" href="/relatorios">📊 Relatório & Análise</Link>
          <Link className="pill-link" href="/fornecedores">📦 Fornecedores</Link>
          <Link className="pill-link" href="/preorcamento">🧮 Pré-Orçamento</Link>
        </div>
        <form className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_repeat(4,minmax(0,1fr))_auto]" role="search">
          {view === "history" && <input name="view" type="hidden" value="history" />}
          <label className="relative block">
            <span className="sr-only">Buscar oportunidades</span>
            <input className="field" defaultValue={filters.query} name="query" placeholder="🔎 Busque por item, escola ou fornecedor" />
          </label>
          {view !== "history" && <Select label="Situação" name="situation" options={[["open", "Abertas"], ["closed", "Encerradas"], ["all", "Todas"]]} value={filters.situation} />}
          <Select label="Cidade" name="city" options={result.facets.cities.map(x => [x, x])} value={filters.city} />
          <Select label="Categoria" name="category" options={result.facets.categories.map(x => [x.slug, x.name])} value={filters.category} />
          <Select label="Escola" name="school" options={result.facets.schools.map(x => [x, x])} value={filters.school} />
          <button className="action-primary" type="submit">Buscar</button>
          <details className="lg:col-span-6">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--color-fg-muted)]">Mais filtros <span className="ml-1 text-[var(--color-primary)]">+</span></summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Select label="Grupo de despesa" name="expenseGroup" options={result.facets.expenseGroups.map(x => [x, x])} value={filters.expenseGroup} />
              <label><span className="field-label">{view === "history" ? "Compra a partir de" : "Prazo a partir de"}</span><input className="field mt-1" defaultValue={filters.periodStart} name="periodStart" type="date" /></label>
              <label><span className="field-label">{view === "history" ? "Entrega até" : "Prazo até"}</span><input className="field mt-1" defaultValue={filters.periodEnd} name="periodEnd" type="date" /></label>
            </div>
          </details>
        </form>
        {active.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-[var(--color-fg-muted)]">Filtros ativos</span>{active.map(([key, value]) => <span className="filter-chip" key={key}>{filterLabel(key, value)}</span>)}<Link className="ml-1 text-sm font-semibold text-[var(--color-primary)]" href={view === "history" ? "/?view=history" : "/"}>Limpar tudo</Link></div>}
      </div>
    </section>

    <section className="shell py-4 sm:py-6">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold text-[var(--color-fg)]">{result.total.toLocaleString("pt-BR")} {view === "history" ? "compras no histórico" : quotationCountLabel(situation)}</h2>
        <div className="flex items-center gap-4"><p className="text-sm text-[var(--color-fg-muted)]">Página {result.page} de {result.totalPages}</p><a className="action-secondary min-h-[38px]" href={`/api/export?${exportParams.toString()}`}>Exportar</a></div>
      </div>
      {result.data.length === 0
        ? <div className="glass-panel p-8"><h2 className="text-lg font-bold">Nenhum resultado com esses filtros</h2><p className="mt-2 text-sm text-[var(--color-fg-muted)]">Remova algum filtro ou amplie o período.</p></div>
        : <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">{result.data.map(o => <OpportunityCard key={o.externalId} opportunity={o} />)}</div>}
      <Pagination currentParams={currentParams} page={result.page} totalPages={result.totalPages} />
    </section>
  </main>;
}
const str = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;
function quotationSituation(value: string | undefined) { return value === "closed" || value === "all" ? value : "open"; }
function situationLabel(value: OpportunityFilters["situation"]) { return value === "closed" ? "encerradas" : value === "all" ? "todas" : "abertas"; }
function quotationCountLabel(value: OpportunityFilters["situation"]) { return value === "closed" ? "cotações encerradas" : value === "all" ? "cotações" : "cotações abertas"; }
function filterLabel(key: string, value: string | string[] | undefined) { if (key === "situation") return value === "closed" ? "Encerradas" : value === "all" ? "Todas" : "Abertas"; return value; }
function Metric({ label, value, icon, className = "" }: { label: string; value: string; icon: string; className?: string }) { return <div className={`metric-card ${className}`}><span className="absolute right-3.5 top-3.5 text-base opacity-90" aria-hidden="true">{icon}</span><p className="text-2xl font-extrabold tabular-nums tracking-tight text-[var(--color-fg)]">{value}</p><p className="eyebrow mt-1">{label}</p></div>; }
function Select({ label, name, options, value }: { label: string; name: string; options: string[][]; value?: string }) { return <label><span className="field-label">{label}</span><select className="field mt-1" defaultValue={value ?? ""} name={name}><option value="">Todas</option>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>; }
function Pagination({ currentParams, page, totalPages }: { currentParams: URLSearchParams; page: number; totalPages: number }) { if (totalPages <= 1) return null; const prev = new URLSearchParams(currentParams); prev.set("page", `${Math.max(1,page-1)}`); const next = new URLSearchParams(currentParams); next.set("page", `${Math.min(totalPages,page+1)}`); return <nav className="mt-10 flex items-center justify-between border-t border-[var(--color-border)] pt-5"><a aria-disabled={page <= 1} className="action-secondary" href={`/?${prev}`}>← Anterior</a><p className="text-sm font-medium text-[var(--color-fg-muted)]">{page} / {totalPages}</p><a aria-disabled={page >= totalPages} className="action-secondary" href={`/?${next}`}>Próxima →</a></nav>; }
