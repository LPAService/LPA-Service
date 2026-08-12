import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStatusHandler, createSyncHandler } from "@/lib/sync/handlers";
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
    expect(result.countiesProcessed).toBeGreaterThan(1);
    expect(result.errors.some((error) => error.message.includes("API indisponível"))).toBe(true);
    expect(finishRun).toHaveBeenCalledWith(99, result, "completed");
  });
});
