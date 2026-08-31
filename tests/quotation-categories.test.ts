import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  buildQuotationRecord,
  DrizzleQuotationRepository
} from "@/lib/collector/quotations";
import * as schema from "@/lib/db/schema";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://lpa:lpa@localhost:5432/lpa_leo_test";
const dbTestLockKey = 941_445_002;

describe("DrizzleQuotationRepository categorias em Postgres real", () => {
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

  it("cria categoria ausente e grava category_id na cotação", async () => {
    const repository = new DrizzleQuotationRepository(database);

    await repository.upsertQuotation(quotationRecord("known-missing", "informatica"));

    await expectCategoryCount(1);
    const [quotation] = await database.select().from(schema.quotations).limit(1);
    const [category] = await database.select().from(schema.categories).limit(1);
    expect(category).toMatchObject({ slug: "informatica", name: "Informática", active: true });
    expect(quotation?.categoryId).toBe(category?.id);
  });

  it("reutiliza categoria existente sem duplicar", async () => {
    const [existing] = await database
      .insert(schema.categories)
      .values({ slug: "informatica", name: "Informática" })
      .returning({ id: schema.categories.id });
    const repository = new DrizzleQuotationRepository(database);

    await repository.upsertQuotation(quotationRecord("existing-1", "informatica"));
    await repository.upsertQuotation(quotationRecord("existing-2", "informatica"));

    await expectCategoryCount(1);
    const rows = await database.select().from(schema.quotations);
    expect(rows.map((row) => row.categoryId).sort()).toEqual([existing!.id, existing!.id]);
  });

  it("slug desconhecido não cria categoria lixo", async () => {
    const repository = new DrizzleQuotationRepository(database);

    await repository.upsertQuotation(quotationRecord("unknown", "categoria-fantasma"));

    await expectCategoryCount(0);
    const [quotation] = await database.select().from(schema.quotations).limit(1);
    expect(quotation?.categoryId).toBeNull();
  });

  async function expectCategoryCount(expected: number) {
    const result = await database.execute<{ count: string }>(
      sql`select count(*)::text as count from categories`
    );
    expect(Number(result.rows[0]?.count)).toBe(expected);
  }
});

function quotationRecord(externalId: string, categorySlug: string) {
  return {
    ...buildQuotationRecord(
      {
        idSubprogram: 12,
        idSchool: 34,
        idBudget: Number(externalId.replace(/\D/g, "").slice(0, 6)) || 56,
        idCounty: 2209,
        countyName: "Ibirité",
        schoolName: "EE Teste",
        expenseGroupDescription: "Material de Consumo",
        dtProposalSubmission: "2026-09-20T12:00:00.000Z",
        dtServiceDelivery: "2026-09-30T12:00:00.000Z",
        budgetStatus: "ENVI",
        supplierStatus: "NAEN",
        nuBudgetOrder: externalId,
        year: 2026
      },
      {
        schoolName: "EE Teste",
        countyName: "Ibirité",
        expenseGroupDescription: "Material de Consumo",
        initiativeDescription: "Compra de notebook para escola",
        estimatedValue: 100
      },
      [
        {
          nuItemOrder: 1,
          txBudgetItemType: "Notebook",
          txDescription: "Notebook",
          txBudgetItemUnit: "UN",
          nuQuantity: 1,
          nuReferralValue: 100
        }
      ]
    ),
    externalId,
    categorySlug
  };
}

async function resetDatabase(pool: Pool) {
  await pool.query("drop schema if exists public cascade");
  await pool.query("create schema public");

  const migrationFiles = readdirSync(resolve(process.cwd(), "drizzle"))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const sqlText = readFileSync(resolve(process.cwd(), "drizzle", file), "utf8");
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
