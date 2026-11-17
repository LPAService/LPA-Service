import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  schools,
  quotations,
  opportunities,
  userSchoolFavorites,
} from "@/lib/db/schema";
import rmbhCounties from "@/lib/collector/rmbh-counties.json";

const rmbhCountyIds = rmbhCounties.counties.map((c) => c.idCounty);

export const INT4_MAX = 2_147_483_647;

export type SchoolWithCounts = {
  idSchool: number;
  name: string;
  city: string | null;
  regional: string | null;
  openQuotations: number;
  totalQuotations: number;
  totalOpportunities: number;
  isFavorite: boolean;
};

export type SchoolDetail = SchoolWithCounts;

type SchoolListRow = {
  id_school: number;
  name: string;
  city: string | null;
  regional: string | null;
  open_quotations: number;
  total_quotations: number;
  total_opportunities: number;
  is_favorite: boolean;
};

/**
 * List schools scoped to the RMBH counties the app covers, with quotation/opportunity counts.
 * "Em aberto" = quotation where proposalDeadline >= now() AND noLongerListedAt IS NULL.
 * With `favoritesOnly`, returns only the schools favorited by `userId` (empty if no valid user).
 */
export async function listSchools(filters?: {
  city?: string;
  query?: string;
  userId?: number | null;
  favoritesOnly?: boolean;
}): Promise<SchoolWithCounts[]> {
  const userId = validUserId(filters?.userId);
  if (filters?.favoritesOnly && userId === null) return [];

  const conditions = [scopeWhere()];

  if (filters?.favoritesOnly && userId !== null) {
    conditions.push(favoriteSql(userId));
  }

  if (filters?.city?.trim()) {
    conditions.push(
      sql`lower(s.city) = lower(${filters.city.trim()})`
    );
  }

  if (filters?.query?.trim()) {
    conditions.push(
      sql`strpos(lower(s.name), lower(${filters.query.trim()})) > 0`
    );
  }

  const where = sql.join(conditions, sql` and `);

  const result = await db.execute<SchoolListRow>(sql`
    select
      s.id_school,
      s.name,
      s.city,
      s.regional,
      coalesce(oq.open_quotations, 0)::integer as open_quotations,
      coalesce(tq.total_quotations, 0)::integer as total_quotations,
      coalesce(topp.total_opportunities, 0)::integer as total_opportunities,
      ${favoriteSql(userId)} as is_favorite
    from ${schools} s
    left join lateral (
      select count(*)::integer as open_quotations
      from ${quotations} q
      where q.id_school = s.id_school
        and q.proposal_deadline >= now()
        and q.no_longer_listed_at is null
    ) oq on true
    left join lateral (
      select count(*)::integer as total_quotations
      from ${quotations} q2
      where q2.id_school = s.id_school
    ) tq on true
    left join lateral (
      select count(*)::integer as total_opportunities
      from ${opportunities} o
      where o.id_school = s.id_school
    ) topp on true
    where ${where}
    order by oq.open_quotations desc, tq.total_quotations desc, s.name asc
  `);

  return result.rows.map(mapSchoolRow);
}

/**
 * Get a single school with its counts.
 * `userId` (optional) is used only to compute `isFavorite`.
 */
export async function getSchool(
  idSchool: number,
  userId?: number | null
): Promise<SchoolDetail | null> {
  if (!isValidId(idSchool)) return null;
  const result = await db.execute<SchoolListRow>(sql`
    select
      s.id_school,
      s.name,
      s.city,
      s.regional,
      coalesce(oq.open_quotations, 0)::integer as open_quotations,
      coalesce(tq.total_quotations, 0)::integer as total_quotations,
      coalesce(topp.total_opportunities, 0)::integer as total_opportunities,
      ${favoriteSql(validUserId(userId))} as is_favorite
    from ${schools} s
    left join lateral (
      select count(*)::integer as open_quotations
      from ${quotations} q
      where q.id_school = s.id_school
        and q.proposal_deadline >= now()
        and q.no_longer_listed_at is null
    ) oq on true
    left join lateral (
      select count(*)::integer as total_quotations
      from ${quotations} q2
      where q2.id_school = s.id_school
    ) tq on true
    left join lateral (
      select count(*)::integer as total_opportunities
      from ${opportunities} o
      where o.id_school = s.id_school
    ) topp on true
    where s.id_school = ${idSchool}
    limit 1
  `);

  const row = result.rows[0];
  if (!row) return null;
  return mapSchoolRow(row);
}

