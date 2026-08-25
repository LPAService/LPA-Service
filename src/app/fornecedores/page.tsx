import Link from "next/link";
import { CatalogSuppliersPanel } from "@/components/catalog/suppliers-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { catalogSource } from "@/lib/data/catalog";

export const metadata = {
  title: "Fornecedores · Catálogo · LPA Leo",
  description: "Catálogo próprio de fornecedores com itens e preços para pré-orçar cotações."
};

export const dynamic = "force-dynamic";

export default async function FornecedoresPage() {
  const suppliers = await catalogSource.listSuppliers();
  const activeCount = suppliers.filter((supplier) => supplier.active).length;
  const itemCount = suppliers.reduce((sum, supplier) => sum + supplier.itemCount, 0);

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="shell py-8 sm:py-10">
          <nav aria-label="Navegação principal" className="flex flex-wrap items-center gap-2">
            <Link className="action-secondary text-sm" href="/">Cotações abertas</Link>
            <Link className="action-secondary text-sm" href="/?view=history">Histórico de compras</Link>
            <Link className="action-secondary text-sm" href="/relatorios">📊 Relatório & Análise</Link>
            <Link className="action-primary text-sm font-bold" href="/fornecedores">📦 Fornecedores</Link>
            <Link className="action-secondary text-sm" href="/preorcamento">🧮 Pré-Orçamento</Link>
            <span className="ml-auto" />
            <ThemeToggle />
          </nav>
          <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow text-[var(--color-primary)]">Catálogo próprio</p>
              <h1 className="mt-2 text-4xl font-bold leading-none tracking-tighter text-[var(--color-fg)] sm:text-5xl">
                Fornecedores.
              </h1>
              <p className="mt-3 max-w-xl text-base text-[var(--color-fg-muted)]">
                Cadastre fornecedores, itens e preços reais. O pré-orçamento usa este catálogo para calcular o custo real de cada licitação.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 self-end">
              <div className="metric-card">
                <p className="text-2xl font-extrabold tabular-nums tracking-tight text-[var(--color-fg)]">{activeCount}</p>
                <p className="eyebrow mt-1">ativos</p>
              </div>
              <div className="metric-card">
                <p className="text-2xl font-extrabold tabular-nums tracking-tight text-[var(--color-fg)]">{itemCount}</p>
                <p className="eyebrow mt-1">itens precificados</p>
              </div>
            </div>
          </div>
        </div>
      </header>
      <section className="shell py-8">
        <CatalogSuppliersPanel initialSuppliers={suppliers} />
      </section>
    </main>
  );
}
