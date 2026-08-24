import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CatalogValidationError, createCatalogSource } from "@/lib/catalog/source";
import type { PreQuoteInput } from "@/lib/catalog/source";
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
  "drizzle/0007_yielding_husk.sql"
];
const dbTestLockKey = 941_445_007;

function preQuoteInput(items: PreQuoteInput["items"]): PreQuoteInput {
  return {
    quotationExternalId: "quote-x",
    orderId: "2026001",
    schoolName: "EE Teste",
    city: "Ibirité",
    expenseGroup: "Material de Consumo",
    headline: "Compra de material",
    marginPercent: 15,
    freightCost: 20,
    notes: "rascunho",
    items
  };
}

describe("createCatalogSource", () => {
  let pool: Pool;
  let database: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
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

  it("cria fornecedor exigindo nome", async () => {
    const source = createCatalogSource(database);

    await expect(source.createSupplier({})).rejects.toThrow(CatalogValidationError);
    const created = await source.createSupplier({ name: "  Papelaria Central Ltda  ", document: "12.345.678/0001-90" });

    expect(created.name).toBe("Papelaria Central Ltda");
    expect(created.document).toBe("12.345.678/0001-90");
    expect(created.itemCount).toBe(0);
    await expect(source.listSuppliers()).resolves.toHaveLength(1);
  });

  it("atualiza fornecedor e retorna null para id inexistente", async () => {
    const source = createCatalogSource(database);
    const created = await source.createSupplier({ name: "Fornecedor A", active: true });

    await expect(source.updateSupplier(created.id, { active: false, name: "Fornecedor B" })).resolves.toBe(created.id);
    const updated = await source.getSupplier(created.id);
    expect(updated?.name).toBe("Fornecedor B");
    expect(updated?.active).toBe(false);
    await expect(source.updateSupplier(9999, { name: "X" })).resolves.toBeNull();
  });

  it("faz upsert de item por nome normalizado + unidade, atualizando preço", async () => {
    const source = createCatalogSource(database);
    const supplier = await source.createSupplier({ name: "Papelaria" });

    await source.upsertCatalogItem(supplier.id, { name: "Papel A4", unit: "CX", unitPrice: 30 });
    await source.upsertCatalogItem(supplier.id, { name: "papel a4", unit: "CX", unitPrice: 27.5 });
    await source.upsertCatalogItem(supplier.id, { name: "Papel A4", unit: "PCT", unitPrice: 12 });

    const items = await source.listSupplierItems(supplier.id);
    expect(items).toHaveLength(2);
    const cx = items.find((item) => item.unit === "CX");
    expect(cx?.unitPrice).toBe(27.5);
    expect(cx?.normalizedName).toBe("papel a4");
  });

  it("exclui fornecedor em cascata com os itens", async () => {
    const source = createCatalogSource(database);
    const supplier = await source.createSupplier({ name: "Fornecedor Z" });
    await source.upsertCatalogItem(supplier.id, { name: "Item 1", unit: "UN", unitPrice: 1 });

    await expect(source.deleteSupplier(supplier.id)).resolves.toBe(true);
    await expect(source.listAllCatalogItems()).resolves.toEqual([]);
  });

  it("cria pré-orçamento com itens e calcula totalCost por linha", async () => {
    const source = createCatalogSource(database);
    const supplier = await source.createSupplier({ name: "Papelaria" });
    const itemId = await source.upsertCatalogItem(supplier.id, { name: "Papel A4", unit: "CX", unitPrice: 30 });

    const id = await source.createPreQuote(
      preQuoteInput([
        {
          itemOrder: 1,
          name: "Papel A4",
          description: "500 folhas",
          unit: "CX",
          quantity: 3,
          referenceValue: 40,
          supplierId: supplier.id,
          catalogItemId: itemId,
          unitCost: 30,
          source: "catalog"
        },
        {
          itemOrder: 2,
          name: "Caneta azul",
          description: "",
          unit: "UN",
          quantity: 10,
          referenceValue: null,
          supplierId: null,
          catalogItemId: null,
          unitCost: 1.2,
          source: "web",
          webTitle: "Caneta azul BIC",
          webPrice: 1.2,
          webUrl: "https://anuncio.test/1"
        },
        {
          itemOrder: 3,
          name: "Lápis",
          description: "",
          unit: "UN",
          quantity: 5,
          referenceValue: 2,
          supplierId: null,
          catalogItemId: null,
          unitCost: null,
          source: "manual" as const
        }
      ])
    );

    const preQuote = await source.getPreQuote(id);
    expect(preQuote).toMatchObject({
      id,
      quotationExternalId: "quote-x",
      orderId: "2026001",
      marginPercent: 15,
      freightCost: 20,
      status: "draft",
      items: [
        { itemOrder: 1, unitCost: 30, totalCost: 90, source: "catalog" },
        { itemOrder: 2, unitCost: 1.2, totalCost: 12, source: "web", webTitle: "Caneta azul BIC" },
        { itemOrder: 3, unitCost: null, totalCost: null, source: "manual", referenceValue: 2 }
      ]
    });
  });

  it("sanitiza margem negativa e fonte inválida", async () => {
    const source = createCatalogSource(database);
    const id = await source.createPreQuote({
      ...preQuoteInput([
        {
          itemOrder: 1,
          name: "Item",
          description: "",
          unit: "UN",
          quantity: 1,
          referenceValue: null,
          supplierId: null,
          catalogItemId: null,
          unitCost: 5,
          source: "inventado" as "none"
        }
      ]),
      marginPercent: -5,
      freightCost: -10
    });
    const preQuote = await source.getPreQuote(id);
    expect(preQuote?.items[0].source).toBe("none");
    expect(preQuote?.marginPercent).toBe(0);
    expect(preQuote?.freightCost).toBe(0);
  });

  it("savePreQuote substitui os itens", async () => {
    const source = createCatalogSource(database);
    const id = await source.createPreQuote(
      preQuoteInput([
        {
          itemOrder: 1,
          name: "Item antigo",
          description: "",
          unit: "UN",
          quantity: 1,
          referenceValue: null,
          supplierId: null,
          catalogItemId: null,
          unitCost: 5,
          source: "manual"
        }
      ])
    );

    await source.savePreQuote(id, {
      ...preQuoteInput([]),
      marginPercent: 25,
      items: [
        {
          itemOrder: 1,
          name: "Item novo",
          description: "",
          unit: "UN",
          quantity: 2,
          referenceValue: 10,
          supplierId: null,
          catalogItemId: null,
          unitCost: 7.5,
          source: "manual"
        }
      ]
    });

    const preQuote = await source.getPreQuote(id);
    expect(preQuote?.marginPercent).toBe(25);
    expect(preQuote?.items).toHaveLength(1);
    expect(preQuote?.items[0]).toMatchObject({ name: "Item novo", unitCost: 7.5, totalCost: 15 });
  });

  it("getLatestPreQuoteForQuotation devolve o mais recente e deletePreQuote remove", async () => {
    const source = createCatalogSource(database);
    const firstId = await source.createPreQuote(preQuoteInput([]));
    const secondId = await source.createPreQuote(preQuoteInput([]));

    const latest = await source.getLatestPreQuoteForQuotation("quote-x");
    expect(latest?.id).toBe(secondId);
    expect(firstId).not.toBe(secondId);

    await expect(source.deletePreQuote(secondId)).resolves.toBe(true);
    const afterDelete = await source.getLatestPreQuoteForQuotation("quote-x");
    expect(afterDelete?.id).toBe(firstId);
    await expect(source.deletePreQuote(9999)).resolves.toBe(false);
  });

  it("lista pré-orçamentos com seus itens", async () => {
    const source = createCatalogSource(database);
    await source.createPreQuote(
      preQuoteInput([
        {
          itemOrder: 1,
          name: "Item A",
          description: "",
          unit: "UN",
          quantity: 1,
          referenceValue: null,
          supplierId: null,
          catalogItemId: null,
          unitCost: 9.9,
          source: "manual"
        }
      ])
    );

    const list = await source.listPreQuotes();
    expect(list).toHaveLength(1);
    expect(list[0].items).toHaveLength(1);
    expect(list[0].items[0].name).toBe("Item A");
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
