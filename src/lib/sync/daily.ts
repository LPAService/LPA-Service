import { and, desc, eq, gt, sql } from "drizzle-orm";
import { CaixaEscolarClient } from "@/lib/collector/client";
import { collectOpportunities, type CollectionError } from "@/lib/collector/collect";
import {
  collectOpenQuotations,
  type QuotationCollectionResult,
  type QuotationCounty
} from "@/lib/collector/quotations";
import type { CescomCatalogLoadResult } from "@/lib/catalog/cescom-loader";
import rmbhCounties from "@/lib/collector/rmbh-counties.json";
import { collectionRuns } from "@/lib/db/schema";

// A funcao serverless morre em 300s (maxDuration). Um FUNCTION_INVOCATION_TIMEOUT
// mata o processo sem rodar finishRun: o run fica preso em "running" e o que
// estava em voo se perde. Por isso todas as fases param antes desta parede.
export const DAILY_SYNC_DEADLINE_MS = 285_000;
// Fatia reservada para o historico (collectOpportunities), para que a coleta de
// cotacoes nao consuma a execucao inteira.
export const DAILY_SYNC_OPPORTUNITIES_SLOT_MS = 45_000;
export const DAILY_SYNC_TIMEOUT_MS = DAILY_SYNC_DEADLINE_MS;
export const DAILY_SYNC_RUNNING_WINDOW_MS = 330_000;
const DAILY_SYNC_LOCK_KEY = 849_016_275;

export type DailySyncOptions = {
  counties?: QuotationCounty[];
};

export type DailySyncScope = {
  mode: string;
  counties?: QuotationCounty[];
};

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
    fetched?: number;
    skipped?: number;
    new: number;
    updated: number;
    errors: CollectionError[];
    status?: string;
    resumeCursor?: unknown;
    counties?: QuotationCollectionResult["counties"];
  };
  notifications?: {
    notificationsCreated: number;
    emailsSent: number;
    emailsSkipped: number;
    errors: string[];
  };
  referenceCatalog?: CescomCatalogLoadResult;
};

export class DailySyncAlreadyRunningError extends Error {
  constructor(public readonly runId: number, public readonly countyName?: string) {
    super(
      countyName
        ? `Sync diário já está em execução para ${countyName} (run ${runId})`
        : `Sync diário completo já está em execução (run ${runId})`
    );
    this.name = "DailySyncAlreadyRunningError";
  }
}

type DailySyncDependencies = {
  startRun: (scope: DailySyncScope) => Promise<number>;
  finishRun: (runId: number, summary: DailySyncSummary, status: "completed" | "failed") => Promise<void>;
  collectCounty: (county: { idCounty: number; name: string }) => Promise<{
    found: number;
    newCount: number;
    updatedCount: number;
    errors: CollectionError[];
  }>;
  collectQuotations?: (scope: DailySyncScope) => Promise<{
    found: number;
    fetchedCount?: number;
    skippedCount?: number;
    newCount: number;
    updatedCount: number;
    errors: CollectionError[];
    status?: string;
    resumeCursor?: unknown;
    counties?: QuotationCollectionResult["counties"];
  }>;
  dispatchNotifications?: () => Promise<{
    notificationsCreated: number;
    emailsSent: number;
    emailsSkipped: number;
    errors: string[];
  }>;
  loadReferenceCatalog?: () => Promise<CescomCatalogLoadResult>;
  now?: () => number;
  timeoutMs?: number;
};

