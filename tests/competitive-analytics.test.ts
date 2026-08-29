import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createCompetitiveAnalytics } from "@/lib/analytics/competitive";
import * as schema from "@/lib/db/schema";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://lpa:lpa@localhost:5432/lpa_leo_test";
const migrationFiles = [
  "drizzle/0000_exotic_hedge_knight.sql",
  "drizzle/0001_curly_lady_deathstrike.sql",
  "drizzle/0002_ordinary_proemial_gods.sql",
  "drizzle/0003_suppliers_base.sql",
  "drizzle/0004_parallel_princess_powerful.sql",
  "drizzle/0006_faulty_nocturne.sql",
  "drizzle/0007_clumsy_proudstar.sql",
  "drizzle/0008_yielding_husk.sql",
  "drizzle/0009_notifications.sql",
  "drizzle/0010_sudden_zeigeist.sql"
];
const dbTestLockKey = 941_445_003;

describe("CompetitiveAnalytics", () => {
  let pool: Pool;
  let database: NodePgDatabase<typeof schema>;
  let previousScopeRegion: string | undefined;

  beforeAll(async () => {
    previousScopeRegion = process.env.SCOPE_REGION;
    process.env.SCOPE_REGION = "all";
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query("select pg_advisory_lock($1)", [dbTestLockKey]);
    database = drizzle(pool, { schema });
  }, 30_000);

  beforeEach(async () => {
    await resetDatabase(pool);
    await seedDatabase(database);
  }, 30_000);

  afterAll(async () => {
    if (previousScopeRegion === undefined) delete process.env.SCOPE_REGION;
    else process.env.SCOPE_REGION = previousScopeRegion;
    await pool.query("select pg_advisory_unlock($1)", [dbTestLockKey]);
    await pool.end();
  });

  it("classifica cada cotação com match em um bucket de perda por prioridade", async () => {
    const analytics = createCompetitiveAnalytics(database);
    const reasons = await analytics.getLossReasons();

    expect(reasons.map((reason) => reason.reason).sort()).toEqual([
      "bloqueada",
      "incumbente",
      "prazo_inviavel",
      "preco",
      "reserva_pnae"
    ]);
    expect(reasons.every((reason) => reason.count === 1)).toBe(true);
    expect(reasons.reduce((sum, reason) => sum + reason.count, 0)).toBe(5);
  });

  it("mantém benchmark de preço só com produto/unidade com pelo menos 30 amostras", async () => {
    const analytics = createCompetitiveAnalytics(database);
    const benchmarks = await analytics.getPriceBenchmark(10);

    expect(benchmarks).toHaveLength(1);
    expect(benchmarks[0]).toMatchObject({
      product: "arroz tipo 1",
      unit: "KG",
      samples: 30,
      supplierCount: 5,
      minPrice: 10,
      median: 24.5
    });
  });

  it("calcula desconto vencedor no subconjunto sanitizado e preserva estatística bruta", async () => {
    const analytics = createCompetitiveAnalytics(database);
    const discount = await analytics.getWinnerDiscount();

    expect(discount).toMatchObject({
      pairs: 5,
      belowRefCount: 4,
      sanitizedPairs: 3,
      sanitizedMedianDiscountPct: 20
    });
    expect(discount.medianRatio).toBeCloseTo(0.8);
    expect(discount.byGroup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          expenseGroup: "Material de Consumo",
          pairs: 4,
          sanitizedPairs: 2,
          sanitizedMedianDiscountPct: 25
        })
      ])
    );
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
  await database.insert(schema.schools).values([
    { idSchool: 101, name: "EE Central", idCounty: 2209, city: "Ibirité", rawJson: {} },
    { idSchool: 102, name: "EE Campo", idCounty: 2209, city: "Ibirité", rawJson: {} },
    { idSchool: 103, name: "EE Norte", idCounty: 2209, city: "Ibirité", rawJson: {} },
    { idSchool: 104, name: "EE Sul", idCounty: 2209, city: "Ibirité", rawJson: {} },
    { idSchool: 105, name: "EE Oeste", idCounty: 2209, city: "Ibirité", rawJson: {} }
  ]);

  await seedLossReasonRows(database);
  await seedBenchmarkRows(database);
}

async function seedLossReasonRows(database: NodePgDatabase<typeof schema>) {
  await database.insert(schema.opportunities).values([
    opportunityValues("old-incumbent", 104, 40, "Fornecedor Incumbente", "111", "2026-01-10", "Material de Consumo", 100),
    opportunityValues("won-blocked", 101, 1, "Fornecedor Bloqueio", "001", "2026-02-10", "Material de Consumo", 80),
    opportunityValues("won-deadline", 102, 2, "Fornecedor Prazo", "002", "2026-02-11", "Material de Consumo", 90),
    opportunityValues("won-pnae", 103, 3, "Cooperativa Familiar Rural", "003", "2026-02-12", "Gêneros Alimentícios", 95),
    opportunityValues("won-incumbent", 104, 4, "Fornecedor Incumbente", "111", "2026-02-13", "Material de Consumo", 70),
    opportunityValues("won-price", 105, 5, "Fornecedor Preço", "005", "2026-02-14", "Material de Consumo", 60)
  ]);

  await database.insert(schema.quotations).values([
    quotationValues("quote-blocked", 101, 1, "2026-02-09", "2026-02-20", "Material de Consumo", 100, true),
    quotationValues("quote-deadline", 102, 2, "2026-02-10", "2026-02-10", "Material de Consumo", 100, false),
    quotationValues("quote-pnae", 103, 3, "2026-02-11", "2026-02-20", "Gêneros Alimentícios", 100, false),
    quotationValues("quote-incumbent", 104, 4, "2026-02-12", "2026-02-20", "Material de Consumo", 100, false),
    quotationValues("quote-price", 105, 5, "2026-02-13", "2026-02-20", "Material de Consumo", 100, false)
  ]);

  await seedDiscountItems(database);
}

