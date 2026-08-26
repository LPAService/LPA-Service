import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createWatchStore } from "@/lib/watch/store";
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

describe("WatchStore", () => {
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

  it("inicia sem cotações acompanhadas e ignora identificador vazio", async () => {
    const store = createWatchStore(database);
    const [user] = await createUser(database);

    await expect(store.isWatched(user.id, "quote-1")).resolves.toBe(false);
    await expect(store.listWatchedExternalIds(user.id)).resolves.toEqual([]);
    await expect(store.setWatched(user.id, "   ", true)).resolves.toBe(false);
    await expect(store.setWatched(0, "quote-1", true)).resolves.toBe(false);
  });

  it("acompanha e deixa de acompanhar cotação", async () => {
    const store = createWatchStore(database);
    const [user] = await createUser(database);

    await expect(store.setWatched(user.id, "quote-1", true)).resolves.toBe(true);
    await expect(store.isWatched(user.id, "quote-1")).resolves.toBe(true);
    await expect(store.listWatchedExternalIds(user.id)).resolves.toEqual(["quote-1"]);

    await expect(store.setWatched(user.id, "quote-1", false)).resolves.toBe(false);
    await expect(store.isWatched(user.id, "quote-1")).resolves.toBe(false);
    await expect(store.listWatchedExternalIds(user.id)).resolves.toEqual([]);
  });

  it("acompanhar duas vezes não duplica registro", async () => {
    const store = createWatchStore(database);
    const [user] = await createUser(database);

    await store.setWatched(user.id, "quote-1", true);
    await store.setWatched(user.id, "quote-1", true);

    const rows = await database
      .select({ id: schema.watchedQuotations.id })
      .from(schema.watchedQuotations)
      .where(sql`${schema.watchedQuotations.userId} = ${user.id}`);
    expect(rows).toHaveLength(1);
  });

  it("isola por usuário: A acompanhando não aparece para B", async () => {
    const store = createWatchStore(database);
    const [userA] = await createUser(database);
    const [userB] = await createUser(database);

    await store.setWatched(userA.id, "quote-1", true);

    await expect(store.isWatched(userA.id, "quote-1")).resolves.toBe(true);
    await expect(store.isWatched(userB.id, "quote-1")).resolves.toBe(false);
    await expect(store.listWatchedExternalIds(userA.id)).resolves.toEqual(["quote-1"]);
    await expect(store.listWatchedExternalIds(userB.id)).resolves.toEqual([]);

    await store.setWatched(userB.id, "quote-1", true);
    await expect(store.listWatchedExternalIds(userA.id)).resolves.toEqual(["quote-1"]);
    await expect(store.listWatchedExternalIds(userB.id)).resolves.toEqual(["quote-1"]);

    await store.setWatched(userA.id, "quote-1", false);
    await expect(store.listWatchedExternalIds(userA.id)).resolves.toEqual([]);
    await expect(store.isWatched(userB.id, "quote-1")).resolves.toBe(true);
  });
});

async function createUser(database: NodePgDatabase<typeof schema>) {
  return database
    .insert(schema.users)
    .values({ email: `user-${crypto.randomUUID()}@test.local`, password: "x" })
    .returning({ id: schema.users.id });
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