export async function runDailySync(
  optionsOrDependencies?: DailySyncOptions | DailySyncDependencies,
  injectedDependencies?: DailySyncDependencies
): Promise<DailySyncSummary> {
  const dependencies = isDailySyncDependencies(optionsOrDependencies)
    ? optionsOrDependencies
    : injectedDependencies;
  const options = isDailySyncDependencies(optionsOrDependencies)
    ? {}
    : optionsOrDependencies ?? {};
  const scope = createDailySyncScope(options.counties);
  const now = dependencies?.now ?? Date.now;
  const startedAt = now();
  const activeDependencies = dependencies ?? (await createDefaultDependencies(startedAt, scope));
  const timeoutMs = activeDependencies.timeoutMs ?? DAILY_SYNC_TIMEOUT_MS;
  const runId = await activeDependencies.startRun(scope);
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
        const quotations = await activeDependencies.collectQuotations(scope);
        summary.quotationRun = {
          found: quotations.found,
          fetched: quotations.fetchedCount ?? 0,
          skipped: quotations.skippedCount ?? 0,
          new: quotations.newCount,
          updated: quotations.updatedCount,
          errors: quotations.errors,
          status: quotations.status,
          resumeCursor: quotations.resumeCursor,
          counties: quotations.counties
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

        if (quotations.newCount > 0 && activeDependencies.dispatchNotifications) {
          try {
            summary.notifications = await activeDependencies.dispatchNotifications();
          } catch (error) {
            summary.errors.push({ message: `[Notificações] ${errorMessage(error)}` });
          }
        }
      } catch (error) {
        summary.errors.push({ message: `[Cotações abertas] ${errorMessage(error)}` });
      }
    }

    if (activeDependencies.loadReferenceCatalog) {
      try {
        summary.referenceCatalog = await activeDependencies.loadReferenceCatalog();
      } catch (error) {
        console.error("Failed to load Cescom reference catalog during daily sync", { error });
        summary.errors.push({ message: `[Catálogo Cescom] ${errorMessage(error)}` });
      }
    }

    for (const county of scope.counties ?? rmbhCounties.collected) {
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

export function createDailySyncScope(counties?: QuotationCounty[]): DailySyncScope {
  if (!counties || counties.length === 0) return { mode: "daily_sync" };
  const unique = new Map(counties.map((county) => [county.idCounty, county]));
  const selected = [...unique.values()];
  const modeIds = selected.map((county) => county.idCounty).sort((left, right) => left - right);
  return {
    mode: `daily_sync:counties:${modeIds.join(",")}`,
    counties: selected
  };
}

export function findDailySyncConflict(
  scope: DailySyncScope,
  running: Array<{ id: number; mode: string }>
) {
  const requestedIds = scope.counties?.map((county) => county.idCounty) ?? null;
  for (const run of running) {
    const runningIds = parseDailySyncMode(run.mode);
    if (runningIds === undefined) continue;
    if (requestedIds === null) {
      const countyId = runningIds?.[0];
      return { runId: run.id, countyName: countyId ? countyName(countyId) : undefined };
    }
    if (runningIds === null) {
      return { runId: run.id, countyName: countyName(requestedIds[0]) };
    }
    const conflictId = requestedIds.find((id) => runningIds.includes(id));
    if (conflictId) return { runId: run.id, countyName: countyName(conflictId) };
  }
  return null;
}

function parseDailySyncMode(mode: string) {
  if (mode === "daily_sync" || mode === "daily_sync:all") return null;
  if (!mode.startsWith("daily_sync:counties:")) return undefined;
  const ids = mode
    .slice("daily_sync:counties:".length)
    .split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));
  return ids.length > 0 ? ids : undefined;
}

function countyName(idCounty: number) {
  const county = rmbhCounties.counties.find((candidate) => candidate.idCounty === idCounty) ??
    rmbhCounties.priority.find((candidate) => candidate.idCounty === idCounty) ??
    rmbhCounties.collected.find((candidate) => candidate.idCounty === idCounty);
  return county?.name ?? String(idCounty);
}

function quotationRunMode(scope: DailySyncScope) {
  return scope.counties
    ? `open_quotations:counties:${scope.counties.map((county) => county.idCounty).join(",")}`
    : undefined;
}

function isDailySyncDependencies(value: DailySyncOptions | DailySyncDependencies | undefined): value is DailySyncDependencies {
  return Boolean(value && "startRun" in value);
}

async function createDefaultDependencies(startedAt: number, scope: DailySyncScope): Promise<DailySyncDependencies> {
  const { db } = await import("@/lib/db");
  const client = new CaixaEscolarClient();

  return {
    async startRun(requestedScope) {
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(${DAILY_SYNC_LOCK_KEY})`);
        const cutoff = new Date(Date.now() - DAILY_SYNC_RUNNING_WINDOW_MS);
        const running = await tx
          .select({ id: collectionRuns.id, mode: collectionRuns.mode })
          .from(collectionRuns)
          .where(
            and(
              eq(collectionRuns.status, "running"),
              gt(collectionRuns.startedAt, cutoff)
            )
          );

        const conflict = findDailySyncConflict(requestedScope, running);
        if (conflict) {
          throw new DailySyncAlreadyRunningError(conflict.runId, conflict.countyName);
        }

        const [run] = await tx
          .insert(collectionRuns)
          .values({ mode: requestedScope.mode })
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
        schoolCounty: { idCounty: county.idCounty, city: county.name },
        // sem isto um unico municipio passa da parede de 300s sozinho
        deadlineAt: startedAt + DAILY_SYNC_DEADLINE_MS
      });
    },
    async collectQuotations() {
      const remaining = DAILY_SYNC_DEADLINE_MS - (Date.now() - startedAt) - DAILY_SYNC_OPPORTUNITIES_SLOT_MS;
      return collectOpenQuotations({
        counties: scope.counties,
        runMode: quotationRunMode(scope),
        timeBudgetMs: Math.max(30_000, remaining),
        timeBudgetReserveMs: 20_000
      });
    },
    async dispatchNotifications() {
      const { dispatchQuotationNotifications } = await import("@/lib/notify/dispatch");
      return dispatchQuotationNotifications({ since: new Date(startedAt) });
    },
    async loadReferenceCatalog() {
      const { loadCescomCatalog } = await import("@/lib/catalog/cescom-loader");
      return loadCescomCatalog(db);
    }
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
