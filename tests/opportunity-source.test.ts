import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createPostgresOpportunitySource,
  sanitizePageParam
} from "@/lib/data/postgres-source";
import * as schema from "@/lib/db/schema";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://lpa:lpa@localhost:5432/lpa_leo_test";
const migrationFiles = [
  "drizzle/0000_exotic_hedge_knight.sql",
  "drizzle/0001_curly_lady_deathstrike.sql",
  "drizzle/0002_ordinary_proemial_gods.sql"
];
const dbTestLockKey = 941_445_001;

describe("PostgresOpportunitySource", () => {
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

  it("pagina, ordena e limita resultados filtrados", async () => {
    const source = createPostgresOpportunitySource(database);
    const result = await source.listOpportunities(
      { category: "alimentos" },
      { page: 2, pageSize: 12 }
    );

    expect(result).toMatchObject({
      total: 1,
      totalAvailable: 2,
      totalPages: 1,
      page: 1,
      pageSize: 12
    });
    expect(result.data.map((opportunity) => opportunity.externalId)).toEqual([
      "opp-food-1"
    ]);
  });

  it("filtra cidade, grupo, escola, texto e período no Postgres", async () => {
    const source = createPostgresOpportunitySource(database);

    await expect(
      source.listOpportunities({ city: "Belo Horizonte", query: "arroz premium" })
    ).resolves.toMatchObject({ total: 1 });
    await expect(
      source.listOpportunities({
        expenseGroup: "Manutenção e Reformas",
        school: "EE Reforma",
        query: "reparo",
        periodStart: "2026-08-09",
        periodEnd: "2026-08-25"
      })
    ).resolves.toMatchObject({ total: 1 });
    await expect(
      source.listOpportunities({
        periodStart: "2026-08-09",
        periodEnd: "2026-08-25"
      })
    ).resolves.toMatchObject({ total: 2 });
    await expect(
      source.listOpportunities({ periodStart: "not-a-date" })
    ).resolves.toMatchObject({ total: 0, data: [] });
  });

  it("calcula facets somente sobre resultado filtrado", async () => {
    const source = createPostgresOpportunitySource(database);
    const result = await source.listOpportunities({ query: "arroz premium" });

    expect(result.facets).toEqual({
      cities: ["Belo Horizonte"],
      categories: [{ slug: "alimentos", name: "Alimentos" }],
      expenseGroups: ["Gêneros Alimentícios"],
      schools: ["EE Centro"]
    });
  });

  it("carrega detalhe com escola, categoria, itens e anexos", async () => {
    const source = createPostgresOpportunitySource(database);
    const opportunity = await source.getOpportunity("opp-food-1");

    expect(opportunity).toMatchObject({
      externalId: "opp-food-1",
      school: "EE Centro",
      city: "Belo Horizonte",
      regional: "SRE/METROPOLITANA A",
      category: {
        slug: "alimentos",
        name: "Alimentos",
        confidence: null,
        needsFallback: null
      },
      itemCount: 1,
      items: [{ name: "Arroz premium", quantity: 10 }],
      attachments: [{ id: 501, filename: "edital.pdf" }]
    });
    await expect(source.getOpportunity("missing")).resolves.toBeNull();
  });

  it("mantém categoria vazia e filtro sem resultado quando tabela não tem categorias", async () => {
    await database.update(schema.opportunities).set({ categoryId: null });
    await database.delete(schema.categories);
    const source = createPostgresOpportunitySource(database);

    const unfiltered = await source.listOpportunities();
    const filtered = await source.listOpportunities({ category: "alimentos" });

    expect(unfiltered.total).toBe(2);
    expect(unfiltered.facets.categories).toEqual([]);
    expect(unfiltered.data.every((opportunity) => opportunity.category === null)).toBe(true);
    expect(filtered).toMatchObject({ total: 0, data: [] });
  });

  it("restringe escopo padrão RMBH e bloqueia cidade fora da região", async () => {
    const source = createPostgresOpportunitySource(database);

    await expect(source.listOpportunities()).resolves.toMatchObject({
      totalAvailable: 2,
      facets: { cities: ["Belo Horizonte", "Contagem"] }
    });
    await expect(source.listOpportunities({ city: "Manhuaçu" })).resolves.toMatchObject({
      total: 0,
      data: []
    });
    await expect(source.getOpportunity("opp-food-2")).resolves.toBeNull();
  });
});

