import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { findReferenceByEan, searchReferenceProducts } from "@/lib/catalog/reference";
import { referenceProducts } from "@/lib/db/schema";
import * as schema from "@/lib/db/schema";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://lpa:lpa@localhost:5432/lpa_leo_test";
const referenceDbLockKey = 941_445_009;

describe("reference products query layer", () => {
  let pool: Pool;
  let database: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query("select pg_advisory_lock($1)", [referenceDbLockKey]);
    await pool.query("drop table if exists reference_products cascade");
    const sqlText = readFileSync(
      resolve(process.cwd(), "drizzle/0011_striped_bloodaxe.sql"),
      "utf8"
    );
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
    await pool.query("select pg_advisory_unlock($1)", [referenceDbLockKey]);
    await pool.end();
  });

  it("busca por nome normalizado ignorando case e acento", async () => {
    await database.insert(referenceProducts).values([
      {
        source: "cescom",
        externalId: "25558",
        name: "CREME DE LEITE LEVE TP ITALAC",
        normalizedName: "creme de leite leve tp italac",
        ean: "7898080640222",
        brand: "ITALAC"
      },
      {
        source: "cescom",
        externalId: "30102",
        name: "DETERGENTE NEUTRO 5L",
        normalizedName: "detergente neutro 5l",
        ean: "7896031159028",
        brand: "YPE"
      }
    ]);

    const results = await searchReferenceProducts(database, "Creme de Leite", 10);

    expect(results).toHaveLength(1);
    expect(results[0].externalId).toBe("25558");
    expect(results[0].ean).toBe("7898080640222");
  });

  it("retorna vazio para query em branco", async () => {
    expect(await searchReferenceProducts(database, "   ", 10)).toEqual([]);
  });

  it("encontra produto pelo EAN exato", async () => {
    await database.insert(referenceProducts).values({
      source: "cescom",
      externalId: "30102",
      name: "DETERGENTE NEUTRO 5L",
      normalizedName: "detergente neutro 5l",
      ean: "7896031159028",
      brand: "YPE"
    });

    const found = await findReferenceByEan(database, "7896031159028");
    const missing = await findReferenceByEan(database, "0000000000000");

    expect(found?.externalId).toBe("30102");
    expect(missing).toBeNull();
  });
});
