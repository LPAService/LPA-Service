import { and, desc, eq, gt, sql } from "drizzle-orm";
import { CaixaEscolarClient } from "@/lib/collector/client";
import { collectOpportunities, type CollectionError } from "@/lib/collector/collect";
import { collectOpenQuotations } from "@/lib/collector/quotations";
import rmbhCounties from "@/lib/collector/rmbh-counties.json";
import { collectionRuns } from "@/lib/db/schema";

export const DAILY_SYNC_TIMEOUT_MS = 270_000;
export const DAILY_SYNC_RUNNING_WINDOW_MS = 330_000;
const DAILY_SYNC_LOCK_KEY = 849_016_275;

export type DailySyncSummary = {
  runId: number;
  found: number;
  new: number;
  updated: number;
  errors: CollectionError[];
  durationMs: number;
  countiesProcessed: number;
  quotationRun?: {
    found: number;
    new: number;
    updated: number;
    errors: CollectionError[];
  };
};

export class DailySyncAlreadyRunningError extends Error {
  constructor(public readonly runId: number) {
    super(`Sync diário já está em execução (run ${runId})`);
    this.name = "DailySyncAlreadyRunningError";
  }
}

type DailySyncDependencies = {
  startRun: () => Promise<number>;
  finishRun: (runId: number, summary: DailySyncSummary, status: "completed" | "failed") => Promise<void>;
  collectCounty: (county: { idCounty: number; name: string }) => Promise<{
    found: number;
    newCount: number;
    updatedCount: number;
    errors: CollectionError[];
  }>;
  collectQuotations?: () => Promise<{
    found: number;
    newCount: number;
    updatedCount: number;
    errors: CollectionError[];
  }>;
  now?: () => number;
  timeoutMs?: number;
};

export async function runDailySync(
  dependencies?: DailySyncDependencies
): Promise<DailySyncSummary> {
  const activeDependencies = dependencies ?? (await createDefaultDependencies());
  const now = activeDependencies.now ?? Date.now;
  const timeoutMs = activeDependencies.timeoutMs ?? DAILY_SYNC_TIMEOUT_MS;
  const startedAt = now();
  const runId = await activeDependencies.startRun();
  const summary: DailySyncSummary = {
    runId,
    found: 0,
    new: 0,
    updated: 0,
    errors: [],
    durationMs: 0,
    countiesProcessed: 0
  };

  try {
    if (activeDependencies.collectQuotations) {
      try {
        const quotations = await activeDependencies.collectQuotations();
        summary.quotationRun = {
          found: quotations.found,
          new: quotations.newCount,
          updated: quotations.updatedCount,
          errors: quotations.errors
        };
        summary.found += quotations.found;
        summary.new += quotations.newCount;
        summary.updated += quotations.updatedCount;
        summary.errors.push(
          ...quotations.errors.map((error) => ({
            ...error,
            message: `[Cotações abertas] ${error.message}`
          }))
        );
      } catch (error) {
        summary.errors.push({ message: `[Cotações abertas] ${errorMessage(error)}` });
      }
    }

    for (const county of rmbhCounties.collected) {
      if (now() - startedAt >= timeoutMs) {
        summary.errors.push({
          message: `Limite de tempo atingido antes de ${county.name}; próxima execução continuará pelo incremental.`
        });
        break;
      }

      try {
        const result = await activeDependencies.collectCounty(county);
        summary.found += result.found;
        summary.new += result.newCount;
        summary.updated += result.updatedCount;
        summary.errors.push(
          ...result.errors.map((error) => ({
            ...error,
            message: `[${county.name}] ${error.message}`
          }))
        );
      } catch (error) {
        summary.errors.push({
          message: `[${county.name}] ${errorMessage(error)}`
        });
      }

      summary.countiesProcessed += 1;
    }

    summary.durationMs = now() - startedAt;
    await activeDependencies.finishRun(runId, summary, "completed");
    return summary;
  } catch (error) {
    summary.durationMs = now() - startedAt;
    summary.errors.push({ message: errorMessage(error) });
    await activeDependencies.finishRun(runId, summary, "failed");
    throw error;
  }
}

export async function listCollectionRunStatus(limit = 10) {
  const { db } = await import("@/lib/db");
  const rows = await db
    .select({
      id: collectionRuns.id,
      mode: collectionRuns.mode,
      startedAt: collectionRuns.startedAt,
      finishedAt: collectionRuns.finishedAt,
      status: collectionRuns.status,
      found: collectionRuns.found,
      newCount: collectionRuns.newCount,
      updatedCount: collectionRuns.updatedCount,
      errorCount: collectionRuns.errorCount,
      errors: collectionRuns.errors
    })
    .from(collectionRuns)
    .orderBy(desc(collectionRuns.startedAt))
    .limit(Math.min(Math.max(limit, 1), 50));

  const now = Date.now();
  return rows.map((row) => ({
    ...row,
    durationMs: (row.finishedAt?.getTime() ?? now) - row.startedAt.getTime()
  }));
}

async function createDefaultDependencies(): Promise<DailySyncDependencies> {
  const { db } = await import("@/lib/db");
  const client = new CaixaEscolarClient();

  return {
    async startRun() {
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(${DAILY_SYNC_LOCK_KEY})`);
        const cutoff = new Date(Date.now() - DAILY_SYNC_RUNNING_WINDOW_MS);
        const [running] = await tx
          .select({ id: collectionRuns.id })
          .from(collectionRuns)
          .where(
            and(
              eq(collectionRuns.status, "running"),
              gt(collectionRuns.startedAt, cutoff)
            )
          )
          .limit(1);

        if (running) {
          throw new DailySyncAlreadyRunningError(running.id);
        }

        const [run] = await tx
          .insert(collectionRuns)
          .values({ mode: "daily_sync" })
          .returning({ id: collectionRuns.id });
        return run.id;
      });
    },
    async finishRun(runId, summary, status) {
      await db
        .update(collectionRuns)
        .set({
          status,
          finishedAt: new Date(),
          found: summary.found,
          newCount: summary.new,
          updatedCount: summary.updated,
          errorCount: summary.errors.length,
          errors: summary.errors
        })
        .where(eq(collectionRuns.id, runId));
    },
    async collectCounty(county) {
      return collectOpportunities(client, undefined, {
        mode: "incremental",
        filters: { county: county.idCounty },
        schoolCounty: { idCounty: county.idCounty, city: county.name }
      });
    },
    async collectQuotations() {
      return collectOpenQuotations();
    }
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