async function seedDiscountItems(database: NodePgDatabase<typeof schema>) {
  const opportunities = await database
    .select({ id: schema.opportunities.id, externalId: schema.opportunities.externalId })
    .from(schema.opportunities);
  const quotations = await database
    .select({ id: schema.quotations.id, externalId: schema.quotations.externalId })
    .from(schema.quotations);
  const opportunityIds = new Map(opportunities.map((row) => [row.externalId, row.id]));
  const quotationIds = new Map(quotations.map((row) => [row.externalId, row.id]));

  const ratios = [
    ["won-blocked", "quote-blocked", 80],
    ["won-deadline", "quote-deadline", 20],
    ["won-pnae", "quote-pnae", 95],
    ["won-incumbent", "quote-incumbent", 120],
    ["won-price", "quote-price", 70]
  ] as const;

  await database.insert(schema.items).values(
    ratios.map(([externalId, , unitValue]) =>
      itemValues(opportunityIds.get(externalId)!, "Produto desconto", "UN", unitValue)
    )
  );
  await database.insert(schema.quotationItems).values(
    ratios.map(([, externalId]) =>
      quotationItemValues(quotationIds.get(externalId)!, "Produto desconto", "UN", 100)
    )
  );
}

async function seedBenchmarkRows(database: NodePgDatabase<typeof schema>) {
  const values = Array.from({ length: 30 }, (_, index) =>
    opportunityValues(
      `bench-${index}`,
      101 + (index % 5),
      1000 + index,
      `Fornecedor ${index % 5}`,
      `bench-${index % 5}`,
      "2026-03-01",
      "Material de Consumo",
      100 + index
    )
  );
  const inserted = await database
    .insert(schema.opportunities)
    .values(values)
    .returning({ id: schema.opportunities.id });

  await database.insert(schema.items).values(
    inserted.map((row, index) =>
      itemValues(row.id, index % 2 === 0 ? "Arroz   Tipo 1" : "Arroz Tipo 1", "kg", 10 + index)
    )
  );

  const [extra] = await database
    .insert(schema.opportunities)
    .values(opportunityValues("bench-small", 101, 2000, "Fornecedor Extra", "extra", "2026-03-01", "Material de Consumo", 50))
    .returning({ id: schema.opportunities.id });
  await database.insert(schema.items).values(itemValues(extra!.id, "Feijão", "KG", 8));
}

function opportunityValues(
  externalId: string,
  idSchool: number,
  idBudget: number,
  supplierName: string,
  supplierDocument: string,
  purchaseDate: string,
  expenseGroup: string,
  totalValue: number
) {
  return {
    externalId,
    orderId: externalId,
    sourceUrl: "https://example.test",
    idSubprogram: 12,
    idSchool,
    idBudget,
    idSupplier: null,
    school: `Escola ${idSchool}`,
    city: "Ibirité",
    regional: "RMBH",
    expenseGroup,
    subprogram: "Subprograma",
    year: "2026",
    purchaseDate: new Date(`${purchaseDate}T12:00:00.000Z`),
    proposalDate: new Date(`${purchaseDate}T08:00:00.000Z`),
    deliveryDate: new Date(`${purchaseDate}T12:00:00.000Z`),
    purchaseOrderStatus: "ADJU",
    accountabilityStatus: null,
    supplierName,
    supplierDocument,
    initiativeDescription: "Teste",
    totalValue,
    itemCount: 1,
    rawJson: {}
  };
}

function quotationValues(
  externalId: string,
  idSchool: number,
  idBudget: number,
  proposalDate: string,
  deliveryDate: string,
  expenseGroup: string,
  totalReferenceValue: number,
  proposalBlocked: boolean
) {
  return {
    externalId,
    nuBudgetOrder: externalId,
    idSubprogram: 12,
    idSchool,
    idBudget,
    idCounty: 2209,
    countyName: "Ibirité",
    schoolName: `Escola ${idSchool}`,
    expenseGroup,
    headline: externalId,
    summary: "Teste",
    topItems: [],
    proposalDeadline: new Date(`${proposalDate}T08:00:00.000Z`),
    deliveryDate: new Date(`${deliveryDate}T08:00:00.000Z`),
    itemCount: 1,
    totalReferenceValue,
    budgetStatus: "ENVI",
    supplierStatus: "NAEN",
    proposalUrl: "https://example.test/proposal",
    proposalBlocked,
    rawJson: {}
  };
}

function itemValues(opportunityId: number, name: string, unit: string, unitValue: number) {
  return {
    opportunityId,
    itemOrder: 1,
    name,
    description: name,
    unit,
    quantity: 1,
    unitValue,
    totalValue: unitValue,
    isPermanent: false,
    expenseCategory: "Consumo",
    rawJson: {}
  };
}

function quotationItemValues(quotationId: number, name: string, unit: string, referenceValue: number) {
  return {
    quotationId,
    itemOrder: 1,
    name,
    description: name,
    unit,
    quantity: 1,
    referenceValue,
    rawJson: {}
  };
}