export type FavoriteResult =
  | { ok: true; isFavorite: boolean }
  | {
      ok: false;
      reason:
        | "invalid_user"
        | "user_not_found"
        | "invalid_school"
        | "school_not_found"
        | "out_of_scope";
    };

/**
 * Mark or unmark a school as favorite for a user. Idempotent: favoriting twice keeps one row.
 * Only the given user's rows are touched. Only schools in the RMBH scope (same filter as the
 * list) can be favorited; anything else is refused without writing.
 */
export async function setSchoolFavorite(
  userId: number,
  idSchool: number,
  favorite: boolean
): Promise<FavoriteResult> {
  if (!isValidId(userId)) return { ok: false, reason: "invalid_user" };
  if (!isValidId(idSchool)) return { ok: false, reason: "invalid_school" };

  const found = await db.execute<{ in_scope: boolean }>(sql`
    select ${scopeWhere()} as in_scope
    from ${schools} s
    where s.id_school = ${idSchool}
    limit 1
  `);
  const row = found.rows[0];
  if (!row) return { ok: false, reason: "school_not_found" };
  if (row.in_scope !== true) return { ok: false, reason: "out_of_scope" };

  if (favorite) {
    try {
      await db
        .insert(userSchoolFavorites)
        .values({ userId, idSchool })
        .onConflictDoNothing({
          target: [userSchoolFavorites.userId, userSchoolFavorites.idSchool],
        });
    } catch (error) {
      // Session points to a user that no longer exists: refuse, do not throw.
      if (pgErrorCode(error) === FOREIGN_KEY_VIOLATION) {
        return { ok: false, reason: "user_not_found" };
      }
      throw error;
    }
  } else {
    await db
      .delete(userSchoolFavorites)
      .where(
        and(
          eq(userSchoolFavorites.userId, userId),
          eq(userSchoolFavorites.idSchool, idSchool)
        )
      );
  }

  return { ok: true, isFavorite: favorite };
}

/** How many RMBH-scope schools this user has favorited (same scope as the list). */
export async function countFavoriteSchools(
  userId: number | null | undefined
): Promise<number> {
  const id = validUserId(userId);
  if (id === null) return 0;
  const result = await db.execute<{ total: number }>(sql`
    select count(*)::integer as total
    from ${userSchoolFavorites} f
    join ${schools} s on s.id_school = f.id_school
    where f.user_id = ${id} and ${scopeWhere()}
  `);
  return result.rows[0]?.total ?? 0;
}

export type SchoolQuotationRow = {
  id: number;
  external_id: string;
  nu_budget_order: string | null;
  school_name: string;
  county_name: string | null;
  expense_group: string;
  headline: string;
  summary: string;
  proposal_deadline: Date | string | null;
  delivery_date: Date | string | null;
  item_count: number;
  total_reference_value: number | null;
  proposal_blocked: boolean;
  no_longer_listed_at: Date | string | null;
  collected_at: Date | string | null;
  category_name: string | null;
};

/**
 * Get quotations for a school, split into open and closed.
 */
export async function getSchoolQuotations(idSchool: number) {
  if (!Number.isInteger(idSchool) || idSchool <= 0 || idSchool > INT4_MAX) return [];
  const result = await db.execute<SchoolQuotationRow>(sql`
    select
      q.id,
      q.external_id,
      q.nu_budget_order,
      q.school_name,
      q.county_name,
      q.expense_group,
      q.headline,
      q.summary,
      q.proposal_deadline,
      q.delivery_date,
      q.item_count,
      q.total_reference_value,
      q.proposal_blocked,
      q.no_longer_listed_at,
      q.collected_at,
      c.name as category_name
    from ${quotations} q
    left join "categories" c on c.id = q.category_id and c.active = true
    where q.id_school = ${idSchool}
    order by q.proposal_deadline desc nulls last, q.id desc
  `);

  return result.rows;
}

