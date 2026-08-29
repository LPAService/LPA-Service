import { sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import rmbhCounties from "@/lib/collector/rmbh-counties.json";
import { items, opportunities, quotations, schools } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";

type AnalyticsDatabase = NodePgDatabase<typeof schema>;

export type LossReason = {
  reason: "bloqueada" | "prazo_inviavel" | "reserva_pnae" | "incumbente" | "preco";
  count: number;
  pct: number;
  medianGap: number | null;
  explanation: string;
};

export type WinnerPlaybookEntry = {
  supplierName: string;
  supplierDocument: string;
  orders: number;
  totalValue: number;
  schools: number;
  expenseGroups: number;
  topGroup: string;
  medianTicket: number;
  isCooperative: boolean;
};

export type PriceBenchmark = {
  product: string;
  unit: string;
  samples: number;
  supplierCount: number;
  minPrice: number;
  p25: number;
  median: number;
  p75: number;
  maxPrice: number;
  spreadRatio: number;
};

export type CategoryCompetition = {
  expenseGroup: string;
  orders: number;
  supplierCount: number;
  leaderSharePct: number;
  medianTicket: number;
  p25Ticket: number;
  p75Ticket: number;
  competitionLevel: "alta" | "media" | "baixa";
};

export type IncumbencyMapEntry = {
  school: string;
  idSchool: number;
  city: string | null;
  leaderSupplier: string;
  leaderOrders: number;
  totalOrders: number;
  leaderSharePct: number;
};

export type WinnerDiscountGroup = {
  expenseGroup: string;
  pairs: number;
  sanitizedPairs: number;
  medianRatio: number | null;
  sanitizedMedianDiscountPct: number | null;
};

export type WinnerDiscount = {
  pairs: number;
  medianRatio: number | null;
  belowRefCount: number;
  sanitizedPairs: number;
  sanitizedMedianDiscountPct: number | null;
  byGroup: WinnerDiscountGroup[];
};

type LossReasonRow = {
  reason: LossReason["reason"];
  count: number;
  pct: number;
  median_gap: number | null;
};

type WinnerPlaybookRow = {
  supplier_name: string | null;
  supplier_document: string | null;
  orders: number;
  total_value: number | null;
  schools: number;
  expense_groups: number;
  top_group: string | null;
  median_ticket: number | null;
  is_cooperative: boolean;
};

type PriceBenchmarkRow = {
  product: string;
  unit: string;
  samples: number;
  supplier_count: number;
  min_price: number;
  p25: number;
  median: number;
  p75: number;
  max_price: number;
  spread_ratio: number | null;
};

type CategoryCompetitionRow = {
  expense_group: string;
  orders: number;
  supplier_count: number;
  leader_share_pct: number;
  median_ticket: number;
  p25_ticket: number;
  p75_ticket: number;
  competition_level: CategoryCompetition["competitionLevel"];
};

type IncumbencyMapRow = {
  school: string | null;
  id_school: number;
  city: string | null;
  leader_supplier: string | null;
  leader_orders: number;
  total_orders: number;
  leader_share_pct: number;
};

type WinnerDiscountSummaryRow = {
  pairs: number;
  median_ratio: number | null;
  below_ref_count: number;
  sanitized_pairs: number;
  sanitized_median_discount_pct: number | null;
};

type WinnerDiscountGroupRow = {
  expense_group: string;
  pairs: number;
  sanitized_pairs: number;
  median_ratio: number | null;
  sanitized_median_discount_pct: number | null;
};

const rmbhCountyIds = rmbhCounties.counties.map((county) => county.idCounty);
const rmbhCityNamesForQuery = rmbhCounties.counties.map((county) => county.name);
const cityExpression = sql`coalesce(nullif(${opportunities.city}, ''), nullif(${schools.city}, ''))`;

export function createCompetitiveAnalytics(database: AnalyticsDatabase) {
  return {
    async getLossReasons(): Promise<LossReason[]> {
      const result = await database.execute<LossReasonRow>(sql`
        with matched as (
          select
            ${quotations.id} as quotation_id,
            ${opportunities.idSchool} as id_school,
            ${quotations.proposalBlocked} as proposal_blocked,
            ${quotations.deliveryDate} as quotation_delivery_date,
            ${opportunities.proposalDate} as proposal_date,
            ${opportunities.purchaseDate} as purchase_date,
            ${opportunities.expenseGroup} as expense_group,
            ${opportunities.supplierName} as supplier_name,
            ${opportunities.supplierDocument} as supplier_document,
            ${opportunities.totalValue} as winner_value,
            ${quotations.totalReferenceValue} as reference_value,
            case
              when ${quotations.totalReferenceValue} is not null and ${quotations.totalReferenceValue} > 0 and ${opportunities.totalValue} is not null
                then ((${quotations.totalReferenceValue} - ${opportunities.totalValue}) / ${quotations.totalReferenceValue}) * 100
              else null
            end as gap_pct
          from ${quotations}
          join ${opportunities}
            on ${opportunities.idSubprogram} = ${quotations.idSubprogram}
           and ${opportunities.idSchool} = ${quotations.idSchool}
           and ${opportunities.idBudget} = ${quotations.idBudget}
          left join ${schools} on ${schools.idSchool} = ${opportunities.idSchool}
          where ${quotationScopeWhere()}
            and ${opportunityScopeWhere()}
        ),
        classified as (
          select
            case
              when proposal_blocked = true then 'bloqueada'
              when quotation_delivery_date is not null and proposal_date is not null and (
                quotation_delivery_date::date = proposal_date::date
                or quotation_delivery_date < proposal_date + interval '48 hours'
              ) then 'prazo_inviavel'
              when expense_group = 'Gêneros Alimentícios'
                and supplier_name ~* 'cooperativ|associa|agricultur|familiar' then 'reserva_pnae'
              when exists (
                select 1
                from ${opportunities} previous
                where previous.id_school = matched.id_school
                  and previous.expense_group = matched.expense_group
                  and previous.supplier_document = matched.supplier_document
                  and previous.purchase_date < matched.purchase_date
              ) then 'incumbente'
              else 'preco'
            end as reason,
            gap_pct
          from matched
        ),
        totals as (
          select count(*)::integer as total from classified
        )
        select
          reason,
          count(*)::integer as count,
          round((count(*)::numeric / nullif((select total from totals), 0)) * 100, 1)::double precision as pct,
          percentile_cont(0.5) within group (order by gap_pct)::double precision as median_gap
        from classified
        group by reason
        order by count desc
      `);
      return result.rows.map(normalizeLossReason);
    },

    async getWinnerPlaybook(limit = 12): Promise<WinnerPlaybookEntry[]> {
      const safeLimit = sanitizePositiveInteger(limit, 12);
      const result = await database.execute<WinnerPlaybookRow>(sql`
        with scoped as (
          select ${sql.raw('"opportunities".*')}
          from ${opportunities}
          left join ${schools} on ${schools.idSchool} = ${opportunities.idSchool}
          where ${opportunityScopeWhere()}
            and ${opportunities.supplierName} is not null
            and ${opportunities.supplierDocument} is not null
        ),
        supplier_groups as (
          select
            supplier_document,
            expense_group,
            count(*)::integer as group_orders,
            row_number() over (partition by supplier_document order by count(*) desc, expense_group asc) as rank
          from scoped
          group by supplier_document, expense_group
        )
        select
          scoped.supplier_name,
          scoped.supplier_document,
          count(*)::integer as orders,
          coalesce(sum(scoped.total_value), 0)::double precision as total_value,
          count(distinct scoped.id_school)::integer as schools,
          count(distinct scoped.expense_group)::integer as expense_groups,
          coalesce(max(supplier_groups.expense_group), 'Não informado') as top_group,
          percentile_cont(0.5) within group (order by scoped.total_value)::double precision as median_ticket,
          (scoped.supplier_name ~* 'cooperativ|associa|agricultur|familiar') as is_cooperative
        from scoped
        left join supplier_groups
          on supplier_groups.supplier_document = scoped.supplier_document
         and supplier_groups.rank = 1
        group by scoped.supplier_name, scoped.supplier_document
        order by orders desc, total_value desc
        limit ${safeLimit}
      `);
      return result.rows.map(normalizeWinnerPlaybook);
    },

    async getPriceBenchmark(limit = 20): Promise<PriceBenchmark[]> {
      const safeLimit = sanitizePositiveInteger(limit, 20);
      const result = await database.execute<PriceBenchmarkRow>(sql`
        select
          lower(regexp_replace(trim(${items.name}), '\\s+', ' ', 'g')) as product,
          upper(trim(${items.unit})) as unit,
          count(*)::integer as samples,
          count(distinct ${opportunities.supplierDocument})::integer as supplier_count,
          min(${items.unitValue})::double precision as min_price,
          percentile_cont(0.25) within group (order by ${items.unitValue})::double precision as p25,
          percentile_cont(0.5) within group (order by ${items.unitValue})::double precision as median,
          percentile_cont(0.75) within group (order by ${items.unitValue})::double precision as p75,
          max(${items.unitValue})::double precision as max_price,
          (percentile_cont(0.5) within group (order by ${items.unitValue}) / nullif(min(${items.unitValue}), 0))::double precision as spread_ratio
        from ${items}
        join ${opportunities} on ${opportunities.id} = ${items.opportunityId}
        left join ${schools} on ${schools.idSchool} = ${opportunities.idSchool}
        where ${items.unitValue} is not null
          and ${items.unitValue} > 0
          and ${opportunityScopeWhere()}
        group by product, unit
        having count(*) >= 30
        order by samples desc, product asc
        limit ${safeLimit}
      `);
      return result.rows.map(normalizePriceBenchmark);
    },

    async getCategoryCompetition(): Promise<CategoryCompetition[]> {
      const result = await database.execute<CategoryCompetitionRow>(sql`
        with grouped as (
          select
            ${opportunities.expenseGroup} as expense_group,
            ${opportunities.supplierDocument} as supplier_document,
            count(*)::integer as supplier_orders
          from ${opportunities}
          left join ${schools} on ${schools.idSchool} = ${opportunities.idSchool}
          where ${opportunityScopeWhere()}
            and ${opportunities.supplierDocument} is not null
          group by ${opportunities.expenseGroup}, ${opportunities.supplierDocument}
        ),
        category as (
          select
            ${opportunities.expenseGroup} as expense_group,
            count(*)::integer as orders,
            count(distinct ${opportunities.supplierDocument})::integer as supplier_count,
            percentile_cont(0.25) within group (order by ${opportunities.totalValue})::double precision as p25_ticket,
            percentile_cont(0.5) within group (order by ${opportunities.totalValue})::double precision as median_ticket,
            percentile_cont(0.75) within group (order by ${opportunities.totalValue})::double precision as p75_ticket
          from ${opportunities}
          left join ${schools} on ${schools.idSchool} = ${opportunities.idSchool}
          where ${opportunityScopeWhere()}
            and ${opportunities.supplierDocument} is not null
          group by ${opportunities.expenseGroup}
        )
        select
          category.expense_group,
          category.orders,
          category.supplier_count,
          round((max(grouped.supplier_orders)::numeric / category.orders) * 100, 1)::double precision as leader_share_pct,
          category.median_ticket,
          category.p25_ticket,
          category.p75_ticket,
          case
            when (max(grouped.supplier_orders)::numeric / category.orders) * 100 < 5 then 'alta'
            when (max(grouped.supplier_orders)::numeric / category.orders) * 100 <= 12 then 'media'
            else 'baixa'
          end as competition_level
        from category
        join grouped on grouped.expense_group = category.expense_group
        group by category.expense_group, category.orders, category.supplier_count, category.median_ticket, category.p25_ticket, category.p75_ticket
        order by category.orders desc, category.expense_group asc
      `);
      return result.rows.map(normalizeCategoryCompetition);
    },

    async getIncumbencyMap(limit = 15): Promise<IncumbencyMapEntry[]> {
      const safeLimit = sanitizePositiveInteger(limit, 15);
      const result = await database.execute<IncumbencyMapRow>(sql`
        with school_totals as (
          select
            ${opportunities.idSchool} as id_school,
            coalesce(nullif(${opportunities.school}, ''), nullif(${schools.name}, '')) as school,
            ${cityExpression} as city,
            count(*)::integer as total_orders
          from ${opportunities}
          left join ${schools} on ${schools.idSchool} = ${opportunities.idSchool}
          where ${opportunityScopeWhere()}
            and ${opportunities.supplierName} is not null
          group by ${opportunities.idSchool}, school, city
          having count(*) >= 5
        ),
        supplier_orders as (
          select
            ${opportunities.idSchool} as id_school,
            ${opportunities.supplierName} as leader_supplier,
            count(*)::integer as leader_orders,
            row_number() over (
              partition by ${opportunities.idSchool}
              order by count(*) desc, ${opportunities.supplierName} asc
            ) as rank
          from ${opportunities}
          left join ${schools} on ${schools.idSchool} = ${opportunities.idSchool}
          where ${opportunityScopeWhere()}
            and ${opportunities.supplierName} is not null
          group by ${opportunities.idSchool}, ${opportunities.supplierName}
        )
        select
          school_totals.school,
          school_totals.id_school,
          school_totals.city,
          supplier_orders.leader_supplier,
          supplier_orders.leader_orders,
          school_totals.total_orders,
          round((supplier_orders.leader_orders::numeric / school_totals.total_orders) * 100, 1)::double precision as leader_share_pct
        from school_totals
        join supplier_orders
          on supplier_orders.id_school = school_totals.id_school
         and supplier_orders.rank = 1
        order by leader_share_pct desc, school_totals.total_orders desc
        limit ${safeLimit}
      `);
      return result.rows.map(normalizeIncumbencyMap);
    },

    async getWinnerDiscount(): Promise<WinnerDiscount> {
      const pairs = winnerDiscountPairsSql();
      const [summaryResult, groupResult] = await Promise.all([
        database.execute<WinnerDiscountSummaryRow>(sql`
          with pairs as (${pairs})
          select
            count(*)::integer as pairs,
            percentile_cont(0.5) within group (order by ratio)::double precision as median_ratio,
            count(*) filter (where ratio < 1)::integer as below_ref_count,
            count(*) filter (where ratio between 0.3 and 1.0)::integer as sanitized_pairs,
            (100 - percentile_cont(0.5) within group (order by ratio) filter (where ratio between 0.3 and 1.0) * 100)::double precision as sanitized_median_discount_pct
          from pairs
        `),
        database.execute<WinnerDiscountGroupRow>(sql`
          with pairs as (${pairs})
          select
            expense_group,
            count(*)::integer as pairs,
            count(*) filter (where ratio between 0.3 and 1.0)::integer as sanitized_pairs,
            percentile_cont(0.5) within group (order by ratio)::double precision as median_ratio,
            (100 - percentile_cont(0.5) within group (order by ratio) filter (where ratio between 0.3 and 1.0) * 100)::double precision as sanitized_median_discount_pct
          from pairs
          group by expense_group
          order by sanitized_pairs desc, pairs desc, expense_group asc
        `)
      ]);
      return normalizeWinnerDiscount(summaryResult.rows[0], groupResult.rows);
    }
  };
}

function winnerDiscountPairsSql(): SQL {
  return sql`
    select
      ${opportunities.expenseGroup} as expense_group,
      (${items.unitValue} / ${quotationItemsReferenceValue()})::double precision as ratio
    from ${items}
    join ${opportunities} on ${opportunities.id} = ${items.opportunityId}
    join ${quotations}
      on ${quotations.idSubprogram} = ${opportunities.idSubprogram}
     and ${quotations.idSchool} = ${opportunities.idSchool}
     and ${quotations.idBudget} = ${opportunities.idBudget}
    join quotation_items qi
      on qi.quotation_id = ${quotations.id}
     and qi.item_order = ${items.itemOrder}
    left join ${schools} on ${schools.idSchool} = ${opportunities.idSchool}
    where ${items.unitValue} is not null
      and ${items.unitValue} > 0
      and qi.reference_value is not null
      and qi.quantity > 0
      and (qi.reference_value / qi.quantity) > 0
      and ${quotationScopeWhere()}
      and ${opportunityScopeWhere()}
  `;
}

function quotationItemsReferenceValue(): SQL {
  return sql.raw("(qi.reference_value / qi.quantity)");
}

function opportunityScopeWhere(): SQL {
  if (process.env.SCOPE_REGION?.trim().toLowerCase() === "all") return sql`true`;

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

function quotationScopeWhere(): SQL {
  if (process.env.SCOPE_REGION?.trim().toLowerCase() === "all") return sql`true`;
  return sql`${quotations.idCounty} in (${sql.join(rmbhCountyIds.map((id) => sql`${id}`), sql`, `)})`;
}

function normalizeLossReason(row: LossReasonRow): LossReason {
  return {
    reason: row.reason,
    count: row.count,
    pct: finiteNumber(row.pct),
    medianGap: nullableFiniteNumber(row.median_gap),
    explanation: lossReasonExplanation(row.reason)
  };
}

function normalizeWinnerPlaybook(row: WinnerPlaybookRow): WinnerPlaybookEntry {
  return {
    supplierName: row.supplier_name ?? "Não informado",
    supplierDocument: row.supplier_document ?? "",
    orders: row.orders,
    totalValue: finiteNumber(row.total_value),
    schools: row.schools,
    expenseGroups: row.expense_groups,
    topGroup: row.top_group ?? "Não informado",
    medianTicket: finiteNumber(row.median_ticket),
    isCooperative: row.is_cooperative
  };
}

function normalizePriceBenchmark(row: PriceBenchmarkRow): PriceBenchmark {
  return {
    product: row.product,
    unit: row.unit,
    samples: row.samples,
    supplierCount: row.supplier_count,
    minPrice: finiteNumber(row.min_price),
    p25: finiteNumber(row.p25),
    median: finiteNumber(row.median),
    p75: finiteNumber(row.p75),
    maxPrice: finiteNumber(row.max_price),
    spreadRatio: finiteNumber(row.spread_ratio)
  };
}

function normalizeCategoryCompetition(row: CategoryCompetitionRow): CategoryCompetition {
  return {
    expenseGroup: row.expense_group,
    orders: row.orders,
    supplierCount: row.supplier_count,
    leaderSharePct: finiteNumber(row.leader_share_pct),
    medianTicket: finiteNumber(row.median_ticket),
    p25Ticket: finiteNumber(row.p25_ticket),
    p75Ticket: finiteNumber(row.p75_ticket),
    competitionLevel: row.competition_level
  };
}

function normalizeIncumbencyMap(row: IncumbencyMapRow): IncumbencyMapEntry {
  return {
    school: row.school ?? "Não informado",
    idSchool: row.id_school,
    city: row.city,
    leaderSupplier: row.leader_supplier ?? "Não informado",
    leaderOrders: row.leader_orders,
    totalOrders: row.total_orders,
    leaderSharePct: finiteNumber(row.leader_share_pct)
  };
}

function normalizeWinnerDiscount(
  summary: WinnerDiscountSummaryRow | undefined,
  groups: WinnerDiscountGroupRow[]
): WinnerDiscount {
  return {
    pairs: summary?.pairs ?? 0,
    medianRatio: nullableFiniteNumber(summary?.median_ratio ?? null),
    belowRefCount: summary?.below_ref_count ?? 0,
    sanitizedPairs: summary?.sanitized_pairs ?? 0,
    sanitizedMedianDiscountPct: nullableFiniteNumber(summary?.sanitized_median_discount_pct ?? null),
    byGroup: groups.map((row) => ({
      expenseGroup: row.expense_group,
      pairs: row.pairs,
      sanitizedPairs: row.sanitized_pairs,
      medianRatio: nullableFiniteNumber(row.median_ratio),
      sanitizedMedianDiscountPct: nullableFiniteNumber(row.sanitized_median_discount_pct)
    }))
  };
}

function lossReasonExplanation(reason: LossReason["reason"]) {
  const explanations: Record<LossReason["reason"], string> = {
    bloqueada: "Portal bloqueou envio de proposta.",
    prazo_inviavel: "Entrega no mesmo dia da proposta ou em menos de 48h.",
    reserva_pnae: "Gêneros alimentícios vencidos por perfil cooperativa/agricultura familiar.",
    incumbente: "Escola já tinha histórico com o mesmo fornecedor no grupo.",
    preco: "Vencedor ficou abaixo da referência disponível."
  };
  return explanations[reason];
}

function sanitizePositiveInteger(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function finiteNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function nullableFiniteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
