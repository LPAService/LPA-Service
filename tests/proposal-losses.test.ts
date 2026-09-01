import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createProposalLossAnalytics } from "@/lib/analytics/proposal-losses";
import {
  buildProposalLossRecord,
  calculateLossGapPercent,
  collectProposalLossesWithClient,
  DrizzleProposalLossRepository,
  type ProposalLossRepository
} from "@/lib/collector/proposal-losses";
import type { BudgetProposalRecord, DetailRecord, SummaryRecord } from "@/lib/collector/quotations";
import * as schema from "@/lib/db/schema";

type FixtureLoss = {
  summary: SummaryRecord;
  detail: DetailRecord;
  proposals: BudgetProposalRecord[];
};

type Fixture = {
  losses: FixtureLoss[];
};

const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), "tests/fixtures/proposal-losses.json"), "utf8")
) as Fixture;

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
  "drizzle/0010_sudden_zeigeist.sql",
  "drizzle/0011_striped_bloodaxe.sql",
  "drizzle/0012_reference_products_search.sql",
  "drizzle/0013_proposal_losses.sql"
];
const dbTestLockKey = 941_445_004;

describe("proposal losses", () => {
  it("calcula posição e diferença dos casos reais de conferência", () => {
    const expected = [
      ["2026177780", 6, 10965.9, 9135.08, "MUNDO ESCOLAR", 20.0, 5],
      ["2026162267", 5, 15443.07, 4680.46, "JLB", 229.9, 5],
      ["2026164089", 2, 39604.56, 17720.1, "Fornecedor alimentos", 123.5, 2]
    ] as const;

    for (const [orderId, competitors, ourTotal, winnerTotal, winnerName, gapPct, rank] of expected) {
      const source = fixture.losses.find((loss) => String(loss.summary.nuBudgetOrder) === orderId)!;
      const record = buildProposalLossRecord(source.summary, source.detail, source.proposals);

      expect(record).toMatchObject({
        orderId,
        competitorCount: competitors,
        ourTotal,
        winnerTotal,
        winnerName,
        ourRank: rank
      });
      expect(round1(calculateLossGapPercent(record.ourTotal, record.winnerTotal))).toBe(gapPct);
    }
  });

  it("registra vencedor ausente sem inventar total", () => {
    const source = fixture.losses.find((loss) => String(loss.summary.nuBudgetOrder) === "2026171050")!;
    const record = buildProposalLossRecord(source.summary, source.detail, source.proposals);

    expect(record.winnerSupplierId).toBe(999999);
    expect(record.winnerName).toBeNull();
    expect(record.winnerTotal).toBeNull();
    expect(calculateLossGapPercent(record.ourTotal, record.winnerTotal)).toBeNull();
  });

  it("coleta perdas paginadas e mantém upsert idempotente no contrato", async () => {
    const repository = new FakeProposalLossRepository();
    const first = await collectProposalLossesWithClient(new FakeProposalLossClient(), repository, {
      pageSize: 2,
      sleepFn: async () => undefined
    });
    const second = await collectProposalLossesWithClient(new FakeProposalLossClient(), repository, {
      pageSize: 2,
      sleepFn: async () => undefined
    });

    expect(first).toMatchObject({ found: 4, newCount: 4, updatedCount: 0, errorCount: 0 });
    expect(second).toMatchObject({ found: 4, newCount: 0, updatedCount: 4, errorCount: 0 });
    expect(repository.rows.size).toBe(4);
  });
});

describe("DrizzleProposalLossRepository", () => {
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

  it("upsert por order_id não duplica e alimenta analytics", async () => {
    const repository = new DrizzleProposalLossRepository(database);
    const rows = fixture.losses.slice(0, 3).map((loss) =>
      buildProposalLossRecord(loss.summary, loss.detail, loss.proposals)
    );

    for (const row of rows) {
      expect(await repository.upsertProposalLoss(row)).toBe("new");
      expect(await repository.upsertProposalLoss({ ...row, competitorCount: row.competitorCount + 1 })).toBe("updated");
    }

    const count = await database.execute<{ count: string }>(
      sql`select count(*)::text as count from ${schema.proposalLosses}`
    );
    expect(Number(count.rows[0]?.count)).toBe(3);

    const analytics = createProposalLossAnalytics(database);
    const groups = await analytics.getLossesByExpenseGroup();
    const winners = await analytics.getWinningCompetitors();
    const losses = await analytics.listLosses();

    const materialGroup = groups.find((group) => group.expenseGroup === "Material de Consumo Geral");
    expect(materialGroup?.lossCount).toBe(2);
    expect(materialGroup?.medianPriceGapPct).toBeCloseTo(125, 1);
    expect(winners.find((winner) => winner.winnerName === "JLB")).toMatchObject({ wins: 1 });
    expect(losses.find((loss) => loss.orderId === "2026177780")?.lossGapPercent).toBeCloseTo(20.0, 1);
  });
});

class FakeProposalLossClient {
  async listRejectedQuotations(page: number, limit: number) {
    const start = (page - 1) * limit;
    const data = fixture.losses.slice(start, start + limit).map((loss) => loss.summary);
    return { data, meta: { totalPages: Math.ceil(fixture.losses.length / limit) } };
  }

  async getBudgetDetail(record: SummaryRecord) {
    return fixture.losses.find((loss) => loss.summary.idBudget === record.idBudget)!.detail;
  }

  async listBudgetProposals(record: SummaryRecord) {
    return fixture.losses.find((loss) => loss.summary.idBudget === record.idBudget)!.proposals;
  }
}

class FakeProposalLossRepository implements ProposalLossRepository {
  rows = new Map<string, unknown>();
  private run = 0;

  async startRun() {
    return ++this.run;
  }

  async finishRun() {}

  async upsertProposalLoss(record: { orderId: string }) {
    const exists = this.rows.has(record.orderId);
    this.rows.set(record.orderId, record);
    return exists ? "updated" as const : "new" as const;
  }
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

function round1(value: number | null) {
  if (value === null) return null;
  return Math.round(value * 10) / 10;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
