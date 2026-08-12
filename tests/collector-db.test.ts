import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { collectOpportunities, DrizzleCollectorRepository } from "@/lib/collector/collect";
import type {
  PaginatedResponse,
  PortalFilters,
  PurchaseOrderAttachment,
  PurchaseOrderDetail,
  PurchaseOrderItem,
  PurchaseOrderItemsQuery,
  PurchaseOrderKey,
  PurchaseOrderListRecord,
  PurchaseOrdersQuery
} from "@/lib/collector/client";
import * as schema from "@/lib/db/schema";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://lpa:lpa@localhost:5432/lpa_leo";
const fixturesRoot = resolve(process.cwd(), "../../research/portal/fixtures");
const migrationFiles = [
  "drizzle/0000_exotic_hedge_knight.sql",
  "drizzle/0001_curly_lady_deathstrike.sql",
  "drizzle/0002_ordinary_proemial_gods.sql"
];

function readFixture<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(fixturesRoot, name), "utf8")) as T;
}

function buildExternalId(
  record: Pick<PurchaseOrderListRecord, "idSubprogram" | "idSchool" | "idBudget">
) {
  return `${record.idSubprogram}-${record.idSchool}-${record.idBudget}`;
}

const listing = readFixture<PaginatedResponse<PurchaseOrderListRecord>>(
  "purchase_orders_page1.json"
).data[0]!;
const detail = readFixture<PurchaseOrderDetail>("detail_1.json");
const sourceItems = readFixture<PaginatedResponse<PurchaseOrderItem>>("items_3.json").data.slice(
  0,
  2
);
const sourceAttachments = readFixture<{ data: PurchaseOrderAttachment[] }>(
  "attachment_metadata.json"
).data;

describe("DrizzleCollectorRepository em Postgres real", () => {
  let pool: Pool;
  let database: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    try {
      await pool.query("select 1");
    } catch (error) {
      throw new Error(`Postgres real indisponível em ${databaseUrl}: ${errorMessage(error)}`);
    }

    await resetDatabase(pool);
    database = drizzle(pool, { schema });
  }, 30_000);

  afterAll(async () => {
    await pool.end();
  });

  it("coletar 2x não duplica opportunities, items nem attachments", async () => {
    const client = new DatabaseFakeClient();
    const repository = new DrizzleCollectorRepository(database);

    const first = await collectOpportunities(client, repository, {
      mode: "full",
      refreshSchools: false
    });
    const second = await collectOpportunities(client, repository, {
      mode: "full",
      refreshSchools: false
    });

    expect(first).toMatchObject({ found: 1, newCount: 1, updatedCount: 0, errorCount: 0 });
    expect(second).toMatchObject({ found: 1, newCount: 0, updatedCount: 1, errorCount: 0 });
    await expectCount("opportunities", 1);
    await expectCount("items", 2);
    await expectCount("attachments", 2);
    await expectCount("schools", 1);

    const [school] = await database.select().from(schema.schools).limit(1);
    expect(school).toMatchObject({
      idSchool: listing.idSchool,
      name: listing.school,
      idCounty: null,
      city: null,
      regional: null
    });
  });

  async function expectCount(table: string, expected: number) {
    const result = await database.execute<{ count: string }>(
      sql.raw(`select count(*)::text as count from "${table}"`)
    );
    expect(Number(result.rows[0]?.count)).toBe(expected);
  }
});

async function resetDatabase(pool: Pool) {
  await pool.query("drop schema if exists public cascade");
  await pool.query("create schema public");

  for (const file of migrationFiles) {
    const sqlText = readFileSync(resolve(process.cwd(), file), "utf8");
    const statements = sqlText
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await pool.query(statement);
    }
  }
}

class DatabaseFakeClient {
  async listPurchaseOrders(query: PurchaseOrdersQuery) {
    const page = query.page ?? 1;
    return {
      data: page === 1 ? [listing] : [],
      meta: {
        page,
        pageSize: 1,
        total: 1,
        totalPages: 1
      }
    };
  }

  async getPurchaseOrderDetail() {
    return detail;
  }

  async listPurchaseOrderItems(query: PurchaseOrderItemsQuery) {
    return {
      data: query.page === 1 ? sourceItems : [],
      meta: {
        page: query.page ?? 1,
        pageSize: sourceItems.length,
        total: sourceItems.length,
        totalPages: 1
      }
    };
  }

  async getPurchaseOrderImages(key: PurchaseOrderKey) {
    expect(buildExternalId(key)).toBe(buildExternalId(listing));
    return sourceAttachments;
  }

  async getPortalFilters(): Promise<PortalFilters> {
    return {};
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
