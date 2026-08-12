import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCurrency, formatDate } from "@/components/opportunity-card";
import { opportunitySource } from "@/lib/data/source";

type DetailPageProps = {
  params: Promise<{ externalId: string }>;
};

export default async function DetailPage({ params }: DetailPageProps) {
  const { externalId } = await params;
  const opportunity = await opportunitySource.getOpportunity(externalId);

  if (!opportunity) notFound();

  const topItems =
    opportunity.topItems.length > 0
      ? opportunity.topItems.map((item) => `· ${item}`).join(" ")
      : "Itens não informados";

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <Link className="text-sm font-semibold text-emerald-700" href="/">
            Voltar
          </Link>
          <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-normal text-slate-500">
                Pedido {opportunity.orderId}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-normal text-slate-950 sm:text-3xl">
                {opportunity.headline}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
                {opportunity.summary}
              </p>
            </div>
            <div className="grid min-w-0 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-right">
              <p className="text-2xl font-bold text-emerald-700">
                {formatCurrency(opportunity.totalValue)}
              </p>
              <p className="text-sm text-slate-600">
                {opportunity.itemCount} itens · {opportunity.expenseGroup}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl min-w-0 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:px-8">
        <div className="grid min-w-0 gap-5">
          <Panel title="Resumo comercial">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Fact label="Escola" value={opportunity.school} />
              <Fact label="Cidade" value={opportunity.city ?? "Não informado"} />
              <Fact label="Regional" value={opportunity.regional ?? "Não informado"} />
              <Fact label="Entrega" value={formatDate(opportunity.deliveryDate)} />
              <Fact label="Compra" value={formatDate(opportunity.purchaseDate)} />
              <Fact label="Proposta" value={formatDate(opportunity.proposalDate)} />
              <Fact label="Grupo de despesa" value={opportunity.expenseGroup} />
              <Fact label="Subprograma" value={opportunity.subprogram} />
            </dl>
            <div className="mt-5">
              <p className="font-bold text-slate-950">Principais itens:</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">
                {topItems}
              </p>
            </div>
          </Panel>

          <Panel title="Itens">
            {opportunity.items.length === 0 ? (
              <p className="text-sm text-slate-600">Itens não informados.</p>
            ) : (
              <div className="min-w-0 max-w-full overflow-x-auto">
                <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-normal text-slate-500">
                      <th className="border-b border-slate-200 py-2 pr-3">Item</th>
                      <th className="border-b border-slate-200 px-3">Descrição</th>
                      <th className="border-b border-slate-200 px-3">Un.</th>
                      <th className="border-b border-slate-200 px-3 text-right">Qtd</th>
                      <th className="border-b border-slate-200 px-3 text-right">
                        Valor unit.
                      </th>
                      <th className="border-b border-slate-200 pl-3 text-right">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunity.items.map((item) => (
                      <tr key={item.order} className="align-top">
                        <td className="border-b border-slate-100 py-3 pr-3 font-semibold text-slate-950">
                          {item.name}
                        </td>
                        <td className="max-w-md border-b border-slate-100 px-3 py-3 text-slate-700">
                          {item.description}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                          {item.unit}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-right text-slate-700">
                          {item.quantity}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-right text-slate-700">
                          {formatCurrency(item.unitValue)}
                        </td>
                        <td className="border-b border-slate-100 py-3 pl-3 text-right font-semibold text-slate-950">
                          {formatCurrency(item.totalValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <aside className="grid min-w-0 content-start gap-5">
          <Panel title="Fornecedor vencedor">
            <dl className="grid gap-3 text-sm">
              <Fact
                label="Nome"
                value={opportunity.supplierName ?? "Não informado"}
              />
              <Fact
                label="Documento"
                value={opportunity.supplierDocument ?? "Não informado"}
              />
              <Fact
                label="Status compra"
                value={opportunity.purchaseOrderStatus ?? "Não informado"}
              />
              <Fact
                label="Prestação de contas"
                value={opportunity.accountabilityStatus ?? "Não informado"}
              />
            </dl>
          </Panel>

          <Panel title="Anexos">
            {opportunity.attachments.length === 0 ? (
              <p className="text-sm text-slate-600">Nenhum anexo informado.</p>
            ) : (
              <ul className="grid gap-2">
                {opportunity.attachments.map((attachment) => (
                  <li
                    className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm"
                    key={attachment.id}
                  >
                    <p className="font-semibold text-slate-950">
                      {attachment.filename}
                    </p>
                    <p className="mt-1 break-all text-xs text-slate-500">
                      {attachment.thumbUrl}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <a
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            href={opportunity.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            Abrir processo na fonte
          </a>
        </aside>
      </section>
    </main>
  );
}

function Panel({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-normal text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-slate-950">{value}</dd>
    </div>
  );
}
