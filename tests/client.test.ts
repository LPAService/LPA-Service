import { afterEach, describe, expect, it, vi } from "vitest";
import { CaixaEscolarClient } from "@/lib/collector/client";

const emptyPage = {
  data: [],
  meta: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0
  }
};

describe("CaixaEscolarClient", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("respeita Retry-After em 429 antes de repetir", async () => {
    const sleeps: number[] = [];
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "limited" }, 429, { "Retry-After": "2" }))
      .mockResolvedValueOnce(jsonResponse(emptyPage));
    const client = new CaixaEscolarClient({
      fetchFn,
      maxRetries: 1,
      initialBackoffMs: 10,
      sleepFn: async (ms) => {
        sleeps.push(ms);
      }
    });

    await expect(client.listPurchaseOrders()).resolves.toEqual(emptyPage);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([2000]);
  });

  it("repete HTTP 500 com backoff exponencial", async () => {
    const sleeps: number[] = [];
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "server" }, 500))
      .mockResolvedValueOnce(jsonResponse(emptyPage));
    const client = new CaixaEscolarClient({
      fetchFn,
      maxRetries: 1,
      initialBackoffMs: 25,
      sleepFn: async (ms) => {
        sleeps.push(ms);
      }
    });

    await expect(client.listPurchaseOrders()).resolves.toEqual(emptyPage);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([25]);
    expect(fetchFn.mock.calls[0]?.[1]?.headers).toMatchObject({
      Accept: "application/json",
      "User-Agent": "lpa-leo-collector/0.1 contato:fornecedores"
    });
  });

  it("aborta request no timeout configurado", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn((_input: string | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      });
    });
    const client = new CaixaEscolarClient({
      fetchFn,
      timeoutMs: 50,
      maxRetries: 0
    });

    const request = client.listPurchaseOrders();
    const assertion = expect(request).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(50);

    await assertion;
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("modula ritmo por x-ratelimit-limit e x-ratelimit-reset", async () => {
    const sleeps: number[] = [];
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(emptyPage, 200, {
          "x-ratelimit-limit": "60",
          "x-ratelimit-remaining": "59",
          "x-ratelimit-reset": "1"
        })
      )
      .mockResolvedValueOnce(jsonResponse(emptyPage));
    const client = new CaixaEscolarClient({
      fetchFn,
      sleepFn: async (ms) => {
        sleeps.push(ms);
      }
    });

    await client.listPurchaseOrders();
    await client.listPurchaseOrders();

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleeps).toHaveLength(1);
    expect(sleeps[0]).toBeGreaterThan(0);
    expect(sleeps[0]!).toBeLessThanOrEqual(1000 / 60 + 1);
  });
});

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers
    }
  });
}
