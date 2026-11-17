import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Integration tests for school favorites.
 * Runs against lpa_leo_test — drops and recreates the schema each run (applies every migration file).
 *
 * Functions under test are imported dynamically so they use the pool bound to
 * DATABASE_URL (vitest.config.ts sets it from TEST_DATABASE_URL).
 */

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://lpa:lpa@localhost:5432/lpa_leo_test";
const migrationFiles = readdirSync(resolve(process.cwd(), "drizzle"))
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => `drizzle/${name}`);
const dbTestLockKey = 941_445_020; // different from escolas and bids tests

const CONTAGEM = 1001; // in RMBH scope
const BELO_HORIZONTE = 1002; // in RMBH scope
const OUTSIDE_SCOPE = 1003; // not in RMBH scope

describe("escolas favoritos integration", () => {
  let pool: Pool;
  let userA: number;
  let userB: number;

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
    userA = await seedUser(pool, "favorito-a@lpa.local", "Usuária A");
    userB = await seedUser(pool, "favorito-b@lpa.local", "Usuário B");
  }, 30_000);

  afterAll(async () => {
    await pool.query("select pg_advisory_unlock($1)", [dbTestLockKey]);
    await pool.end();
  });

  it("setSchoolFavorite grava o favorito do usuário", async () => {
    const { setSchoolFavorite } = await import("@/lib/data/schools");
    const result = await setSchoolFavorite(userA, CONTAGEM, true);
    expect(result).toEqual({ ok: true, isFavorite: true });
    expect(await favoritesOf(pool, userA)).toEqual([CONTAGEM]);
  });

  it("favoritar duas vezes mantém uma linha só (idempotente)", async () => {
    const { setSchoolFavorite } = await import("@/lib/data/schools");
    await setSchoolFavorite(userA, CONTAGEM, true);
    const again = await setSchoolFavorite(userA, CONTAGEM, true);
    expect(again).toEqual({ ok: true, isFavorite: true });
    expect(await favoritesOf(pool, userA)).toEqual([CONTAGEM]);
  });

  it("desfavoritar remove só a linha desse usuário", async () => {
    const { setSchoolFavorite } = await import("@/lib/data/schools");
    await setSchoolFavorite(userA, CONTAGEM, true);
    await setSchoolFavorite(userB, CONTAGEM, true);

    const result = await setSchoolFavorite(userA, CONTAGEM, false);
    expect(result).toEqual({ ok: true, isFavorite: false });
    expect(await favoritesOf(pool, userA)).toEqual([]);
    expect(await favoritesOf(pool, userB)).toEqual([CONTAGEM]);

    // desfavoritar de novo é seguro (idempotente)
    const again = await setSchoolFavorite(userA, CONTAGEM, false);
    expect(again).toEqual({ ok: true, isFavorite: false });
  });

  it("listSchools com favoritesOnly devolve só as favoritas do usuário logado", async () => {
    const { setSchoolFavorite, listSchools } = await import("@/lib/data/schools");
    await setSchoolFavorite(userA, CONTAGEM, true);
    await setSchoolFavorite(userA, BELO_HORIZONTE, true);
    await setSchoolFavorite(userB, BELO_HORIZONTE, true);

    const forA = await listSchools({ userId: userA, favoritesOnly: true });
    expect(forA.map((s) => s.name).sort()).toEqual(["EE ANTONIO CARLOS", "EE MARIA SILVA"]);
    expect(forA.every((s) => s.isFavorite)).toBe(true);

    const forB = await listSchools({ userId: userB, favoritesOnly: true });
    expect(forB.map((s) => s.name)).toEqual(["EE MARIA SILVA"]);
  });

  it("outro usuário não vê os favoritos de quem favoritou", async () => {
    const { setSchoolFavorite, listSchools } = await import("@/lib/data/schools");
    await setSchoolFavorite(userA, CONTAGEM, true);

    const forB = await listSchools({ userId: userB, favoritesOnly: true });
    expect(forB).toEqual([]);
  });

  it("favoritesOnly sem usuário válido devolve lista vazia", async () => {
    const { setSchoolFavorite, listSchools } = await import("@/lib/data/schools");
    await setSchoolFavorite(userA, CONTAGEM, true);

    expect(await listSchools({ userId: null, favoritesOnly: true })).toEqual([]);
    expect(await listSchools({ userId: 0, favoritesOnly: true })).toEqual([]);
    expect(await listSchools({ favoritesOnly: true })).toEqual([]);
  });

  it("listSchools marca isFavorite só para o usuário informado", async () => {
    const { setSchoolFavorite, listSchools } = await import("@/lib/data/schools");
    await setSchoolFavorite(userA, CONTAGEM, true);

    const forA = await listSchools({ userId: userA });
    expect(forA.find((s) => s.idSchool === CONTAGEM)?.isFavorite).toBe(true);
    expect(forA.find((s) => s.idSchool === BELO_HORIZONTE)?.isFavorite).toBe(false);

    const forB = await listSchools({ userId: userB });
    expect(forB.every((s) => s.isFavorite === false)).toBe(true);

    const anonymous = await listSchools();
    expect(anonymous.every((s) => s.isFavorite === false)).toBe(true);
  });

  it("favoritas respeitam os filtros de cidade e busca", async () => {
    const { setSchoolFavorite, listSchools } = await import("@/lib/data/schools");
    await setSchoolFavorite(userA, CONTAGEM, true);
    await setSchoolFavorite(userA, BELO_HORIZONTE, true);

    const contagem = await listSchools({ userId: userA, favoritesOnly: true, city: "Contagem" });
    expect(contagem.map((s) => s.name)).toEqual(["EE ANTONIO CARLOS"]);

    const busca = await listSchools({ userId: userA, favoritesOnly: true, query: "maria" });
    expect(busca.map((s) => s.name)).toEqual(["EE MARIA SILVA"]);
  });

  it("getSchool traz isFavorite para o usuário informado", async () => {
    const { setSchoolFavorite, getSchool } = await import("@/lib/data/schools");
    await setSchoolFavorite(userA, CONTAGEM, true);

    expect((await getSchool(CONTAGEM, userA))?.isFavorite).toBe(true);
    expect((await getSchool(CONTAGEM, userB))?.isFavorite).toBe(false);
    expect((await getSchool(CONTAGEM))?.isFavorite).toBe(false);
  });

  it("countFavoriteSchools conta só as favoritas do usuário dentro do escopo", async () => {
    const { setSchoolFavorite, countFavoriteSchools } = await import("@/lib/data/schools");
    await setSchoolFavorite(userA, CONTAGEM, true);
    await setSchoolFavorite(userA, BELO_HORIZONTE, true);
    // linha antiga, gravada antes da regra de escopo: a contagem precisa ignorá-la
    await pool.query("insert into user_school_favorites (user_id, id_school) values ($1, $2)", [
      userA,
      OUTSIDE_SCOPE,
    ]);

    expect(await countFavoriteSchools(userA)).toBe(2);
    expect(await countFavoriteSchools(userB)).toBe(0);
    expect(await countFavoriteSchools(null)).toBe(0);
  });

  it("setSchoolFavorite rejeita ids inválidos e escola inexistente sem gravar nada", async () => {
    const { setSchoolFavorite } = await import("@/lib/data/schools");

    expect(await setSchoolFavorite(0, CONTAGEM, true)).toEqual({ ok: false, reason: "invalid_user" });
    expect(await setSchoolFavorite(3_000_000_000, CONTAGEM, true)).toEqual({
      ok: false,
      reason: "invalid_user",
    });
    expect(await setSchoolFavorite(userA, 3_000_000_000, true)).toEqual({
      ok: false,
      reason: "invalid_school",
    });
    expect(await setSchoolFavorite(userA, 1.5, true)).toEqual({ ok: false, reason: "invalid_school" });
    expect(await setSchoolFavorite(userA, -1, true)).toEqual({ ok: false, reason: "invalid_school" });
    expect(await setSchoolFavorite(userA, 4242, true)).toEqual({
      ok: false,
      reason: "school_not_found",
    });

    expect(await favoritesOf(pool, userA)).toEqual([]);
  });

  it("escola fora do escopo RMBH é recusada e nada é gravado", async () => {
    const { setSchoolFavorite, listSchools } = await import("@/lib/data/schools");

    expect(await setSchoolFavorite(userA, OUTSIDE_SCOPE, true)).toEqual({
      ok: false,
      reason: "out_of_scope",
    });
    expect(await favoritesOf(pool, userA)).toEqual([]);

    // a lista também não mostra essa escola, então a aba Favoritas fica coerente
    expect(await listSchools({ userId: userA })).not.toContainEqual(
      expect.objectContaining({ idSchool: OUTSIDE_SCOPE })
    );
  });

  it("usuário inexistente (sessão antiga) é recusado sem lançar erro e não grava", async () => {
    const { setSchoolFavorite } = await import("@/lib/data/schools");
    expect(await setSchoolFavorite(999_999, CONTAGEM, true)).toEqual({
      ok: false,
      reason: "user_not_found",
    });
    const rows = await pool.query("select count(*)::int as total from user_school_favorites");
    expect(rows.rows[0].total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function favoritesOf(pool: Pool, userId: number): Promise<number[]> {
  const result = await pool.query<{ id_school: number }>(
    "select id_school from user_school_favorites where user_id = $1 order by id_school",
    [userId]
  );
  return result.rows.map((r) => r.id_school);
}

async function seedUser(pool: Pool, email: string, name: string): Promise<number> {
  const result = await pool.query<{ id: number }>(
    "insert into users (email, password, name) values ($1, 'hash-de-teste', $2) returning id",
    [email, name]
  );
  return result.rows[0].id;
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

async function seedSchoolsData(pool: Pool) {
  // Pick real RMBH county ids from rmbh-counties.json: Contagem (2340) and BH (2546).
  const contagemCountyId = 2340;
  const bhCountyId = 2546;
  const outsideCountyId = 9999;

  await pool.query(
    `INSERT INTO schools (id_school, name, id_county, city, regional, raw_json)
     VALUES
       (1001, 'EE ANTONIO CARLOS', $1, 'Contagem', 'Metropolitana C', '{}'),
       (1002, 'EE MARIA SILVA', $2, 'Belo Horizonte', 'Metropolitana A', '{}'),
       (1003, 'EE FORA DA RMBH', $3, 'Montes Claros', 'Norte', '{}')`,
    [contagemCountyId, bhCountyId, outsideCountyId]
  );
}
