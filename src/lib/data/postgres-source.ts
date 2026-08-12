import { sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type {
  NormalizedOpportunity,
  OpportunityAttachment,
  OpportunityItem
} from "@/lib/contracts/opportunity";
import {
  attachments,
  categories,
  items,
  opportunities,
  schools
} from "@/lib/db/schema";
import type {
  OpportunityFilters,
  OpportunitySource
} from "@/lib/data/source";
import type * as schema from "@/lib/db/schema";
import rmbhCounties from "@/lib/collector/rmbh-counties.json";

type OpportunityDatabase = NodePgDatabase<typeof schema>;

type OpportunityRow = {
  id: number;
  external_id: string;
  order_id: string;
  source_url: string;
  id_subprogram: number;
  id_school: number;
  id_budget: number;
  id_supplier: number | null;
  school: string;
  city: string | null;
  regional: string | null;
  expense_group: string;
  subprogram: string;
  year: string;
  purchase_date: Date | string | null;
  proposal_date: Date | string | null;
  delivery_date: Date | string | null;
  purchase_order_status: string | null;
  accountability_status: string | null;
  supplier_name: string | null;
  supplier_document: string | null;
  initiative_description: string | null;
  total_value: number | null;
  item_count: number;
  headline: string | null;
  summary: string | null;
  top_items: unknown;
  raw_json: unknown;
  school_name: string | null;
  school_city: string | null;
  school_regional: string | null;
  category_slug: string | null;
  category_name: string | null;
};

type ItemRow = {
  opportunity_id: number;
  item_order: number;
  name: string;
  description: string;
  unit: string;
  quantity: number;
  unit_value: number | null;
  total_value: number | null;
  is_permanent: boolean;
  expense_category: string;
};

type AttachmentRow = {
  opportunity_id: number;
  external_attachment_id: number;
  filename: string;
  thumb_url: string;
  url: string | null;
};

type FacetRow = {
  city: string | null;
  category_slug: string | null;
  category_name: string | null;
  expense_group: string;
  school: string | null;
};

const cityExpression = sql`coalesce(nullif(${opportunities.city}, ''), nullif(${schools.city}, ''))`;
const schoolExpression = sql`coalesce(nullif(${opportunities.school}, ''), nullif(${schools.name}, ''))`;
const rmbhCountyIds = rmbhCounties.counties.map((county) => county.idCounty);
const rmbhCityNamesForQuery = rmbhCounties.counties.map((county) => county.name);
const rmbhCityNames = new Set(
  rmbhCounties.counties.map((county) => normalizeScopeCity(county.name))
);

export function createPostgresOpportunitySource(
  database: OpportunityDatabase
): OpportunitySource {
  return {
    async listOpportunities(filters = {}, page = {}) {
      const pageNumber = sanitizePositiveInteger(page.page, 1);
      const pageSize = Math.min(48, sanitizePositiveInteger(page.pageSize, 12));
      const scope = getScopeRegion();
      const where = buildWhere(filters, scope);
      const scopeWhere = buildScopeWhere(scope);

      const [filteredCountResult, availableCountResult] = await Promise.all([
        database.execute<{ total: number }>(sql`
          select count(distinct ${opportunities.id})::integer as total
          from ${opportunities}
          left join ${schools} on ${schools.idSchool} = ${opportunities.idSchool}
          left join ${categories}
            on ${categories.id} = ${opportunities.categoryId}
           and ${categories.active} = true
          left join ${items} on ${items.opportunityId} = ${opportunities.id}
          where ${where}
        `),
        database.execute<{ total: number }>(sql`
          select count(*)::integer as total
          from ${opportunities}
          left join ${schools} on ${schools.idSchool} = ${opportunities.idSchool}
          where ${scopeWhere}
        `)
      ]);

      const total = filteredCountResult.rows[0]?.total ?? 0;
      const totalAvailable = availableCountResult.rows[0]?.total ?? 0;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const currentPage = Math.min(pageNumber, totalPages);
      const offset = (currentPage - 1) * pageSize;

      const [opportunityResult, facetResult] = await Promise.all([
        database.execute<OpportunityRow>(sql`
          select
            ${sql.raw('"opportunities".*')},
            ${schools.name} as school_name,
            ${schools.city} as school_city,
            ${schools.regional} as school_regional,
            ${categories.slug} as category_slug,
            ${categories.name} as category_name
          from ${opportunities}
          left join ${schools} on ${schools.idSchool} = ${opportunities.idSchool}
          left join ${categories}
            on ${categories.id} = ${opportunities.categoryId}
           and ${categories.active} = true
          left join ${items} on ${items.opportunityId} = ${opportunities.id}
          where ${where}
          group by ${opportunities.id}, ${schools.idSchool}, ${categories.id}
          order by ${opportunities.purchaseDate} desc nulls last, ${opportunities.id} desc
          limit ${pageSize}
          offset ${offset}
        `),
        database.execute<FacetRow>(sql`
          select distinct
            ${cityExpression} as city,
            ${categories.slug} as category_slug,
            ${categories.name} as category_name,
            ${opportunities.expenseGroup} as expense_group,
            ${schoolExpression} as school
          from ${opportunities}
          left join ${schools} on ${schools.idSchool} = ${opportunities.idSchool}
          left join ${categories}
            on ${categories.id} = ${opportunities.categoryId}
           and ${categories.active} = true
          left join ${items} on ${items.opportunityId} = ${opportunities.id}
          where ${where}
        `)
      ]);

      const children = await loadChildren(
        database,
        opportunityResult.rows.map((row) => row.id)
      );

      return {
        data: opportunityResult.rows.map((row) =>
          normalizeOpportunity(
            row,
            children.itemsByOpportunity.get(row.id) ?? [],
            children.attachmentsByOpportunity.get(row.id) ?? []
          )
        ),
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

      const result = await database.execute<OpportunityRow>(sql`
        select
          ${sql.raw('"opportunities".*')},
          ${schools.name} as school_name,
          ${schools.city} as school_city,
          ${schools.regional} as school_regional,
          ${categories.slug} as category_slug,
          ${categories.name} as category_name
        from ${opportunities}
        left join ${schools} on ${schools.idSchool} = ${opportunities.idSchool}
        left join ${categories}
          on ${categories.id} = ${opportunities.categoryId}
         and ${categories.active} = true
        where ${opportunities.externalId} = ${cleanExternalId}
          and ${buildScopeWhere(getScopeRegion())}
        limit 1
      `);
      const row = result.rows[0];
      if (!row) return null;

      const children = await loadChildren(database, [row.id]);
      return normalizeOpportunity(
        row,
        children.itemsByOpportunity.get(row.id) ?? [],
        children.attachmentsByOpportunity.get(row.id) ?? []
      );
    }
  };
}

export function sanitizePageParam(value: string | readonly string[] | undefined) {
  if (Array.isArray(value)) return 1;
  return sanitizePositiveInteger(value, 1);
}

function buildWhere(filters: OpportunityFilters, scope: ScopeRegion) {
  const conditions: SQL[] = [sql`true`];
  const city = cleanFilter(filters.city);
  const category = cleanFilter(filters.category);
  const expenseGroup = cleanFilter(filters.expenseGroup);
  const school = cleanFilter(filters.school);
  const query = cleanFilter(filters.query);

  conditions.push(buildScopeWhere(scope));
  if (city) {
    if (scope === "rmbh" && !rmbhCityNames.has(normalizeScopeCity(city))) {
      conditions.push(sql`false`);
    } else {
      conditions.push(sql`lower(${cityExpression}) = lower(${city})`);
    }
  }
  if (category) conditions.push(sql`lower(${categories.slug}) = lower(${category})`);
  if (expenseGroup) {
    conditions.push(
      sql`lower(${opportunities.expenseGroup}) = lower(${expenseGroup})`
    );
  }
  if (school) conditions.push(sql`lower(${schoolExpression}) = lower(${school})`);

  addPeriodCondition(
    conditions,
    filters.periodStart,
    opportunities.purchaseDate,
    false,
    "after"
  );
  addPeriodCondition(
    conditions,
    filters.periodEnd,
    opportunities.deliveryDate,
    true,
    "before"
  );

  if (query) {
    conditions.push(sql`(
      strpos(lower(coalesce(${opportunities.headline}, '')), lower(${query})) > 0
      or strpos(lower(coalesce(${opportunities.summary}, '')), lower(${query})) > 0
      or strpos(lower(coalesce(${opportunities.initiativeDescription}, '')), lower(${query})) > 0
      or strpos(lower(coalesce(${opportunities.school}, '')), lower(${query})) > 0
      or strpos(lower(coalesce(${opportunities.city}, ${schools.city}, '')), lower(${query})) > 0
      or strpos(lower(coalesce(${opportunities.expenseGroup}, '')), lower(${query})) > 0
      or strpos(lower(coalesce(${opportunities.supplierName}, '')), lower(${query})) > 0
      or strpos(lower(coalesce(${items.name}, '')), lower(${query})) > 0
      or strpos(lower(coalesce(${items.description}, '')), lower(${query})) > 0
    )`);
  }

  return sql.join(conditions, sql` and `);
}

type ScopeRegion = "all" | "rmbh";

function getScopeRegion(): ScopeRegion {
  return process.env.SCOPE_REGION?.trim().toLowerCase() === "all" ? "all" : "rmbh";
}

function buildScopeWhere(scope: ScopeRegion): SQL {
  if (scope === "all") return sql`true`;

  const countyIds = sql.join(rmbhCountyIds.map((id) => sql`${id}`), sql`, `);
  const cityNames = sql.join(
    rmbhCityNamesForQuery.map((name) => sql`lower(${name})`),
    sql`, `
  );
  return sql`(
    ${schools.idCounty} in (${countyIds})
    or lower(${cityExpression}) in (${cityNames})
  )`;
}

function normalizeScopeCity(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function addPeriodCondition(
  conditions: SQL[],
  value: string | undefined,
  column: typeof opportunities.purchaseDate | typeof opportunities.deliveryDate,
  endOfDay: boolean,
  direction: "after" | "before"
) {
  const cleanValue = cleanFilter(value);
  if (!cleanValue) return;

  const boundary = parseDateBoundary(cleanValue, endOfDay);
  if (!boundary) {
    conditions.push(sql`false`);
    return;
  }

  conditions.push(
    direction === "after"
      ? sql`${column} >= ${boundary}`
      : sql`${column} <= ${boundary}`
  );
}

function parseDateBoundary(value: string, endOfDay: boolean) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (!Number.isFinite(date.getTime()) || !date.toISOString().startsWith(value)) {
    return null;
  }

  return date;
}

async function loadChildren(database: OpportunityDatabase, opportunityIds: number[]) {
  const itemsByOpportunity = new Map<number, OpportunityItem[]>();
  const attachmentsByOpportunity = new Map<number, OpportunityAttachment[]>();
  if (opportunityIds.length === 0) {
    return { itemsByOpportunity, attachmentsByOpportunity };
  }

  const idList = sql.join(opportunityIds.map((id) => sql`${id}`), sql`, `);
  const [itemResult, attachmentResult] = await Promise.all([
    database.execute<ItemRow>(sql`
      select
        ${items.opportunityId},
        ${items.itemOrder},
        ${items.name},
        ${items.description},
        ${items.unit},
        ${items.quantity},
        ${items.unitValue},
        ${items.totalValue},
        ${items.isPermanent},
        ${items.expenseCategory}
      from ${items}
      where ${items.opportunityId} in (${idList})
      order by ${items.opportunityId}, ${items.itemOrder}
    `),
    database.execute<AttachmentRow>(sql`
      select
        ${attachments.opportunityId},
        ${attachments.externalAttachmentId},
        ${attachments.filename},
        ${attachments.thumbUrl},
        ${attachments.url}
      from ${attachments}
      where ${attachments.opportunityId} in (${idList})
      order by ${attachments.opportunityId}, ${attachments.externalAttachmentId}
    `)
  ]);

  for (const row of itemResult.rows) {
    const opportunityItems = itemsByOpportunity.get(row.opportunity_id) ?? [];
    opportunityItems.push({
      order: row.item_order,
      name: row.name,
      description: row.description,
      unit: row.unit,
      quantity: row.quantity,
      unitValue: row.unit_value,
      totalValue: row.total_value,
      isPermanent: row.is_permanent,
      expenseCategory: row.expense_category
    });
    itemsByOpportunity.set(row.opportunity_id, opportunityItems);
  }

  for (const row of attachmentResult.rows) {
    const opportunityAttachments =
      attachmentsByOpportunity.get(row.opportunity_id) ?? [];
    opportunityAttachments.push({
      id: row.external_attachment_id,
      filename: row.filename,
      thumbUrl: row.thumb_url,
      url: row.url
    });
    attachmentsByOpportunity.set(row.opportunity_id, opportunityAttachments);
  }

  return { itemsByOpportunity, attachmentsByOpportunity };
}

function normalizeOpportunity(
  row: OpportunityRow,
  opportunityItems: OpportunityItem[],
  opportunityAttachments: OpportunityAttachment[]
): NormalizedOpportunity {
  const category =
    row.category_slug && row.category_name
      ? {
          slug: row.category_slug,
          name: row.category_name,
          confidence: null,
          needsFallback: null
        }
      : null;

  return {
    externalId: row.external_id,
    orderId: row.order_id,
    sourceUrl: row.source_url,
    idSubprogram: row.id_subprogram,
    idSchool: row.id_school,
    idBudget: row.id_budget,
    idSupplier: row.id_supplier,
    school: firstText(row.school, row.school_name) ?? "Não informado",
    city: firstText(row.city, row.school_city),
    regional: firstText(row.regional, row.school_regional),
    expenseGroup: row.expense_group,
    subprogram: row.subprogram,
    year: row.year,
    purchaseDate: toIsoString(row.purchase_date),
    proposalDate: toIsoString(row.proposal_date),
    deliveryDate: toIsoString(row.delivery_date),
    purchaseOrderStatus: row.purchase_order_status,
    accountabilityStatus: row.accountability_status,
    supplierName: row.supplier_name,
    supplierDocument: row.supplier_document,
    initiativeDescription: row.initiative_description,
    items: opportunityItems,
    attachments: opportunityAttachments,
    totalValue: row.total_value,
    itemCount: row.item_count,
    category,
    headline:
      firstText(row.headline, row.category_name) ?? "Não informado",
    summary:
      firstText(row.summary, row.initiative_description) ?? "Não informado",
    topItems: stringArray(row.top_items),
    rawJson: row.raw_json
  };
}

function buildFacets(rows: FacetRow[]) {
  const categoryMap = new Map<string, string>();
  for (const row of rows) {
    if (row.category_slug && row.category_name) {
      categoryMap.set(row.category_slug, row.category_name);
    }
  }

  return {
    cities: uniqueSorted(rows.map((row) => row.city)),
    categories: [...categoryMap.entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
    expenseGroups: uniqueSorted(rows.map((row) => row.expense_group)),
    schools: uniqueSorted(rows.map((row) => row.school))
  };
}

function uniqueSorted(values: Array<string | null>) {
  return [
    ...new Set(
      values.map(cleanFilter).filter((value): value is string => Boolean(value))
    )
  ].sort((left, right) => left.localeCompare(right, "pt-BR"));
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function firstText(...values: Array<string | null>) {
  for (const value of values) {
    const cleanValue = cleanFilter(value ?? undefined);
    if (cleanValue) return cleanValue;
  }
  return null;
}

function cleanFilter(value: string | null | undefined) {
  const cleanValue = value?.trim();
  return cleanValue || undefined;
}

function toIsoString(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function sanitizePositiveInteger(value: unknown, fallback: number) {
  const numericValue =
    typeof value === "string" && value.trim() !== ""
      ? Number(value.trim())
      : value;

  if (
    typeof numericValue !== "number" ||
    !Number.isInteger(numericValue) ||
    numericValue < 1
  ) {
    return fallback;
  }

  return numericValue;
}
