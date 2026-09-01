import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  collectOpportunities,
  DrizzleCollectorRepository,
  refreshStale,
  type OpportunityRecord
} from "@/lib/collector/collect";
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

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://lpa:lpa@localhost:5432/lpa_leo_test";
const fixturesRoot = findFixturesRoot();
const migrationFiles = [
  "drizzle/0000_exotic_hedge_knight.sql",
  "drizzle/0001_curly_lady_deathstrike.sql",
  "drizzle/0002_ordinary_proemial_gods.sql",
  "drizzle/0014_open_quotation_cursor.sql"
];

function readFixture<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(fixturesRoot, name), "utf8")) as T;
}

function findFixturesRoot() {
  const candidates = [
    resolve(process.cwd(), "research/portal/fixtures"),
    resolve(process.cwd(), "../../research/portal/fixtures")
  ];
  const found = candidates.find((candidate) =>
    existsSync(resolve(candidate, "purchase_orders_page1.json"))
  );

  if (!found) {
    throw new Error("research/portal/fixtures not found");
  }

  return found;
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
const dbTestLockKey = 941_445_001;

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

    await pool.query("select pg_advisory_lock($1)", [dbTestLockKey]);
    database = drizzle(pool, { schema });
  }, 30_000);

  beforeEach(async () => {
    await resetDatabase(pool);
  }, 30_000);

  afterAll(async () => {
    await pool.query("select pg_advisory_unlock($1)", [dbTestLockKey]);
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

  it("falha de insert de filhos faz rollback real de parent e filhos", async () => {
    const client = new DatabaseFakeClient();
    const repository = new DrizzleCollectorRepository(database);

    await collectOpportunities(client, repository, {
      mode: "full",
      refreshSchools: false
    });

    client.details[buildExternalId(listing)] = { ...detail, purchaseOrderStatus: "APRO" };
    client.images[buildExternalId(listing)] = [
      {
        id: 999999,
        filename: null,
        thumbUrl: "/broken",
        url: ""
      } as unknown as PurchaseOrderAttachment
    ];

    const failed = await collectOpportunities(client, repository, {
      mode: "full",
      refreshSchools: false
    });

    expect(failed).toMatchObject({ found: 1, newCount: 0, updatedCount: 0, errorCount: 1 });
    await expectCount("opportunities", 1);
    await expectCount("items", 2);
    await expectCount("attachments", 2);

    const [opportunity] = await database.select().from(schema.opportunities).limit(1);
    expect(opportunity?.purchaseOrderStatus).toBe("ENVD");
  });

  it("listStaleOpportunityListings respeita cutoff exato", async () => {
    const repository = new DrizzleCollectorRepository(database);
    const cutoff = new Date("2026-08-05T12:00:00.000Z");
    const oldRecord = cloneListing(listing, 900001);
    const exactRecord = cloneListing(listing, 900002);
    const freshRecord = cloneListing(listing, 900003);

    await repository.upsertOpportunity(makeOpportunity(oldRecord));
    await repository.upsertOpportunity(makeOpportunity(exactRecord));
    await repository.upsertOpportunity(makeOpportunity(freshRecord));
    await setCollectedAt(oldRecord, new Date(cutoff.getTime() - 1));
    await setCollectedAt(exactRecord, cutoff);
    await setCollectedAt(freshRecord, new Date(cutoff.getTime() + 1));

    const stale = await repository.listStaleOpportunityListings(cutoff);

    expect(stale.map(buildExternalId)).toEqual([buildExternalId(oldRecord)]);
  });

  it("refreshStale re-coleta só vencido pelo TTL e atualiza filhos", async () => {
    const oldRecord = cloneListing(listing, 910001);
    const freshRecord = cloneListing(listing, 910002);
    const client = new DatabaseFakeClient([oldRecord, freshRecord]);
    const repository = new DrizzleCollectorRepository(database);

    await repository.upsertOpportunity(makeOpportunity(oldRecord));
    await repository.upsertOpportunity(makeOpportunity(freshRecord));
    await setCollectedAt(oldRecord, new Date(Date.now() - 8 * 24 * 60 * 60 * 1000));
    await setCollectedAt(freshRecord, new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));

    client.details[buildExternalId(oldRecord)] = {
      ...detail,
      purchaseOrderStatus: "APRO",
      dtDelivery: "2026-10-01T00:00:00.000Z"
    };
    client.items[buildExternalId(oldRecord)] = [sourceItems[0]!];
    client.images[buildExternalId(oldRecord)] = [sourceAttachments[0]!];
    client.details[buildExternalId(freshRecord)] = {
      ...detail,
      purchaseOrderStatus: "REPR"
    };

    const result = await refreshStale(client, repository, 7);

    expect(result).toMatchObject({ found: 1, newCount: 0, updatedCount: 1, errorCount: 0 });
    expect(client.detailCalls).toEqual([buildExternalId(oldRecord)]);

    const [oldOpportunity] = await database
      .select()
      .from(schema.opportunities)
      .where(sql`${schema.opportunities.externalId} = ${buildExternalId(oldRecord)}`)
      .limit(1);
    const [freshOpportunity] = await database
      .select()
      .from(schema.opportunities)
      .where(sql`${schema.opportunities.externalId} = ${buildExternalId(freshRecord)}`)
      .limit(1);

    expect(oldOpportunity?.purchaseOrderStatus).toBe("APRO");
    expect(freshOpportunity?.purchaseOrderStatus).toBe("ENVD");
    await expectChildCount(oldOpportunity!.id, "items", 1);
    await expectChildCount(oldOpportunity!.id, "attachments", 1);
  });

  async function expectCount(table: string, expected: number) {
    const result = await database.execute<{ count: string }>(
      sql.raw(`select count(*)::text as count from "${table}"`)
    );
    expect(Number(result.rows[0]?.count)).toBe(expected);
  }

  async function expectChildCount(opportunityId: number, table: "items" | "attachments", expected: number) {
    const result = await database.execute<{ count: string }>(
      sql`select count(*)::text as count from ${sql.identifier(table)} where opportunity_id = ${opportunityId}`
    );
    expect(Number(result.rows[0]?.count)).toBe(expected);
  }

  async function setCollectedAt(record: PurchaseOrderListRecord, collectedAt: Date) {
    await database
      .update(schema.opportunities)
      .set({ collectedAt })
      .where(sql`${schema.opportunities.externalId} = ${buildExternalId(record)}`);
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
  readonly details: Record<string, PurchaseOrderDetail> = {};
  readonly items: Record<string, PurchaseOrderItem[]> = {};
  readonly images: Record<string, PurchaseOrderAttachment[]> = {};
  readonly detailCalls: string[] = [];
  private readonly listings: PurchaseOrderListRecord[];

  constructor(listings: PurchaseOrderListRecord[] = [listing]) {
    this.listings = listings;
    for (const record of listings) {
      this.details[buildExternalId(record)] = detail;
      this.items[buildExternalId(record)] = sourceItems;
      this.images[buildExternalId(record)] = sourceAttachments;
    }
  }

  async listPurchaseOrders(query: PurchaseOrdersQuery) {
    const page = query.page ?? 1;
    return {
      data: page === 1 ? this.listings : [],
      meta: {
        page,
        pageSize: this.listings.length,
        total: this.listings.length,
        totalPages: 1
      }
    };
  }

  async getPurchaseOrderDetail(key: PurchaseOrderKey) {
    const externalId = buildExternalId(key);
    this.detailCalls.push(externalId);
    return this.details[externalId] ?? detail;
  }

  async listPurchaseOrderItems(query: PurchaseOrderItemsQuery) {
    const items = this.items[buildExternalId(query)] ?? sourceItems;
    return {
      data: query.page === 1 ? items : [],
      meta: {
        page: query.page ?? 1,
        pageSize: items.length,
        total: items.length,
        totalPages: 1
      }
    };
  }

  async getPurchaseOrderImages(key: PurchaseOrderKey) {
    return this.images[buildExternalId(key)] ?? sourceAttachments;
  }

  async getPortalFilters(): Promise<PortalFilters> {
    return {};
  }
}

function cloneListing(record: PurchaseOrderListRecord, idBudget: number): PurchaseOrderListRecord {
  return {
    ...record,
    orderId: String(idBudget),
    idBudget,
    idSupplier: record.idSupplier
  };
}

function makeOpportunity(record: PurchaseOrderListRecord): OpportunityRecord {
  const item = sourceItems[0]!;
  const attachment = sourceAttachments[0]!;
  return {
    externalId: buildExternalId(record),
    orderId: record.orderId,
    sourceUrl: "https://example.test/source",
    idSubprogram: record.idSubprogram,
    idSchool: record.idSchool,
    idBudget: record.idBudget,
    idSupplier: record.idSupplier,
    school: record.school,
    city: null,
    regional: null,
    expenseGroup: record.expenseGroup,
    subprogram: record.subprogram,
    year: record.year,
    purchaseDate: record.purchaseDate ? new Date(record.purchaseDate) : null,
    proposalDate: null,
    deliveryDate: null,
    purchaseOrderStatus: "ENVD",
    accountabilityStatus: record.accountabilityStatus,
    accountabilitySent: record.accountabilitySent,
    supplierName: detail.supplierName,
    supplierDocument: detail.supplierDocument,
    initiativeDescription: detail.initiativeDescription,
    totalValue: item.nuValueByItem === null ? null : item.nuQuantity * item.nuValueByItem,
    itemCount: 1,
    rawJson: { listing: record },
    items: [
      {
        itemOrder: item.nuItemOrder,
        name: item.txBudgetItemType ?? "",
        description: item.txDescription ?? "",
        unit: item.txBudgetItemUnit ?? "",
        quantity: item.nuQuantity,
        unitValue: item.nuValueByItem,
        totalValue: item.nuValueByItem === null ? null : item.nuQuantity * item.nuValueByItem,
        isPermanent: item.inPermanent,
        expenseCategory: item.txExpenseCategory ?? "",
        rawJson: item
      }
    ],
    attachments: [
      {
        externalAttachmentId: attachment.id,
        filename: attachment.filename,
        thumbUrl: attachment.thumbUrl,
        url: attachment.url === "" ? null : attachment.url,
        rawJson: attachment
      }
    ]
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
