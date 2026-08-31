import { afterEach, describe, expect, it } from "vitest";
import {
  BestPriceBatchLimitError,
  clearBestPriceBatchCache,
  searchBestPriceBatch
} from "@/lib/search/best-price-batch";
import type { BestPriceOffer, BestPriceResult } from "@/lib/search/best-price";

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

  it("guarda no cache o resultado final da cadeia filtrada", async () => {
    let now = 1_000;
    let calls = 0;
    const options = {
      now: () => now,
      ttlMs: 100,
      search: async (query: string, limit: number, isRelevantOffer?: (offer: BestPriceOffer) => boolean) => {
        calls += 1;
        const providers = [
          {
            provider: "realdist",
            offers: [makeProviderOffer("realdist", "Toalhas De Papel Interfolhadas Limpmax", 15.66)]
          },
          {
            provider: "mercadolivre",
            offers: [makeProviderOffer("mercadolivre", "Clip De Papel Galvanizado 2/0 Caixa 100 Unidades", 7.5)]
          }
        ];
        for (const provider of providers) {
          const offers = isRelevantOffer ? provider.offers.filter(isRelevantOffer) : provider.offers;
          if (offers.length > 0) {
            return {
              query,
              provider: provider.provider,
              offers: offers.slice(0, limit),
              error: null
            };
          }
        }
        return { query, provider: "realdist+mercadolivre", offers: [], error: "Nenhuma oferta encontrada para este item." };
      }
    };

    const first = await searchBestPriceBatch(["Clip de papel"], options);
    const second = await searchBestPriceBatch(["clip de papel"], options);

    expect(calls).toBe(1);
    expect(first.results["Clip de papel"].provider).toBe("mercadolivre");
    expect(first.results["Clip de papel"].offers.map((offer) => offer.title)).toEqual([
      "Clip De Papel Galvanizado 2/0 Caixa 100 Unidades"
    ]);
    expect(second.results["clip de papel"].provider).toBe("mercadolivre");

    now = 1_101;
    await searchBestPriceBatch(["Clip de papel"], options);
    expect(calls).toBe(2);
  });

  it("não busca preço automático para contexto de frutas e verduras", async () => {
    let calls = 0;
    const result = await searchBestPriceBatch(
      [
        {
          query: "Cenoura",
          categorySlug: "frutas-e-verduras",
          categoryName: "Frutas e Verduras",
          expenseGroup: "Gêneros Alimentícios"
        }
      ],
      {
        search: async (query) => {
          calls += 1;
          return fakeResult(query);
        }
      }
    );

    expect(calls).toBe(0);
    expect(result.results.Cenoura).toEqual({
      query: "Cenoura",
      provider: "none",
      offers: [],
      error: null
    });
  });

  it("inclui contexto no cache da busca automática", async () => {
    let calls = 0;
    const options = {
      search: async (query: string) => {
        calls += 1;
        return fakeResult(query);
      }
    };

    await searchBestPriceBatch(
      [
        {
          query: "Cenoura",
          categorySlug: "frutas-e-verduras",
          categoryName: "Frutas e Verduras",
          expenseGroup: "Gêneros Alimentícios"
        }
      ],
      options
    );
    const result = await searchBestPriceBatch(
      [
        {
          query: "Cenoura",
          categorySlug: "material-de-escritorio",
          categoryName: "Material de Escritório",
          expenseGroup: "Material de Consumo"
        }
      ],
      options
    );

    expect(calls).toBe(1);
    expect(result.results.Cenoura.offers).toHaveLength(1);
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

  it("passa fallback pelo núcleo para a cadeia quando a busca completa só retorna atributos irrelevantes", async () => {
    const calls: { query: string; fallbackQuery: string | null | undefined; fallbackLimit: number | undefined }[] = [];
    const result = await searchBestPriceBatch(["Cafe torrado e moido"], {
      search: async (query, _limit, isRelevantOffer, fallbackQuery, fallbackLimit) => {
        calls.push({ query, fallbackQuery, fallbackLimit });
        const fullOffers = [
          makeOffer("Chocolate Tablete Neugebauer 1891 Cafe 55% Cacau", 14.02),
          makeOffer("Tintura Para Cabelo Beauty Color Chocolate Cafe", 17.15)
        ];
        const filteredFullOffers = isRelevantOffer ? fullOffers.filter(isRelevantOffer) : fullOffers;
        if (filteredFullOffers.length > 0) {
          return { query, provider: "realdist", offers: filteredFullOffers, error: null };
        }
        const fallbackOffers =
          fallbackQuery === "cafe"
            ? [
                makeOffer("Chocolate Tablete Neugebauer 1891 Cafe 55% Cacau", 14.02),
                makeOffer("Cafe Barao Tradicional 250Gr", 223.57)
              ]
            : [];
        const filteredFallbackOffers = isRelevantOffer ? fallbackOffers.filter(isRelevantOffer) : fallbackOffers;
        return {
          query,
          provider: "realdist",
          offers: filteredFallbackOffers,
          error: null
        };
      }
    });

    expect(calls).toEqual([{ query: "Cafe torrado e moido", fallbackQuery: "cafe", fallbackLimit: 10 }]);
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

function makeProviderOffer(provider: string, title: string, price: number): BestPriceOffer {
  return {
    provider,
    title,
    price,
    currency: "BRL",
    url: `https://example.com/${encodeURIComponent(title)}`,
    thumbnail: null,
    seller: provider,
    condition: "new",
    available: null
  };
}
