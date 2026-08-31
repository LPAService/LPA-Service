import type { BestPriceResult } from "@/lib/search/best-price";
import { searchBestPrice } from "@/lib/search/best-price";
import { tokenize } from "@/lib/catalog/match";
import {
  firstReferenceCoreToken,
  isRelevantReferenceTitle,
  normalizeReferenceQuery
} from "@/lib/catalog/reference-name-match";
import { normalize } from "@/lib/text/normalize";

export const BEST_PRICE_BATCH_LIMIT = 40;
export const BEST_PRICE_BATCH_CONCURRENCY = 3;
export const BEST_PRICE_BATCH_TIMEOUT_MS = 7000;
export const BEST_PRICE_BATCH_CACHE_TTL_MS = 30 * 60 * 1000;
export const BEST_PRICE_BATCH_RELEVANCE_CANDIDATE_LIMIT = 10;

type SearchBestPriceFn = (query: string, limit: number) => Promise<BestPriceResult>;

type CacheEntry = {
  expiresAt: number;
  result: BestPriceResult;
};

type BatchQuery = {
  normalized: string;
  searchQuery: string;
};

export type SearchBestPriceBatchOptions = {
  search?: SearchBestPriceFn;
  now?: () => number;
  ttlMs?: number;
  timeoutMs?: number;
  concurrency?: number;
  offerLimit?: number;
};

export type BestPriceBatchResponse = {
  results: Record<string, BestPriceResult>;
};

const cache = new Map<string, CacheEntry>();

export class BestPriceBatchLimitError extends Error {
  constructor(limit: number) {
    super(`Máximo de ${limit} buscas por requisição.`);
    this.name = "BestPriceBatchLimitError";
  }
}

export async function searchBestPriceBatch(
  queries: string[],
  options: SearchBestPriceBatchOptions = {}
): Promise<BestPriceBatchResponse> {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? BEST_PRICE_BATCH_CACHE_TTL_MS;
  const timeoutMs = options.timeoutMs ?? BEST_PRICE_BATCH_TIMEOUT_MS;
  const concurrency = Math.min(
    BEST_PRICE_BATCH_CONCURRENCY,
    Math.max(1, Math.floor(options.concurrency ?? BEST_PRICE_BATCH_CONCURRENCY))
  );
  const offerLimit = options.offerLimit ?? 5;
  const search = options.search ?? searchBestPrice;

  const originals: { key: string; normalized: string }[] = [];
  const unique = new Map<string, BatchQuery>();
  for (const rawQuery of queries) {
    const key = rawQuery.trim();
    const normalized = normalizeBatchQuery(rawQuery);
    if (!key || !normalized) continue;
    originals.push({ key, normalized });
    if (!unique.has(normalized)) unique.set(normalized, { normalized, searchQuery: key });
  }

  if (unique.size > BEST_PRICE_BATCH_LIMIT) {
    throw new BestPriceBatchLimitError(BEST_PRICE_BATCH_LIMIT);
  }

  const byNormalized = new Map<string, BestPriceResult>();
  const uncached: BatchQuery[] = [];
  const currentTime = now();
  for (const query of unique.values()) {
    const cached = cache.get(query.normalized);
    if (cached && cached.expiresAt > currentTime) {
      byNormalized.set(query.normalized, cached.result);
    } else {
      if (cached) cache.delete(query.normalized);
      uncached.push(query);
    }
  }

  await mapWithConcurrency(uncached, concurrency, async (query) => {
    const result = await searchRelevantBestPriceWithFallback(
      search,
      query.searchQuery,
      offerLimit,
      timeoutMs
    );
    cache.set(query.normalized, { result, expiresAt: now() + ttlMs });
    byNormalized.set(query.normalized, result);
  });

  const results: Record<string, BestPriceResult> = {};
  for (const original of originals) {
    const result = byNormalized.get(original.normalized);
    if (!result) continue;
    results[original.key] = { ...result, query: original.key };
  }
  return { results };
}

function filterBestPriceResultByRelevance(result: BestPriceResult, query: string): BestPriceResult {
  return {
    ...result,
    offers: result.offers.filter((offer) => isRelevantReferenceTitle(query, offer.title))
  };
}

async function searchRelevantBestPriceWithFallback(
  search: SearchBestPriceFn,
  query: string,
  offerLimit: number,
  timeoutMs: number
): Promise<BestPriceResult> {
  const fullResult = filterBestPriceResultByRelevance(
    await searchWithTimeout(search, query, offerLimit, timeoutMs),
    query
  );
  if (fullResult.offers.length > 0) return fullResult;

  const fallbackQuery = buildCoreFallbackQuery(query);
  if (!fallbackQuery || normalizeBatchQuery(fallbackQuery) === normalizeBatchQuery(query)) {
    return fullResult;
  }

  const fallbackResult = filterBestPriceResultByRelevance(
    await searchWithTimeout(search, fallbackQuery, BEST_PRICE_BATCH_RELEVANCE_CANDIDATE_LIMIT, timeoutMs),
    query
  );
  if (fallbackResult.offers.length === 0) return fullResult;

  return {
    ...fallbackResult,
    query,
    offers: fallbackResult.offers.slice(0, offerLimit)
  };
}

function buildCoreFallbackQuery(query: string) {
  const tokens = tokenize(normalizeReferenceQuery(query));
  return firstReferenceCoreToken(tokens);
}

export function clearBestPriceBatchCache() {
  cache.clear();
}

function normalizeBatchQuery(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchWithTimeout(
  search: SearchBestPriceFn,
  query: string,
  offerLimit: number,
  timeoutMs: number
): Promise<BestPriceResult> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      search(query, offerLimit),
      new Promise<BestPriceResult>((resolve) => {
        timeout = setTimeout(
          () =>
            resolve({
              query,
              provider: "none",
              offers: [],
              error: "Busca excedeu o tempo limite."
            }),
          timeoutMs
        );
      })
    ]);
  } catch (error) {
    return {
      query,
      provider: "none",
      offers: [],
      error: error instanceof Error ? error.message : "Falha na busca de preço."
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function mapWithConcurrency<T>(
  values: T[],
  concurrency: number,
  iteratee: (value: T) => Promise<void>
) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const current = values[cursor];
      cursor += 1;
      await iteratee(current);
    }
  });
  await Promise.all(workers);
}
