import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cescomCatalogCount, loadCescomCatalog } from "@/lib/catalog/cescom-loader";
import { matchReferenceProducts } from "@/lib/catalog/reference-match";
import * as schema from "@/lib/db/schema";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://lpa:lpa@localhost:5432/lpa_leo_test";
const cescomCatalogDbLockKey = 941_445_011;

describe("loadCescomCatalog", () => {
  let pool: Pool;
  let database: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query("select pg_advisory_lock($1)", [cescomCatalogDbLockKey]);
    await pool.query("drop table if exists reference_products cascade");
    const sqlText = [
      readFileSync(resolve(process.cwd(), "drizzle/0011_striped_bloodaxe.sql"), "utf8"),
      readFileSync(resolve(process.cwd(), "drizzle/0012_reference_products_search.sql"), "utf8")
    ].join("--> statement-breakpoint");
    const statements = sqlText
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await pool.query(statement);
    }
    database = drizzle(pool, { schema });
  }, 30_000);

  beforeEach(async () => {
    await pool.query("truncate reference_products restart identity");
  }, 30_000);

  afterAll(async () => {
    await pool.query("select pg_advisory_unlock($1)", [cescomCatalogDbLockKey]);
    await pool.end();
  });

  it("carrega o catalogo Cescom em banco vazio", async () => {
    const result = await loadCescomCatalog(database);
    const count = await countReferenceProducts(pool);

    expect(result).toMatchObject({
      source: "cescom",
      fileRows: cescomCatalogCount(),
      existingRows: 0,
      processedRows: cescomCatalogCount(),
      skipped: false
    });
    expect(count).toBe(cescomCatalogCount());
  }, 30_000);

  it("sai cedo quando a segunda carga já encontra a mesma contagem", async () => {
    await loadCescomCatalog(database);
    const second = await loadCescomCatalog(database);
    const count = await countReferenceProducts(pool);

    expect(second).toMatchObject({
      fileRows: cescomCatalogCount(),
      existingRows: cescomCatalogCount(),
      processedRows: 0,
      skipped: true
    });
    expect(count).toBe(cescomCatalogCount());
  }, 30_000);

  it("permite busca real por macarrao apos a carga", async () => {
    await loadCescomCatalog(database);

    const matches = await matchReferenceProducts(database, "Macarrao espaguete 500g", 3, {
      categorySlug: "alimentos",
      categoryName: "Alimentos",
      expenseGroup: "Generos Alimenticios"
    });

    expect(matches.some((match) => match.item.normalizedName.includes("macarrao"))).toBe(true);
  }, 30_000);
});

async function countReferenceProducts(pool: Pool): Promise<number> {
  const result = await pool.query<{ count: string }>(
    "select count(*)::text as count from reference_products where source = 'cescom'"
  );
  return Number(result.rows[0]?.count ?? 0);
}
