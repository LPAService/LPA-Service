import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildWinPublicationReference, resolvePendingBids } from "@/lib/collector/bids";
import { buildQuotationRecord, DrizzleQuotationRepository } from "@/lib/collector/quotations";
import type { DetailRecord, SummaryRecord } from "@/lib/collector/quotations";
import type { PaginatedResponse, PurchaseOrderListRecord } from "@/lib/collector/client";
import * as schema from "@/lib/db/schema";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://lpa:lpa@localhost:5432/lpa_leo_test";
const migrationFiles = readdirSync(resolve(process.cwd(), "drizzle"))
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => `drizzle/${name}`);
const dbTestLockKey = 941_445_019;

describe("bids vitória", () => {
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

  it("marca ganho quando transparência publica order_id para nosso supplier_id", async () => {
    const repository = new DrizzleQuotationRepository(database);
    await repository.upsertQuotation(quotationRecord({
      orderId: "2026160420",
      supplierId: 112454,
      deadline: "2026-09-10T12:00:00.000Z"
    }));
    const publication = purchaseOrder({
      orderId: "2026160420",
      idSupplier: 112454,
      idSubprogram: 648,
      idSchool: 8489,
      idBudget: 336006
    });
    const source = new FakeWinSource([[purchaseOrder({ orderId: "2026999999", idSupplier: 112454 })], [publication]]);

    const resolved = await resolvePendingBids(database, new Date("2026-09-17T12:00:00.000Z"), {
      winSource: source,
      winPageSize: 1
    });

    const [bid] = await database.select().from(schema.bids);
    expect(resolved).toBe(1);
    expect(source.requests).toEqual([
      { idSupplier: 112454, page: 1, pageSize: 1 },
      { idSupplier: 112454, page: 2, pageSize: 1 }
    ]);
    expect(bid).toMatchObject({
      outcome: "ganho",
      ourSupplierId: 112454,
      winPublicationId: buildWinPublicationReference(publication),
      winPublicationJson: publication
    });
    expect(bid.outcomeAt?.toISOString()).toBe("2026-09-17T12:00:00.000Z");
  });

  it("não deduz vitória por prazo vencido sem publicação positiva", async () => {
    const repository = new DrizzleQuotationRepository(database);
    await repository.upsertQuotation(quotationRecord({
      orderId: "2026160420",
      supplierId: 112454,
      deadline: "2026-09-10T12:00:00.000Z"
    }));

    const resolved = await resolvePendingBids(database, new Date("2026-09-17T12:00:00.000Z"), {
      winSource: new FakeWinSource([])
    });

    const [bid] = await database.select().from(schema.bids);
    expect(resolved).toBe(1);
    expect(bid.outcome).toBe("sem_resultado");
    expect(bid.winPublicationId).toBeNull();
    expect(bid.winPublicationJson).toBeNull();
  });

  it("recupera supplier_id antigo do raw_json da cotação", async () => {
    const repository = new DrizzleQuotationRepository(database);
    await repository.upsertQuotation(quotationRecord({
      orderId: "2026160420",
      supplierId: 112454,
      deadline: "2026-09-10T12:00:00.000Z"
    }));
    await database.update(schema.bids).set({ ourSupplierId: null });

    await resolvePendingBids(database, new Date("2026-09-17T12:00:00.000Z"), {
      winSource: new FakeWinSource([[purchaseOrder({ orderId: "2026160420", idSupplier: 112454 })]])
    });

    const [bid] = await database.select().from(schema.bids);
    expect(bid.outcome).toBe("ganho");
  });
});

class FakeWinSource {
  requests: Array<{ idSupplier: number; page?: number; pageSize?: number }> = [];

  constructor(private readonly pages: PurchaseOrderListRecord[][]) {}

  async listPurchaseOrders(query: { idSupplier: number; page?: number; pageSize?: number }) {
    this.requests.push(query);
    const page = query.page ?? 1;
    const data = this.pages[page - 1] ?? [];
    return {
      data,
      meta: {
        page,
        pageSize: query.pageSize ?? 100,
        total: this.pages.flat().length,
        totalPages: Math.max(1, this.pages.length)
      }
    } satisfies PaginatedResponse<PurchaseOrderListRecord>;
  }
}

function quotationRecord(input: { orderId: string; supplierId: number; deadline: string }) {
  const listing: SummaryRecord = {
    idSubprogram: 648,
    idSchool: 8489,
    idBudget: 336006,
    idSupplier: input.supplierId,
    idCounty: 3106200,
    countyName: "Belo Horizonte",
    schoolName: "EE Teste",
    expenseGroupDescription: "Gêneros Alimentícios",
    dtProposalSubmission: input.deadline,
    dtServiceDelivery: "2026-10-01T12:00:00.000Z",
    budgetStatus: "ENVI",
    supplierStatus: "ENVI",
    nuBudgetOrder: input.orderId,
    year: 2026
  };
  const detail: DetailRecord = {
    schoolName: "EE Teste",
    countyName: "Belo Horizonte",
    expenseGroupDescription: "Gêneros Alimentícios",
    initiativeDescription: "Compra de merenda",
    dtProposalSubmission: input.deadline,
    estimatedValue: 500
  };
  return buildQuotationRecord(listing, detail, [
    {
      nuItemOrder: 1,
      txBudgetItemType: "Pão",
      txDescription: "Pão francês",
      txBudgetItemUnit: "KG",
      nuQuantity: 10,
      nuReferralValue: 12
    }
  ]);
}

function purchaseOrder(input: {
  orderId: string;
  idSupplier: number;
  idSubprogram?: number;
  idSchool?: number;
  idBudget?: number;
}): PurchaseOrderListRecord {
  return {
    orderId: input.orderId,
    year: "2026",
    school: "EE Teste",
    subprogram: "Subprograma",
    expenseGroup: "Gêneros Alimentícios",
    accountabilityStatus: "NENV",
    accountabilitySent: false,
    purchaseDate: "2026-09-12T12:00:00.000Z",
    idSubprogram: input.idSubprogram ?? 648,
    idSchool: input.idSchool ?? 8489,
    idBudget: input.idBudget ?? 336006,
    idSupplier: input.idSupplier
  };
}

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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
