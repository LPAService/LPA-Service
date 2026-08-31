import { afterEach, describe, expect, it } from "vitest";
import {
  BestPriceBatchLimitError,
  clearBestPriceBatchCache,
  searchBestPriceBatch
} from "@/lib/search/best-price-batch";
import type { BestPriceResult } from "@/lib/search/best-price";

describe("searchBestPriceBatch", () => {
  afterEach(() => {
    clearBestPriceBatchCache();
  });

  it("deduplica por query normalizada e ignora vazias", async () => {
    const calls: string[] = [];
    const result = await searchBestPriceBatch(
      ["Papel A4", " papel a4 ", "", "   ", "Detergente neutro"],
      {
        search: async (query) => {
          calls.push(query);
          return fakeResult(query);
        }
      }
    );

    expect(calls).toEqual(["Papel A4", "Detergente neutro"]);
    expect(Object.keys(result.results)).toEqual(["Papel A4", "papel a4", "Detergente neutro"]);
    expect(result.results["Papel A4"].offers).toHaveLength(1);
    expect(result.results["papel a4"].query).toBe("papel a4");
  });

  it("bloqueia mais de 40 queries únicas sem chamar busca", async () => {
    let calls = 0;
    await expect(
      searchBestPriceBatch(
        Array.from({ length: 41 }, (_, index) => `item ${index}`),
        {
          search: async (query) => {
            calls += 1;
            return fakeResult(query);
          }
        }
      )
    ).rejects.toBeInstanceOf(BestPriceBatchLimitError);
    expect(calls).toBe(0);
  });

  it("respeita concorrência máxima 3", async () => {
    let active = 0;
    let maxActive = 0;

    await searchBestPriceBatch(
      Array.from({ length: 8 }, (_, index) => `produto ${index}`),
      {
        search: async (query) => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await new Promise((resolve) => setTimeout(resolve, 20));
          active -= 1;
          return fakeResult(query);
        }
      }
    );

    expect(maxActive).toBe(3);
  });

  it("usa cache em memória até expirar o TTL", async () => {
    let now = 1_000;
    let calls = 0;
    const options = {
      now: () => now,
      ttlMs: 100,
      search: async (query: string) => {
        calls += 1;
        return fakeResult(query);
      }
    };

    await searchBestPriceBatch(["Papel A4"], options);
    await searchBestPriceBatch(["papel a4"], options);
    expect(calls).toBe(1);

    now = 1_101;
    await searchBestPriceBatch(["Papel A4"], options);
    expect(calls).toBe(2);
  });

  it("converte falha em resultado sem oferta inventada", async () => {
    const result = await searchBestPriceBatch(["Caneta azul"], {
      search: async () => {
        throw new Error("site fora");
      }
    });

    expect(result.results["Caneta azul"]).toEqual({
      query: "Caneta azul",
      provider: "none",
      offers: [],
      error: "site fora"
    });
  });
});

function fakeResult(query: string): BestPriceResult {
  return {
    query,
    provider: "realdist",
    offers: [
      {
        provider: "realdist",
        title: `${query} Real`,
        price: 12.34,
        currency: "BRL",
        url: "https://www.realdist.com.br/produto",
        thumbnail: null,
        seller: "Real Distribuidora",
        condition: "new",
        available: null
      }
    ],
    error: null
  };
}
