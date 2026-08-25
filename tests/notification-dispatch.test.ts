import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dispatchQuotationNotifications } from "@/lib/notify/dispatch";
import type { SendEmail } from "@/lib/notify/email";
import * as schema from "@/lib/db/schema";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://lpa:lpa@localhost:5432/lpa_leo_test";
const dbTestLockKey = 941_445_900;

const migrationFiles = readdirSync(resolve(process.cwd(), "drizzle"))
  .filter((name) => name.endsWith(".sql"))
  .sort();

describe("dispatchQuotationNotifications em Postgres real", () => {
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

  async function seedQuotation(partial: Partial<typeof schema.quotations.$inferInsert>) {
    const [row] = await database
      .insert(schema.quotations)
      .values({
        externalId: `test-${Math.random().toString(36).slice(2)}`,
        idSubprogram: 12,
        idSchool: 34,
        idBudget: 56,
        schoolName: "E.E. Teste",
        expenseGroup: "Material de Consumo",
        headline: "Aquisição de itens",
        summary: "Resumo da cotação",
        proposalUrl: "https://example.com/proposta",
        ...partial
      })
      .returning({ id: schema.quotations.id });
    return row.id;
  }

  it("cria notificação só para assinaturas que batem e envia um email por usuário", async () => {
    const [userA] = await database
      .insert(schema.users)
      .values({ email: "fornecedor@exemplo.com", password: "x", name: "Fornecedor A" })
      .returning({ id: schema.users.id });
    const [userB] = await database
      .insert(schema.users)
      .values({ email: "outro@exemplo.com", password: "x", name: "Fornecedor B" })
      .returning({ id: schema.users.id });
    const [category] = await database
      .insert(schema.categories)
      .values({ slug: "tecnologia", name: "Tecnologia" })
      .returning({ id: schema.categories.id });

    await database.insert(schema.notificationSubscriptions).values({
      userId: userA.id,
      categoryId: category.id,
      city: "Contagem",
      school: null,
      keyword: null
    });
    await database.insert(schema.notificationSubscriptions).values({
      userId: userB.id,
      categoryId: null,
      city: null,
      school: null,
      keyword: "arroz"
    });

    const matchingId = await seedQuotation({
      schoolName: "E.E. Maria da Silva",
      countyName: "Contagem",
      categoryId: category.id,
      headline: "Merenda escolar",
      summary: "Aquisição de gêneros alimentícios"
    });
    await seedQuotation({
      schoolName: "E.E. Outra",
      countyName: "Betim",
      categoryId: null,
      headline: "Tinta para pintura",
      summary: "Manutenção predial"
    });

    const emailsSent: Array<{ to: string; subject: string }> = [];
    const sendEmail: SendEmail = async (email) => {
      emailsSent.push({ to: email.to, subject: email.subject });
      return { sent: true };
    };

    const result = await dispatchQuotationNotifications({
      database,
      since: new Date(0),
      sendEmail,
      baseUrl: "http://localhost:3000"
    });

    expect(result.notificationsCreated).toBe(1);
    expect(result.emailsSent).toBe(1);
    expect(emailsSent).toHaveLength(1);
    expect(emailsSent[0]!.to).toBe("fornecedor@exemplo.com");
    expect(emailsSent[0]!.subject).toContain("1 nova cotação");

    const rows = await database.select().from(schema.notifications);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(userA.id);
    expect(rows[0]!.quotationId).toBe(matchingId);
    expect(rows[0]!.emailedAt).not.toBeNull();
  });

  it("re-dispatch é idempotente (unique por usuário+cotação)", async () => {
    const [user] = await database
      .insert(schema.users)
      .values({ email: "idem@exemplo.com", password: "x" })
      .returning({ id: schema.users.id });
    await database.insert(schema.notificationSubscriptions).values({
      userId: user.id,
      categoryId: null,
      city: "Contagem",
      school: null,
      keyword: null
    });
    await seedQuotation({ countyName: "Contagem", categoryId: null });

    const sendEmail: SendEmail = async () => ({ sent: true });
    const first = await dispatchQuotationNotifications({ database, since: new Date(0), sendEmail });
    const second = await dispatchQuotationNotifications({ database, since: new Date(0), sendEmail });

    expect(first.notificationsCreated).toBe(1);
    expect(second.notificationsCreated).toBe(0);
    expect(second.emailsSent).toBe(0);

    const rows = await database.select().from(schema.notifications);
    expect(rows).toHaveLength(1);
  });

  it("sem novas cotações no período, não faz nada", async () => {
    const result = await dispatchQuotationNotifications({ database, since: new Date() });
    expect(result.notificationsCreated).toBe(0);
    expect(result.emailsSent).toBe(0);
  });
});

async function resetDatabase(pool: Pool) {
  await pool.query("drop schema if exists public cascade");
  await pool.query("create schema public");

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
