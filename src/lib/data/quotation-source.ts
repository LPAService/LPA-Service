import { sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { NormalizedOpportunity, OpportunityItem } from "@/lib/contracts/opportunity";
import { categories, quotationItems, quotations } from "@/lib/db/schema";
import type { OpportunityFilters, OpportunitySource } from "@/lib/data/source";
import type * as schema from "@/lib/db/schema";
import { getQuotationStatus } from "@/lib/collector/quotations";
import rmbhCounties from "@/lib/collector/rmbh-counties.json";

type QuotationDatabase = NodePgDatabase<typeof schema>;

type QuotationRow = {
  id: number;
  external_id: string;
  nu_budget_order: string | null;
  id_subprogram: number;
  id_school: number;
  id_budget: number;
  id_county: number | null;
  county_name: string | null;
  school_name: string;
  expense_group: string;
  headline: string;
  summary: string;
  top_items: unknown;
  proposal_deadline: Date | string | null;
  delivery_date: Date | string | null;
  item_count: number;
  total_reference_value: number | null;
  budget_status: string | null;
  supplier_status: string | null;
  proposal_url: string;
  raw_json: unknown;
  collected_at: Date | string | null;
  category_slug: string | null;
  category_name: string | null;
};

type QuotationItemRow = {
  quotation_id: number;
  item_order: number;
  name: string;
  description: string;
  unit: string;
  quantity: number;
  reference_value: number | null;
};

type FacetRow = {
  city: string | null;
  category_slug: string | null;
  category_name: string | null;
  expense_group: string;
  school: string | null;
};

const rmbhCountyIds = rmbhCounties.counties.map((county) => county.idCounty);
const rmbhCityNames = new Set(rmbhCounties.counties.map((county) => normalizeScopeCity(county.name)));

export function createPostgresQuotationSource(database: QuotationDatabase): OpportunitySource {
  return {
    async listOpportunities(filters = {}, page = {}) {
      const pageNumber = sanitizePositiveInteger(page.page, 1);
      const pageSize = Math.min(48, sanitizePositiveInteger(page.pageSize, 12));
      const where = buildWhere(filters);

      const [filteredCountResult, availableCountResult] = await Promise.all([
        database.execute<{ total: number }>(sql`
          select count(distinct ${quotations.id})::integer as total
          from ${quotations}
          left join ${categories} on ${categories.id} = ${quotations.categoryId} and ${categories.active} = true
          left join ${quotationItems} on ${quotationItems.quotationId} = ${quotations.id}
          where ${where}
        `),
        database.execute<{ total: number }>(sql`
          select count(*)::integer as total from ${quotations} where ${scopeWhere()}
        `)
      ]);
      const total = filteredCountResult.rows[0]?.total ?? 0;
      const totalAvailable = availableCountResult.rows[0]?.total ?? 0;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const currentPage = Math.min(pageNumber, totalPages);
      const offset = (currentPage - 1) * pageSize;

      const [quotationResult, facetResult] = await Promise.all([
        database.execute<QuotationRow>(sql`
          select ${sql.raw('"quotations".*')}, ${categories.slug} as category_slug, ${categories.name} as category_name
          from ${quotations}
          left join ${categories} on ${categories.id} = ${quotations.categoryId} and ${categories.active} = true
          left join ${quotationItems} on ${quotationItems.quotationId} = ${quotations.id}
          where ${where}
          group by ${quotations.id}, ${categories.id}
          order by ${quotations.proposalDeadline} asc nulls last, ${quotations.id} desc
          limit ${pageSize} offset ${offset}
        `),
        database.execute<FacetRow>(sql`
          select distinct ${quotations.countyName} as city, ${categories.slug} as category_slug, ${categories.name} as category_name, ${quotations.expenseGroup} as expense_group, ${quotations.schoolName} as school
          from ${quotations}
          left join ${categories} on ${categories.id} = ${quotations.categoryId} and ${categories.active} = true
          left join ${quotationItems} on ${quotationItems.quotationId} = ${quotations.id}
          where ${where}
        `)
      ]);

      const children = await loadQuotationItems(database, quotationResult.rows.map((row) => row.id));
      return {
        data: quotationResult.rows.map((row) => normalizeQuotation(row, children.get(row.id) ?? [])),
        total,
        totalAvailable,
        page: currentPage,
        pageSize,
        totalPages,
        facets: buildFacets(facetResult.rows)
      };
    },

    async getOpportunity(externalId) {
      const cleanExternalId = externalId.trim();
      if (!cleanExternalId) return null;
      const result = await database.execute<QuotationRow>(sql`
        select ${sql.raw('"quotations".*')}, ${categories.slug} as category_slug, ${categories.name} as category_name
        from ${quotations}
        left join ${categories} on ${categories.id} = ${quotations.categoryId} and ${categories.active} = true
        where ${quotations.externalId} = ${cleanExternalId} and ${scopeWhere()}
        limit 1
      `);
      const row = result.rows[0];
      if (!row) return null;
      const children = await loadQuotationItems(database, [row.id]);
      return normalizeQuotation(row, children.get(row.id) ?? []);
    }
  };
}

function buildWhere(filters: OpportunityFilters) {
  const conditions: SQL[] = [scopeWhere()];
  const city = clean(filters.city);
  const category = clean(filters.category);
  const expenseGroup = clean(filters.expenseGroup);
  const school = clean(filters.school);
  const query = clean(filters.query);
  const situation = filters.situation === "closed" || filters.situation === "all" ? filters.situation : "open";
  if (city) {
    if (!rmbhCityNames.has(normalizeScopeCity(city))) conditions.push(sql`false`);
    else conditions.push(sql`lower(${quotations.countyName}) = lower(${city})`);
  }
  if (category) conditions.push(sql`lower(${categories.slug}) = lower(${category})`);
  if (expenseGroup) conditions.push(sql`lower(${quotations.expenseGroup}) = lower(${expenseGroup})`);
  if (school) conditions.push(sql`lower(${quotations.schoolName}) = lower(${school})`);
  if (situation === "open") conditions.push(sql`${quotations.proposalDeadline} >= now()`);
  if (situation === "closed") conditions.push(sql`(${quotations.proposalDeadline} is null or ${quotations.proposalDeadline} < now())`);
  addPeriodCondition(conditions, filters.periodStart, quotations.proposalDeadline, false, "after");
  addPeriodCondition(conditions, filters.periodEnd, quotations.proposalDeadline, true, "before");
  if (query) {
    conditions.push(sql`(
      strpos(lower(coalesce(${quotations.headline}, '')), lower(${query})) > 0
      or strpos(lower(coalesce(${quotations.summary}, '')), lower(${query})) > 0
      or strpos(lower(coalesce(${quotations.schoolName}, '')), lower(${query})) > 0
      or strpos(lower(coalesce(${quotations.countyName}, '')), lower(${query})) > 0
      or strpos(lower(coalesce(${quotations.expenseGroup}, '')), lower(${query})) > 0
      or strpos(lower(coalesce(${quotationItems.name}, '')), lower(${query})) > 0
      or strpos(lower(coalesce(${quotationItems.description}, '')), lower(${query})) > 0
    )`);
  }
  return sql.join(conditions, sql` and `);
}

function scopeWhere() {
  if (process.env.SCOPE_REGION?.trim().toLowerCase() === "all") return sql`true`;
  return sql`${quotations.idCounty} in (${sql.join(rmbhCountyIds.map((id) => sql`${id}`), sql`, `)})`;
}

function addPeriodCondition(conditions: SQL[], value: string | undefined, column: typeof quotations.proposalDeadline, endOfDay: boolean, direction: "after" | "before") {
  const cleanValue = clean(value);
  if (!cleanValue) return;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(cleanValue) ? new Date(`${cleanValue}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`) : null;
  if (!date || !Number.isFinite(date.getTime())) conditions.push(sql`false`);
  else conditions.push(direction === "after" ? sql`${column} >= ${date}` : sql`${column} <= ${date}`);
}

async function loadQuotationItems(database: QuotationDatabase, ids: number[]) {
  const map = new Map<number, OpportunityItem[]>();
  if (ids.length === 0) return map;
  const result = await database.execute<QuotationItemRow>(sql`
    select ${quotationItems.quotationId}, ${quotationItems.itemOrder}, ${quotationItems.name}, ${quotationItems.description}, ${quotationItems.unit}, ${quotationItems.quantity}, ${quotationItems.referenceValue}
    from ${quotationItems}
    where ${quotationItems.quotationId} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
    order by ${quotationItems.quotationId}, ${quotationItems.itemOrder}
  `);
  for (const row of result.rows) {
    const list = map.get(row.quotation_id) ?? [];
    list.push({
      order: row.item_order,
      name: row.name,
      description: row.description,
      unit: row.unit,
      quantity: row.quantity,
      unitValue: row.reference_value,
      totalValue: row.reference_value === null ? null : row.reference_value * row.quantity,
      isPermanent: false,
      expenseCategory: ""
    });
    map.set(row.quotation_id, list);
  }
  return map;
}

function normalizeQuotation(row: QuotationRow, items: OpportunityItem[]): NormalizedOpportunity {
  const proposalDeadline = toIso(row.proposal_deadline);
  const canSubmitProposal = proposalDeadline ? new Date(proposalDeadline).getTime() >= Date.now() : false;
  const hasReferenceValue = items.some((item) => item.unitValue !== null);
  return {
    kind: "quotation",
    externalId: row.external_id,
    orderId: row.nu_budget_order ?? row.external_id,
    sourceUrl: row.proposal_url,
    proposalUrl: row.proposal_url,
    canSubmitProposal,
    idSubprogram: row.id_subprogram,
    idSchool: row.id_school,
    idBudget: row.id_budget,
    idSupplier: null,
    school: row.school_name,
    city: row.county_name,
    regional: null,
    expenseGroup: row.expense_group,
    subprogram: "Não informado",
    year: "",
    purchaseDate: null,
    proposalDate: proposalDeadline,
    proposalDeadline,
    deliveryDate: toIso(row.delivery_date),
    purchaseOrderStatus: row.budget_status,
    accountabilityStatus: null,
    supplierName: null,
    supplierDocument: null,
    initiativeDescription: null,
    items,
    attachments: [],
    totalValue: hasReferenceValue ? row.total_reference_value : null,
    itemCount: row.item_count,
    category: row.category_slug && row.category_name ? { slug: row.category_slug, name: row.category_name, confidence: null, needsFallback: null } : null,
    headline: row.headline,
    summary: row.summary,
    topItems: strings(row.top_items),
    rawJson: row.raw_json,
    statusLabel: getQuotationStatus(row.proposal_deadline, row.collected_at)
  };
}

function buildFacets(rows: FacetRow[]) {
  const categoryMap = new Map<string, string>();
  for (const row of rows) if (row.category_slug && row.category_name) categoryMap.set(row.category_slug, row.category_name);
  return {
    cities: unique(rows.map((row) => row.city)),
    categories: [...categoryMap.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    expenseGroups: unique(rows.map((row) => row.expense_group)),
    schools: unique(rows.map((row) => row.school))
  };
}

function unique(values: Array<string | null>) {
  return [...new Set(values.map((value) => clean(value ?? undefined)).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function clean(value: string | undefined) {
  return value?.trim() || undefined;
}

function toIso(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeScopeCity(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
}

function sanitizePositiveInteger(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}
