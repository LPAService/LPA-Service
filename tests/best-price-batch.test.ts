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

  it("mantém só ofertas automáticas cujo título contém o núcleo relevante da busca", async () => {
    const result = await searchBestPriceBatch(["Clip de papel", "Detergente liquido neutro 500ml"], {
      search: async (query) => ({
        query,
        provider: "realdist",
        offers: [
          makeOffer("Oferta barata sem núcleo", 1),
          makeOffer(query.startsWith("Clip") ? "Toalhas De Papel Interfolhadas Limpmax" : "Detergente liquido neutro 500ml", 15.66)
        ],
        error: null
      })
    });

    expect(result.results["Clip de papel"].offers).toEqual([]);
    expect(result.results["Detergente liquido neutro 500ml"].offers.map((offer) => offer.title)).toEqual([
      "Detergente liquido neutro 500ml"
    ]);
  });

  it("não promove oferta mais barata quando só token genérico casa", async () => {
    const result = await searchBestPriceBatch(["Papel higienico folha dupla"], {
      search: async (query) => ({
        query,
        provider: "realdist",
        offers: [
          makeOffer("Toalhas De Papel Interfolhadas Limpmax", 15.66),
          makeOffer("Papel Higienico Folha Dupla 30m", 24.9)
        ],
        error: null
      })
    });

    expect(result.results["Papel higienico folha dupla"].offers.map((offer) => offer.title)).toEqual([
      "Papel Higienico Folha Dupla 30m"
    ]);
  });

  it("exige que o núcleo da busca seja também o núcleo líder da oferta", async () => {
    const result = await searchBestPriceBatch(["Cafe torrado e moido"], {
      search: async (query) => ({
        query,
        provider: "realdist",
        offers: [
          makeOffer("Tintura Para Cabelo Cor Chocolate Cafe", 9.99),
          makeOffer("Chocolate Tablete Neugebauer 1891 Cafe 55% Cacau", 14.02),
          makeOffer("Cafe Melitta Tradicional 250Gr", 18.9)
        ],
        error: null
      })
    });

    expect(result.results["Cafe torrado e moido"].offers.map((offer) => offer.title)).toEqual([
      "Cafe Melitta Tradicional 250Gr"
    ]);
  });

  it("tenta buscar pelo núcleo quando a busca completa só retorna atributos irrelevantes", async () => {
    const calls: string[] = [];
    const result = await searchBestPriceBatch(["Cafe torrado e moido"], {
      search: async (query) => {
        calls.push(query);
        return {
          query,
          provider: "realdist",
          offers:
            query === "cafe"
              ? [
                  makeOffer("Chocolate Tablete Neugebauer 1891 Cafe 55% Cacau", 14.02),
                  makeOffer("Cafe Barao Tradicional 250Gr", 223.57)
                ]
              : [
                  makeOffer("Chocolate Tablete Neugebauer 1891 Cafe 55% Cacau", 14.02),
                  makeOffer("Tintura Para Cabelo Beauty Color Chocolate Cafe", 17.15)
                ],
          error: null
        };
      }
    });

    expect(calls).toEqual(["Cafe torrado e moido", "cafe"]);
    expect(result.results["Cafe torrado e moido"].offers.map((offer) => offer.title)).toEqual([
      "Cafe Barao Tradicional 250Gr"
    ]);
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

function makeOffer(title: string, price: number) {
  return {
    provider: "realdist",
    title,
    price,
    currency: "BRL",
    url: `https://www.realdist.com.br/${encodeURIComponent(title)}`,
    thumbnail: null,
    seller: "Real Distribuidora",
    condition: "new",
    available: null
  };
}
