import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resolvePendingBids } from "@/lib/collector/bids";
import { buildQuotationRecord, DrizzleQuotationRepository } from "@/lib/collector/quotations";
import type { DetailRecord, SummaryRecord } from "@/lib/collector/quotations";
import * as schema from "@/lib/db/schema";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://lpa:lpa@localhost:5432/lpa_leo_test";
const migrationFiles = readdirSync(resolve(process.cwd(), "drizzle"))
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => `drizzle/${name}`);
const dbTestLockKey = 941_445_018;

describe("bids", () => {
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

  it("NAEN para ENVI cria exatamente uma linha e detecção é idempotente", async () => {
    const repository = new DrizzleQuotationRepository(database);
    await repository.upsertQuotation(quotationRecord({ supplierStatus: "NAEN" }));
    expect(await countBids()).toBe(0);

    await repository.upsertQuotation(quotationRecord({ supplierStatus: "ENVI" }));
    const [first] = await database.select().from(schema.bids);
    expect(await countBids()).toBe(1);
    expect(first).toMatchObject({ quotationExternalId: "702-8374-366251", outcome: "pendente" });

    await sleep(5);
    await repository.upsertQuotation(quotationRecord({ supplierStatus: "ENVI" }));
    const [second] = await database.select().from(schema.bids);
    expect(await countBids()).toBe(1);
    expect(second.detectedAt.getTime()).toBe(first.detectedAt.getTime());
  });

  it("lance com pré-orçamento usa total sugerido e margem", async () => {
    const repository = new DrizzleQuotationRepository(database);
    await insertPreQuote("702-8374-366251");
    await repository.upsertQuotation(quotationRecord({ supplierStatus: "ENVI" }));

    const [bid] = await database.select().from(schema.bids);
    expect(bid.preQuoteId).not.toBeNull();
    expect(bid.ourTotal).toBe(252);
    expect(bid.marginPercent).toBe(20);
  });

  it("lance sem pré-orçamento entra com totais nulos", async () => {
    const repository = new DrizzleQuotationRepository(database);
    await repository.upsertQuotation(quotationRecord({ supplierStatus: "ENVI" }));

    const [bid] = await database.select().from(schema.bids);
    expect(bid.preQuoteId).toBeNull();
    expect(bid.ourTotal).toBeNull();
    expect(bid.marginPercent).toBeNull();
  });

  it("resolução marca perdido e amarra loss_id", async () => {
    const repository = new DrizzleQuotationRepository(database);
    await repository.upsertQuotation(quotationRecord({ supplierStatus: "ENVI" }));
    const [loss] = await insertLoss("2026177780");

    const resolved = await resolvePendingBids(database, new Date("2026-09-17T12:00:00.000Z"));

    const [bid] = await database.select().from(schema.bids);
    expect(resolved).toBe(1);
    expect(bid.outcome).toBe("perdido");
    expect(bid.lossId).toBe(loss.id);
    expect(bid.outcomeAt).not.toBeNull();
  });

  it("prazo vencido sem publicação vira sem_resultado", async () => {
    const repository = new DrizzleQuotationRepository(database);
    await repository.upsertQuotation(quotationRecord({
      supplierStatus: "ENVI",
      deadline: "2026-09-10T12:00:00.000Z"
    }));

    const resolved = await resolvePendingBids(database, new Date("2026-09-17T12:00:00.000Z"));

    const [bid] = await database.select().from(schema.bids);
    expect(resolved).toBe(1);
    expect(bid.outcome).toBe("sem_resultado");
    expect(bid.lossId).toBeNull();
  });

  async function countBids() {
    const result = await database.execute<{ count: string }>(
      sql`select count(*)::text as count from ${schema.bids}`
    );
    return Number(result.rows[0]?.count);
  }

  async function insertPreQuote(quotationExternalId: string) {
    const [preQuote] = await database.insert(schema.preQuotes).values({
      quotationExternalId,
      orderId: "2026177780",
      schoolName: "EE Teste",
      city: "Ibirité",
      expenseGroup: "Material de Consumo",
      headline: "Compra",
      marginPercent: 20,
      freightCost: 12,
      status: "draft"
    }).returning({ id: schema.preQuotes.id });
    await database.insert(schema.preQuoteItems).values([
      {
        preQuoteId: preQuote.id,
        itemOrder: 1,
        name: "Caderno",
        description: "Caderno",
        unit: "UN",
        quantity: 2,
        unitCost: 100,
        source: "manual"
      }
    ]);
  }

  async function insertLoss(orderId: string) {
    return database.insert(schema.proposalLosses).values({
      orderId,
      idSubprogram: 702,
      idSchool: 8374,
      idBudget: 366251,
      schoolName: "EE Teste",
      countyName: "Ibirité",
      expenseGroup: "Material de Consumo",
      proposalDeadline: new Date("2026-09-20T12:00:00.000Z"),
      ourSupplierId: 10,
      ourTotal: 300,
      winnerSupplierId: 20,
      winnerName: "Concorrente",
      winnerTotal: 250,
      competitorCount: 2,
      ourRank: 2,
      estimatedValue: 400
    }).returning({ id: schema.proposalLosses.id });
  }
});

function quotationRecord(input: { supplierStatus: string; deadline?: string }) {
  const listing: SummaryRecord = {
    idSubprogram: 702,
    idSchool: 8374,
    idBudget: 366251,
    idSupplier: 10,
    idCounty: 2209,
    countyName: "Ibirité",
    schoolName: "EE Teste",
    expenseGroupDescription: "Material de Consumo",
    dtProposalSubmission: input.deadline ?? "2026-09-20T12:00:00.000Z",
    dtServiceDelivery: "2026-10-01T12:00:00.000Z",
    budgetStatus: "ABER",
    supplierStatus: input.supplierStatus,
    nuBudgetOrder: "2026177780",
    year: 2026
  };
  const detail: DetailRecord = {
    schoolName: "EE Teste",
    countyName: "Ibirité",
    expenseGroupDescription: "Material de Consumo",
    initiativeDescription: "Compra de material escolar",
    dtProposalSubmission: input.deadline ?? "2026-09-20T12:00:00.000Z",
    estimatedValue: 500
  };
  return buildQuotationRecord(listing, detail, [
    {
      nuItemOrder: 1,
      txBudgetItemType: "Caderno",
      txDescription: "Caderno universitário",
      txBudgetItemUnit: "UN",
      nuQuantity: 2,
      nuReferralValue: 100
    }
  ]);
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
