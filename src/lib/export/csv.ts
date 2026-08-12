import type { NormalizedOpportunity } from "@/lib/contracts/opportunity";
import type { OpportunityFilters, OpportunitySource } from "@/lib/data/source";

export const OPPORTUNITY_CSV_HEADER = [
  "pedido",
  "categoria",
  "grupo_despesa",
  "headline",
  "resumo",
  "escola",
  "cidade",
  "regional",
  "data_compra",
  "data_proposta",
  "data_entrega",
  "valor_total",
  "qtd_itens",
  "principais_itens",
  "fornecedor",
  "cnpj_fornecedor",
  "status_compra",
  "url_portal"
];

const EXPORT_PAGE_SIZE = 48;

export function csvRow(values: Array<string | number | null | undefined>) {
  return `${values.map(csvField).join(",")}\r\n`;
}

export function csvField(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function opportunityCsvRow(opportunity: NormalizedOpportunity) {
  return csvRow([
    opportunity.orderId,
    opportunity.category?.name,
    opportunity.expenseGroup,
    opportunity.headline,
    opportunity.summary,
    opportunity.school,
    opportunity.city,
    opportunity.regional,
    formatDate(opportunity.purchaseDate),
    formatDate(opportunity.proposalDate),
    formatDate(opportunity.deliveryDate),
    formatDecimal(opportunity.totalValue),
    opportunity.itemCount,
    opportunity.topItems.join("; "),
    opportunity.supplierName,
    opportunity.supplierDocument,
    opportunity.purchaseOrderStatus,
    opportunity.sourceUrl
  ]);
}

export async function* exportOpportunities(
  source: OpportunitySource,
  filters: OpportunityFilters
) {
  let page = 1;
  while (true) {
    const result = await source.listOpportunities(filters, {
      page,
      pageSize: EXPORT_PAGE_SIZE
    });
    for (const opportunity of result.data) yield opportunity;
    if (page >= result.totalPages || result.data.length === 0) return;
    page += 1;
  }
}

export function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function formatDecimal(value: number | null) {
  return value == null || !Number.isFinite(value) ? "" : value.toFixed(2).replace(".", ",");
}
