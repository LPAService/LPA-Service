import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLossesHandler, createStatusHandler, createSyncHandler } from "@/lib/sync/handlers";
import {
  DailySyncAlreadyRunningError,
  runDailySync,
  type DailySyncSummary
} from "@/lib/sync/daily";

const originalSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

function request(path: string, secret?: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined
  });
}

const summary: DailySyncSummary = {
  runId: 42,
  found: 5,
  new: 2,
  updated: 3,
  errors: [],
  durationMs: 1234,
  countiesProcessed: 2
};

describe("rotas de sync diário", () => {
  it("retorna 401 sem segredo", async () => {
    process.env.CRON_SECRET = "segredo";
    const runSync = vi.fn(async () => summary);
    const response = await createSyncHandler(runSync)(request("/api/cron/sync"));

    expect(response.status).toBe(401);
    expect(runSync).not.toHaveBeenCalled();
  });

  it("retorna 409 quando sync já está em execução", async () => {
    process.env.CRON_SECRET = "segredo";
    const response = await createSyncHandler(async () => {
      throw new DailySyncAlreadyRunningError(17);
    })(request("/api/cron/sync", "segredo"));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ runId: 17 });
  });

  it("retorna resumo do lote", async () => {
    process.env.CRON_SECRET = "segredo";
    const response = await createSyncHandler(async () => summary)(
      request("/api/cron/sync?secret=segredo")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(summary);
  });

  it("status exige segredo e retorna últimas execuções", async () => {
    process.env.CRON_SECRET = "segredo";
    const loadStatus = vi.fn(async () => [
      {
        id: 1,
        mode: "daily_sync",
        startedAt: new Date("2026-08-12T09:00:00.000Z"),
        finishedAt: new Date("2026-08-12T09:00:02.000Z"),
        status: "completed",
        found: 3,
        newCount: 1,
        updatedCount: 2,
        errorCount: 0,
        errors: [],
        durationMs: 2000
      }
    ]);
    const handler = createStatusHandler(loadStatus);

    expect((await handler(request("/api/cron/status"))).status).toBe(401);
    const response = await handler(request("/api/cron/status?limit=3", "segredo"));
    expect(response.status).toBe(200);
    expect(loadStatus).toHaveBeenCalledWith(3);
    await expect(response.json()).resolves.toMatchObject({ runs: [{ id: 1, durationMs: 2000 }] });
  });
});

describe("rota de coleta de perdas", () => {
  it("retorna 401 sem segredo", async () => {
    process.env.CRON_SECRET = "segredo";
    const runLosses = vi.fn(async () => ({
      runId: 43,
      status: "completed" as const,
      found: 13,
      newCount: 13,
      updatedCount: 0,
      errorCount: 0,
      errors: []
    }));
    const response = await createLossesHandler(runLosses)(request("/api/cron/losses"));

    expect(response.status).toBe(401);
    expect(runLosses).not.toHaveBeenCalled();
  });

  it("executa a coleta de perdas com segredo", async () => {
    process.env.CRON_SECRET = "segredo";
    const result = {
      runId: 43,
      status: "completed" as const,
      found: 13,
      newCount: 2,
      updatedCount: 11,
      errorCount: 0,
      errors: []
    };
    const runLosses = vi.fn(async () => result);
    const response = await createLossesHandler(runLosses)(
      request("/api/cron/losses?secret=segredo")
    );

    expect(response.status).toBe(200);
    expect(runLosses).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual(result);
  });
});

describe("lote diário", () => {
  it("continua após falha de município e agrega resumo", async () => {
    const finishRun = vi.fn(async () => undefined);
    let timestamp = 0;
    const result = await runDailySync({
      startRun: async () => 99,
      finishRun,
      collectCounty: async (county) => {
        if (county.idCounty === 2340) throw new Error("API indisponível");
        return { found: 1, newCount: 1, updatedCount: 0, errors: [] };
      },
      now: () => timestamp++,
      timeoutMs: 1000
    });

    expect(result.runId).toBe(99);
    expect(result.countiesProcessed).toBe(10);
    expect(result.errors.some((error) => error.message.includes("API indisponível"))).toBe(true);
    expect(finishRun).toHaveBeenCalledWith(99, result, "completed");
  });

  it("não chama coleta de perdas", async () => {
    const finishRun = vi.fn(async () => undefined);
    const collectProposalLosses = vi.fn(async () => {
      throw new Error("perdas não deveriam rodar no sync diário");
    });
    const result = await runDailySync({
      startRun: async () => 100,
      finishRun,
      collectQuotations: async () => ({ found: 2, newCount: 1, updatedCount: 1, errors: [] }),
      collectProposalLosses,
      collectCounty: async () => ({ found: 0, newCount: 0, updatedCount: 0, errors: [] }),
      now: () => 0,
      timeoutMs: 1000
    } as Parameters<typeof runDailySync>[0] & {
      collectProposalLosses: typeof collectProposalLosses;
    });

    expect(result).toMatchObject({
      runId: 100,
      found: 2,
      new: 1,
      updated: 1,
      quotationRun: { found: 2, new: 1, updated: 1 }
    });
    expect(collectProposalLosses).not.toHaveBeenCalled();
    expect(result.errors).toEqual([]);
    expect(finishRun).toHaveBeenCalledWith(100, result, "completed");
  });

  it("registra falha da carga Cescom sem derrubar o sync", async () => {
    const finishRun = vi.fn(async () => undefined);
    const loadReferenceCatalog = vi.fn(async () => {
      throw new Error("catálogo indisponível");
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const result = await runDailySync({
        startRun: async () => 101,
        finishRun,
        collectQuotations: async () => ({ found: 2, newCount: 1, updatedCount: 1, errors: [] }),
        loadReferenceCatalog,
        collectCounty: async () => ({ found: 0, newCount: 0, updatedCount: 0, errors: [] }),
        now: () => 0,
        timeoutMs: 1000
      });

      expect(loadReferenceCatalog).toHaveBeenCalledOnce();
      expect(result.quotationRun).toMatchObject({ found: 2, new: 1, updated: 1 });
      expect(result.errors).toEqual([{ message: "[Catálogo Cescom] catálogo indisponível" }]);
      expect(finishRun).toHaveBeenCalledWith(101, result, "completed");
    } finally {
      consoleError.mockRestore();
    }
  });
});
