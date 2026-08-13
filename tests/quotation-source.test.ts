import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPostgresQuotationSource } from "@/lib/data/quotation-source";
import * as schema from "@/lib/db/schema";
import { canSubmitQuotationProposal } from "@/lib/quotation-ui";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://lpa:lpa@localhost:5432/lpa_leo_test";
const migrationFiles = [
  "drizzle/0000_exotic_hedge_knight.sql",
  "drizzle/0001_curly_lady_deathstrike.sql",
  "drizzle/0002_ordinary_proemial_gods.sql",
  "drizzle/0003_suppliers_base.sql",
  "drizzle/0004_parallel_princess_powerful.sql"
];
const dbTestLockKey = 941_445_002;

describe("PostgresQuotationSource", () => {
  let pool: Pool;
  let database: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query("select pg_advisory_lock($1)", [dbTestLockKey]);
    database = drizzle(pool, { schema });
  }, 30_000);

  beforeEach(async () => {
    await resetDatabase(pool);
    await seedDatabase(database);
  }, 30_000);

  afterAll(async () => {
    await pool.query("select pg_advisory_unlock($1)", [dbTestLockKey]);
    await pool.end();
  });

  it("mostra só cotações abertas por padrão e contador coerente", async () => {
    const source = createPostgresQuotationSource(database);
    const result = await source.listOpportunities({}, { pageSize: 12 });

    expect(result.total).toBe(2);
    expect(result.data.map((quotation) => quotation.externalId)).toEqual([
      "quote-open-soon",
      "quote-open-later"
    ]);
    expect(result.data.every((quotation) => quotation.canSubmitProposal)).toBe(true);
  });

  it("mantém encerradas acessíveis por filtro explícito", async () => {
    const source = createPostgresQuotationSource(database);

    await expect(source.listOpportunities({ situation: "closed" })).resolves.toMatchObject({
      total: 1,
      data: [{ externalId: "quote-closed", canSubmitProposal: false }]
    });
    await expect(source.listOpportunities({ situation: "all" })).resolves.toMatchObject({
      total: 3
    });
  });

  it("cotação vencida preserva orçamento e não permite ação de proposta", async () => {
    const source = createPostgresQuotationSource(database);
    const result = await source.listOpportunities({ situation: "closed" });
    const quotation = result.data[0]!;

    expect(quotation.orderId).toBe("2026166003");
    expect(canSubmitQuotationProposal(quotation)).toBe(false);
  });

  it("ignora total suspeito quando todos os itens estão sem preço real", async () => {
    await database
      .update(schema.quotations)
      .set({ totalReferenceValue: 400_000 });

    const source = createPostgresQuotationSource(database);
    const result = await source.listOpportunities({}, { pageSize: 12 });
    const quotation = result.data.find((item) => item.externalId === "quote-open-later")!;

    expect(quotation.totalValue).toBeNull();
    expect(quotation.items[0]).toMatchObject({ quantity: 1, unitValue: null });
  });

  it("sinaliza total parcial quando só parte dos itens tem preço", async () => {
    const source = createPostgresQuotationSource(database);
    const quotation = await source.getOpportunity("quote-open-soon");

    expect(quotation).toMatchObject({
      totalValue: 25,
      isTotalValuePartial: true,
      itemCount: 2
    });
    expect(quotation!.items.map((item) => item.totalValue)).toEqual([25, null]);
  });
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

async function seedDatabase(database: NodePgDatabase<typeof schema>) {
  const [category] = await database
    .insert(schema.categories)
    .values({ slug: "material", name: "Material escolar" })
    .returning();

  const quotations = await database
    .insert(schema.quotations)
    .values([
      quotationValues({
        externalId: "quote-open-later",
        nuBudgetOrder: "2026166002",
        idBudget: 6002,
        proposalDeadline: futureDate(5),
        headline: "Compra aberta depois"
      }, category!.id),
      quotationValues({
        externalId: "quote-closed",
        nuBudgetOrder: "2026166003",
        idBudget: 6003,
        proposalDeadline: pastDate(1),
        headline: "Compra encerrada"
      }, category!.id),
      quotationValues({
        externalId: "quote-open-soon",
        nuBudgetOrder: "2026166001",
        idBudget: 6001,
        proposalDeadline: futureDate(1),
        headline: "Compra aberta próxima",
        itemCount: 2,
        totalReferenceValue: 25
      }, category!.id)
    ])
    .returning({ id: schema.quotations.id, externalId: schema.quotations.externalId });

  const ids = new Map(quotations.map((row) => [row.externalId, row.id]));
  await database.insert(schema.quotationItems).values([
    itemValues(ids.get("quote-open-later")!, "Caderno"),
    itemValues(ids.get("quote-closed")!, "Lápis"),
    itemValues(ids.get("quote-open-soon")!, "Borracha", { referenceValue: 5, quantity: 5 }),
    itemValues(ids.get("quote-open-soon")!, "Apontador", { itemOrder: 2 })
  ]);
}

function quotationValues(input: {
  externalId: string;
  nuBudgetOrder: string;
  idBudget: number;
  proposalDeadline: Date;
  headline: string;
  itemCount?: number;
  totalReferenceValue?: number | null;
}, categoryId: number) {
  return {
    externalId: input.externalId,
    nuBudgetOrder: input.nuBudgetOrder,
    idSubprogram: 12,
    idSchool: 34,
    idBudget: input.idBudget,
    idCounty: 2209,
    countyName: "Ibirité",
    schoolName: "EE Teste",
    expenseGroup: "Material de Consumo",
    categoryId,
    headline: input.headline,
    summary: "Materiais para escola.",
    topItems: ["caderno"],
    proposalDeadline: input.proposalDeadline,
    deliveryDate: futureDate(10),
    itemCount: input.itemCount ?? 1,
    totalReferenceValue: input.totalReferenceValue ?? null,
    budgetStatus: "ENVI",
    supplierStatus: "NAEN",
    proposalUrl: `https://example.test/${input.externalId}`,
    rawJson: { source: "test" }
  };
}

function itemValues(quotationId: number, name: string, overrides: Partial<{
  itemOrder: number;
  quantity: number;
  referenceValue: number | null;
}> = {}) {
  return {
    quotationId,
    itemOrder: overrides.itemOrder ?? 1,
    name,
    description: name,
    unit: "UN",
    quantity: overrides.quantity ?? 1,
    referenceValue: overrides.referenceValue ?? null,
    rawJson: { source: "test" }
  };
}

function futureDate(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function pastDate(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
