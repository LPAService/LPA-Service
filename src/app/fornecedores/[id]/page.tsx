import Link from "next/link";
import { notFound } from "next/navigation";
import { SupplierItemsEditor } from "@/components/catalog/supplier-items-editor";
import { catalogSource } from "@/lib/data/catalog";

export const dynamic = "force-dynamic";

type SupplierPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SupplierPage({ params }: SupplierPageProps) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const supplier = await catalogSource.getSupplier(id);
  if (!supplier) notFound();
  const items = await catalogSource.listSupplierItems(id);

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="shell py-8">
          <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--color-primary)] hover:underline" href="/fornecedores">
            ← Fornecedores
          </Link>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow text-[var(--color-primary)]">
                {supplier.active ? "Fornecedor ativo" : "Fornecedor inativo"}
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-fg)] sm:text-4xl">
                {supplier.name}
              </h1>
              <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
                {[supplier.document, supplier.city, supplier.contactName, supplier.phone, supplier.email]
                  .filter(Boolean)
                  .join(" · ") || "Sem dados de contato."}
              </p>
            </div>
            <div className="self-end border-y border-[var(--color-border)] px-4 py-2 text-right">
              <p className="text-2xl font-bold tabular-nums text-[var(--color-fg)]">{items.length}</p>
              <p className="eyebrow mt-1">itens precificados</p>
            </div>
          </div>
        </div>
      </header>
      <section className="shell py-8">
        <SupplierItemsEditor initialItems={items} supplier={supplier} />
      </section>
    </main>
  );
}