describe("page sanitization", () => {
  it.each([
    ["abc", 1],
    ["", 1],
    ["   ", 1],
    ["0", 1],
    ["-2", 1],
    ["1.5", 1],
    ["999999", 999999],
    [["1", "2"], 1],
    [" 2 ", 2]
  ] as const)("sanitizes page value %j", (value, expected) => {
    expect(sanitizePageParam(value)).toBe(expected);
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
  const [foodCategory, maintenanceCategory] = await database
    .insert(schema.categories)
    .values([
      { slug: "alimentos", name: "Alimentos" },
      { slug: "manutencao", name: "Manutenção" }
    ])
    .returning();

  await database.insert(schema.schools).values([
    {
      idSchool: 101,
      name: "EE Centro",
      idCounty: 2546,
      city: "Belo Horizonte",
      regional: "SRE/METROPOLITANA A",
      rawJson: { source: "test" }
    },
    {
      idSchool: 102,
      name: "EE Reforma",
      idCounty: 2340,
      city: "Contagem",
      regional: "SRE/METROPOLITANA B",
      rawJson: { source: "test" }
    },
    {
      idSchool: 103,
      name: "EE Interior",
      idCounty: 3,
      city: "Manhuaçu",
      regional: "SRE/MANHUAÇU",
      rawJson: { source: "test" }
    }
  ]);

  const savedOpportunities = await database
    .insert(schema.opportunities)
    .values([
      opportunityValues({
        externalId: "opp-food-1",
        orderId: "order-food-1",
        idSchool: 101,
        idBudget: 1001,
        school: "EE Centro",
        city: null,
        regional: null,
        expenseGroup: "Gêneros Alimentícios",
        purchaseDate: new Date("2026-08-10T12:00:00.000Z"),
        deliveryDate: new Date("2026-08-20T12:00:00.000Z"),
        categoryId: foodCategory!.id,
        headline: "Compra de alimentos",
        summary: "Fornecedor para merenda escolar.",
        topItems: ["arroz premium"]
      }),
      opportunityValues({
        externalId: "opp-maintenance",
        orderId: "order-maintenance",
        idSchool: 102,
        idBudget: 1002,
        school: "EE Reforma",
        city: "Contagem",
        regional: "SRE/METROPOLITANA B",
        expenseGroup: "Manutenção e Reformas",
        purchaseDate: new Date("2026-08-09T12:00:00.000Z"),
        deliveryDate: new Date("2026-08-25T12:00:00.000Z"),
        categoryId: maintenanceCategory!.id,
        headline: "Reparo predial",
        summary: "Fornecedor para reparo da escola.",
        topItems: ["tinta acrílica"]
      }),
      opportunityValues({
        externalId: "opp-food-2",
        orderId: "order-food-2",
        idSchool: 103,
        idBudget: 1003,
        school: "EE Interior",
        city: "Manhuaçu",
        regional: "SRE/MANHUAÇU",
        expenseGroup: "Gêneros Alimentícios",
        purchaseDate: new Date("2026-08-08T12:00:00.000Z"),
        deliveryDate: new Date("2026-09-05T12:00:00.000Z"),
        categoryId: foodCategory!.id,
        headline: "Compra de frutas",
        summary: "Fornecedor para frutas frescas.",
        topItems: ["banana prata"]
      })
    ])
    .returning({ id: schema.opportunities.id, externalId: schema.opportunities.externalId });

  const ids = new Map(savedOpportunities.map((row) => [row.externalId, row.id]));
  await database.insert(schema.items).values([
    itemValues(ids.get("opp-food-1")!, "Arroz premium", "Arroz tipo 1", 10),
    itemValues(ids.get("opp-maintenance")!, "Tinta acrílica", "Material para parede", 3),
    itemValues(ids.get("opp-food-2")!, "Banana prata", "Fruta fresca", 20)
  ]);
  await database.insert(schema.attachments).values({
    opportunityId: ids.get("opp-food-1")!,
    externalAttachmentId: 501,
    filename: "edital.pdf",
    thumbUrl: "https://example.test/edital-thumb",
    url: "https://example.test/edital.pdf",
    rawJson: { source: "test" }
  });
}

function opportunityValues(input: {
  externalId: string;
  orderId: string;
  idSchool: number;
  idBudget: number;
  school: string;
  city: string | null;
  regional: string | null;
  expenseGroup: string;
  purchaseDate: Date;
  deliveryDate: Date;
  categoryId: number;
  headline: string;
  summary: string;
  topItems: string[];
}) {
  return {
    ...input,
    sourceUrl: `https://example.test/${input.externalId}`,
    idSubprogram: 1,
    idSupplier: null,
    subprogram: "Subprograma de teste",
    year: "2026",
    proposalDate: new Date("2026-08-15T12:00:00.000Z"),
    purchaseOrderStatus: "ENVD",
    accountabilityStatus: "NENV",
    accountabilitySent: false,
    supplierName: null,
    supplierDocument: null,
    initiativeDescription: input.summary,
    totalValue: 100,
    itemCount: 1,
    rawJson: { source: "test" }
  };
}

function itemValues(
  opportunityId: number,
  name: string,
  description: string,
  quantity: number
) {
  return {
    opportunityId,
    itemOrder: 1,
    name,
    description,
    unit: "Unidade",
    quantity,
    unitValue: 10,
    totalValue: quantity * 10,
    isPermanent: false,
    expenseCategory: "Custeio",
    rawJson: { source: "test" }
  };
}