export type SchoolOpportunityRow = {
  id: number;
  external_id: string;
  order_id: string;
  school: string;
  city: string | null;
  expense_group: string;
  headline: string;
  summary: string;
  purchase_date: Date | string | null;
  delivery_date: Date | string | null;
  item_count: number;
  total_value: number | null;
  purchase_order_status: string | null;
  category_name: string | null;
};

/**
 * Get opportunities (histórico de compras) for a school.
 */
export async function getSchoolOpportunities(idSchool: number) {
  if (!Number.isInteger(idSchool) || idSchool <= 0 || idSchool > INT4_MAX) return [];
  const result = await db.execute<SchoolOpportunityRow>(sql`
    select
      o.id,
      o.external_id,
      o.order_id,
      o.school,
      o.city,
      o.expense_group,
      o.headline,
      o.summary,
      o.purchase_date,
      o.delivery_date,
      o.item_count,
      o.total_value,
      o.purchase_order_status,
      c.name as category_name
    from ${opportunities} o
    left join "categories" c on c.id = o.category_id and c.active = true
    where o.id_school = ${idSchool}
    order by o.purchase_date desc nulls last, o.id desc
  `);

  return result.rows;
}

/**
 * Split quotations into open and closed.
 * Open: proposalDeadline >= now AND noLongerListedAt IS NULL.
 * Closed: proposalDeadline < now OR noLongerListedAt IS NOT NULL.
 */
export function splitQuotations(rows: SchoolQuotationRow[]) {
  const now = new Date();
  const open: SchoolQuotationRow[] = [];
  const closed: SchoolQuotationRow[] = [];

  for (const row of rows) {
    if (isQuotationOpen(row, now)) {
      open.push(row);
    } else {
      closed.push(row);
    }
  }

  return { open, closed };
}

export function isQuotationOpen(row: SchoolQuotationRow, now = new Date()) {
  if (row.no_longer_listed_at) return false;
  if (!row.proposal_deadline) return false;
  const deadline =
    row.proposal_deadline instanceof Date
      ? row.proposal_deadline
      : new Date(row.proposal_deadline);
  return deadline.getTime() >= now.getTime();
}

/** Get distinct cities from schools scoped to RMBH. */
export async function listSchoolCities(): Promise<string[]> {
  const result = await db.execute<{ city: string }>(sql`
    select distinct s.city
    from ${schools} s
    where ${scopeWhere()} and s.city is not null
    order by s.city
  `);
  return result.rows.map((r) => r.city);
}

function scopeWhere() {
  return sql`s.id_county in (${sql.join(
    rmbhCountyIds.map((id) => sql`${id}`),
    sql`, `
  )})`;
}

const FOREIGN_KEY_VIOLATION = "23503";

/** Postgres error code, looking through the `cause` chain that drizzle wraps errors in. */
function pgErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string") return code;
  return pgErrorCode((error as { cause?: unknown }).cause);
}

function isValidId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= INT4_MAX
  );
}

function validUserId(value: number | null | undefined): number | null {
  return isValidId(value) ? value : null;
}

/** SQL boolean: is school `s` favorited by `userId`. Constant false without a valid user. */
function favoriteSql(userId: number | null) {
  if (userId === null) return sql`false`;
  return sql`exists (
    select 1 from ${userSchoolFavorites} f
    where f.user_id = ${userId} and f.id_school = s.id_school
  )`;
}

function mapSchoolRow(row: SchoolListRow): SchoolWithCounts {
  return {
    idSchool: row.id_school,
    name: row.name,
    city: row.city,
    regional: row.regional,
    openQuotations: row.open_quotations,
    totalQuotations: row.total_quotations,
    totalOpportunities: row.total_opportunities,
    isFavorite: row.is_favorite === true,
  };
}
