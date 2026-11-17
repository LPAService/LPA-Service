import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Integration tests for the schools data layer.
 * Runs against lpa_leo_test — drops and recreates the schema each run.
 *
 * We import the FUNCTIONS under test dynamically so they use our test pool
 * via the DATABASE_URL env var that vitest.config.ts already sets.
 */

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://lpa:lpa@localhost:5432/lpa_leo_test";
const migrationFiles = readdirSync(resolve(process.cwd(), "drizzle"))
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => `drizzle/${name}`);
const dbTestLockKey = 941_445_019; // different from bids test

describe("escolas integration", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    try {
      await pool.query("select 1");
    } catch (error) {
      throw new Error(
        `Postgres real indisponível em ${databaseUrl}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    await pool.query("select pg_advisory_lock($1)", [dbTestLockKey]);
  }, 30_000);

  beforeEach(async () => {
    await resetDatabase(pool);
    await seedSchoolsData(pool);
  }, 30_000);

  afterAll(async () => {
    await pool.query("select pg_advisory_unlock($1)", [dbTestLockKey]);
    await pool.end();
  });

  it("listSchools returns all schools in RMBH scope", async () => {
    const { listSchools } = await import("@/lib/data/schools");
    const schools = await listSchools();
    // We seeded 3 schools, 2 in RMBH counties and 1 outside
    expect(schools.length).toBe(2);
    expect(schools.map((s) => s.name).sort()).toEqual([
      "EE ANTONIO CARLOS",
      "EE MARIA SILVA",
    ]);
  });

  it("listSchools filters by city", async () => {
    const { listSchools } = await import("@/lib/data/schools");
    const schools = await listSchools({ city: "Contagem" });
    expect(schools.length).toBe(1);
    expect(schools[0].name).toBe("EE ANTONIO CARLOS");
  });

  it("listSchools filters by city case-insensitively", async () => {
    const { listSchools } = await import("@/lib/data/schools");
    const schools = await listSchools({ city: "contagem" });
    expect(schools.length).toBe(1);
    expect(schools[0].name).toBe("EE ANTONIO CARLOS");
  });

  it("listSchools filters by query (name search)", async () => {
    const { listSchools } = await import("@/lib/data/schools");
    const schools = await listSchools({ query: "antonio" });
    expect(schools.length).toBe(1);
    expect(schools[0].name).toBe("EE ANTONIO CARLOS");
  });

  it("listSchools filters by city + query combined", async () => {
    const { listSchools } = await import("@/lib/data/schools");
    const schools = await listSchools({ city: "Contagem", query: "antonio" });
    expect(schools.length).toBe(1);

    const none = await listSchools({ city: "Belo Horizonte", query: "antonio" });
    expect(none.length).toBe(0);
  });

  it("listSchools returns correct open quotation counts", async () => {
    const { listSchools } = await import("@/lib/data/schools");
    const schools = await listSchools();
    const antonio = schools.find((s) => s.name === "EE ANTONIO CARLOS");
    expect(antonio).toBeDefined();
    // 1 open quotation seeded for this school
    expect(antonio!.openQuotations).toBe(1);
    expect(antonio!.totalQuotations).toBe(2);
  });

  it("getSchool returns null for id above int4 range", async () => {
    const { getSchool } = await import("@/lib/data/schools");
    const result = await getSchool(3_000_000_000);
    expect(result).toBeNull();
  });

  it("getSchool returns null for negative id", async () => {
    const { getSchool } = await import("@/lib/data/schools");
    const result = await getSchool(-1);
    expect(result).toBeNull();
  });

  it("getSchool returns null for non-integer id", async () => {
    const { getSchool } = await import("@/lib/data/schools");
    const result = await getSchool(1.5);
    expect(result).toBeNull();
  });

  it("getSchool returns school with counts for valid id", async () => {
    const { getSchool } = await import("@/lib/data/schools");
    const school = await getSchool(1001);
    expect(school).not.toBeNull();
    expect(school!.name).toBe("EE ANTONIO CARLOS");
    expect(school!.openQuotations).toBe(1);
  });

  it("getSchoolQuotations returns empty array for int4 overflow id", async () => {
    const { getSchoolQuotations } = await import("@/lib/data/schools");
    const rows = await getSchoolQuotations(3_000_000_000);
    expect(rows).toEqual([]);
  });

  it("getSchoolOpportunities returns empty array for int4 overflow id", async () => {
    const { getSchoolOpportunities } = await import("@/lib/data/schools");
    const rows = await getSchoolOpportunities(3_000_000_000);
    expect(rows).toEqual([]);
  });

  it("listSchoolCities returns distinct sorted cities", async () => {
    const { listSchoolCities } = await import("@/lib/data/schools");
    const cities = await listSchoolCities();
    expect(cities).toEqual(["Belo Horizonte", "Contagem"]);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

async function seedSchoolsData(pool: Pool) {
  // We need to know RMBH county IDs. The app uses rmbh-counties.json.
  // Pick two real IDs from that file: Contagem (2340) and BH (2546).
  const contagemCountyId = 2340;
  const bhCountyId = 2546;
  const outsideCountyId = 9999;

  // Insert schools
  await pool.query(
    `INSERT INTO schools (id_school, name, id_county, city, regional, raw_json)
     VALUES
       (1001, 'EE ANTONIO CARLOS', $1, 'Contagem', 'Metropolitana C', '{}'),
       (1002, 'EE MARIA SILVA', $2, 'Belo Horizonte', 'Metropolitana A', '{}'),
       (1003, 'EE FORA DA RMBH', $3, 'Montes Claros', 'Norte', '{}')`,
    [contagemCountyId, bhCountyId, outsideCountyId]
  );

  const futureDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const pastDeadline = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

  // Insert open quotation for school 1001
  await pool.query(
    `INSERT INTO quotations (
       external_id, nu_budget_order, id_subprogram, id_school, id_budget,
       id_county, county_name, school_name, expense_group,
       headline, summary, top_items,
       proposal_deadline, item_count, proposal_url, raw_json
     ) VALUES (
       'q-open-1', '11111', 100, 1001, 200,
       $1, 'Contagem', 'EE ANTONIO CARLOS', 'Material de Consumo',
       'Material escolar', 'Resumo material escolar', '[]',
       $2, 5, 'https://example.com/q1', '{}'
     )`,
    [contagemCountyId, futureDeadline]
  );

  // Insert closed quotation for school 1001
  await pool.query(
    `INSERT INTO quotations (
       external_id, nu_budget_order, id_subprogram, id_school, id_budget,
       id_county, county_name, school_name, expense_group,
       headline, summary, top_items,
       proposal_deadline, item_count, proposal_url, raw_json
     ) VALUES (
       'q-closed-1', '22222', 101, 1001, 201,
       $1, 'Contagem', 'EE ANTONIO CARLOS', 'Material Permanente',
       'Equipamentos', 'Resumo equipamentos', '[]',
       $2, 3, 'https://example.com/q2', '{}'
     )`,
    [contagemCountyId, pastDeadline]
  );

  // Insert an opportunity for school 1001
  await pool.query(
    `INSERT INTO opportunities (
       external_id, order_id, source_url, id_subprogram, id_school, id_budget,
       school, city, regional, expense_group, subprogram, year,
       item_count, raw_json
     ) VALUES (
       'o-1', 'ORD-1', 'https://example.com/o1', 100, 1001, 200,
       'EE ANTONIO CARLOS', 'Contagem', 'Metropolitana C', 'Material de Consumo', 'Sub 1', '2024',
       2, '{}'
     )`
  );
}
