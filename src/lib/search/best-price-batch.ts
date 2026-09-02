import type { BestPriceOfferPredicate, BestPriceResult } from "@/lib/search/best-price";
import { searchBestPrice } from "@/lib/search/best-price";
import { tokenize } from "@/lib/catalog/match";
import { referenceContextIsProduce, type ReferenceMatchContext } from "@/lib/catalog/reference-match";
import {
  firstReferenceCoreToken,
  isRelevantReferenceTitle,
  normalizeReferenceQuery
} from "@/lib/catalog/reference-name-match";
import categoriesRaw from "@/lib/classification/categories.json";
import { normalize } from "@/lib/text/normalize";

export const BEST_PRICE_BATCH_LIMIT = 40;
export const BEST_PRICE_BATCH_CONCURRENCY = 3;
export const BEST_PRICE_BATCH_TIMEOUT_MS = 7000;
export const BEST_PRICE_BATCH_CACHE_TTL_MS = 30 * 60 * 1000;
export const BEST_PRICE_BATCH_RELEVANCE_CANDIDATE_LIMIT = 10;

type SearchBestPriceFn = (
  query: string,
  limit: number,
  isRelevantOffer?: BestPriceOfferPredicate,
  fallbackQuery?: string | null,
  fallbackLimit?: number
) => Promise<BestPriceResult>;

type CacheEntry = {
  expiresAt: number;
  result: BestPriceResult;
};

type BatchQuery = {
  cacheKey: string;
  context: ReferenceMatchContext;
  normalized: string;
  searchQuery: string;
};

type CategoryNode = {
  slug: string;
  parent: string | null;
};

export type SearchBestPriceBatchQuery =
  | string
  | ({
      query: string;
    } & ReferenceMatchContext);

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
const categories = categoriesRaw as CategoryNode[];
const categoriesBySlug = new Map(categories.map((category) => [category.slug, category]));

export class BestPriceBatchLimitError extends Error {
  constructor(limit: number) {
    super(`Máximo de ${limit} buscas por requisição.`);
    this.name = "BestPriceBatchLimitError";
  }
}

export async function searchBestPriceBatch(
  queries: SearchBestPriceBatchQuery[],
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

  const originals: { key: string; cacheKey: string }[] = [];
  const unique = new Map<string, BatchQuery>();
  for (const rawQuery of queries) {
    const parsed = parseBatchQuery(rawQuery);
    const key = parsed.query.trim();
    const normalized = normalizeBatchQuery(parsed.query);
    if (!key || !normalized) continue;
    const cacheKey = buildCacheKey(normalized, parsed.context);
    originals.push({ key, cacheKey });
    if (!unique.has(cacheKey)) unique.set(cacheKey, { cacheKey, context: parsed.context, normalized, searchQuery: key });
  }

  if (unique.size > BEST_PRICE_BATCH_LIMIT) {
    throw new BestPriceBatchLimitError(BEST_PRICE_BATCH_LIMIT);
  }

  const byNormalized = new Map<string, BestPriceResult>();
  const uncached: BatchQuery[] = [];
  const currentTime = now();
  for (const query of unique.values()) {
    const cached = cache.get(query.cacheKey);
    if (cached && cached.expiresAt > currentTime) {
      byNormalized.set(query.cacheKey, cached.result);
    } else {
      if (cached) cache.delete(query.cacheKey);
      uncached.push(query);
    }
  }

  await mapWithConcurrency(uncached, concurrency, async (query) => {
    if (automaticPriceBlockedByProduceContext(query.context)) {
      const result = buildNoAutomaticPriceResult(query.searchQuery);
      cache.set(query.cacheKey, { result, expiresAt: now() + ttlMs });
      byNormalized.set(query.cacheKey, result);
      return;
    }
    const result = await searchRelevantBestPriceWithFallback(
      search,
      query.searchQuery,
      query.context,
      offerLimit,
      timeoutMs
    );
    cache.set(query.cacheKey, { result, expiresAt: now() + ttlMs });
    byNormalized.set(query.cacheKey, result);
  });

  const results: Record<string, BestPriceResult> = {};
  for (const original of originals) {
    const result = byNormalized.get(original.cacheKey);
    if (!result) continue;
    results[original.key] = { ...result, query: original.key };
  }
  return { results };
}

function parseBatchQuery(rawQuery: SearchBestPriceBatchQuery): { query: string; context: ReferenceMatchContext } {
  if (typeof rawQuery === "string") return { query: rawQuery, context: {} };
  return {
    query: rawQuery.query,
    context: {
      categorySlug: rawQuery.categorySlug ?? null,
      categoryName: rawQuery.categoryName ?? null,
      expenseGroup: rawQuery.expenseGroup ?? null
    }
  };
}

function buildCacheKey(normalized: string, context: ReferenceMatchContext) {
  return [
    normalized,
    normalizeBatchQuery(context.categorySlug ?? ""),
    normalizeBatchQuery(context.categoryName ?? ""),
    normalizeBatchQuery(context.expenseGroup ?? "")
  ].join("\n");
}

function buildNoAutomaticPriceResult(query: string): BestPriceResult {
  return {
    query,
    provider: "none",
    offers: [],
    error: null
  };
}

function automaticPriceBlockedByProduceContext(context: ReferenceMatchContext) {
  const categorySlug = knownCategorySlug(context.categorySlug);
  const contextText = normalizeBatchQuery([context.categorySlug, context.categoryName].filter(Boolean).join(" "));
  return (
    categorySlug !== "nao-pereciveis" &&
    !contextText.includes("nao pereciveis") &&
    referenceContextIsProduce(context)
  );
}

function isRelevantBestPriceOffer(query: string, context: ReferenceMatchContext = {}): BestPriceOfferPredicate {
  return (offer) => isRelevantReferenceTitle(query, offer.title) && semanticBestPriceMatch(query, offer.title, context);
}

function filterBestPriceResultByRelevance(
  result: BestPriceResult,
  query: string,
  context: ReferenceMatchContext
): BestPriceResult {
  return {
    ...result,
    offers: result.offers.filter(isRelevantBestPriceOffer(query, context))
  };
}

async function searchRelevantBestPriceWithFallback(
  search: SearchBestPriceFn,
  query: string,
  context: ReferenceMatchContext,
  offerLimit: number,
  timeoutMs: number
): Promise<BestPriceResult> {
  const relevancePredicate = isRelevantBestPriceOffer(query, context);
  const fallbackQuery = buildCoreFallbackQuery(query);
  const normalizedFallback =
    fallbackQuery && normalizeBatchQuery(fallbackQuery) !== normalizeBatchQuery(query) ? fallbackQuery : null;
  return filterBestPriceResultByRelevance(
    await searchWithTimeout(
      search,
      query,
      offerLimit,
      timeoutMs,
      relevancePredicate,
      normalizedFallback,
      BEST_PRICE_BATCH_RELEVANCE_CANDIDATE_LIMIT
    ),
    query,
    context
  );
}

export function semanticBestPriceMatch(
  itemText: string,
  offerTitle: string,
  context: ReferenceMatchContext = {}
) {
  const itemCategorySlug = knownCategorySlug(context.categorySlug);
  const itemNouns = extractNounCandidates(itemText, itemCategorySlug, "item");
  const titleNouns = extractNounCandidates(offerTitle, itemCategorySlug, "title");
  if (itemNouns.size > 0 && titleNouns.size > 0 && !tokenSetsIntersect(itemNouns, titleNouns)) {
    return false;
  }

  const productCategorySlug = inferProductCategorySlug(offerTitle);
  if (
    itemCategorySlug &&
    productCategorySlug &&
    !categorySlugsAreCompatible(itemCategorySlug, productCategorySlug)
  ) {
    return false;
  }

  if (
    itemCategorySlug === "transporte" &&
    productCategorySlug &&
    !categorySlugsAreCompatible(itemCategorySlug, productCategorySlug) &&
    hasLooseTransportQualifier(offerTitle)
  ) {
    return false;
  }

  return true;
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

function extractNounCandidates(
  text: string,
  itemCategorySlug: string | null,
  side: "item" | "title"
) {
  const normalized = normalizeReferenceQuery(text);
  const tokenSet = new Set(tokenize(normalized));
  const knownNouns = knownNounsInText(normalized);
  const genericNouns = [...tokenSet].filter((token) => !NON_NOUN_TOKENS.has(token) && !/^\d+$/.test(token));

  if (itemCategorySlug === "transporte") {
    const transportNouns = termsPresentInText(normalized, TRANSPORT_NOUN_TERMS);
    if (transportNouns.size > 0) return transportNouns;
    if (side === "item" && tokenSet.has("transporte")) return new Set<string>();
    return new Set([...knownNouns, ...genericNouns.filter((token) => token !== "transporte")]);
  }

  return new Set([...knownNouns, ...genericNouns]);
}

function knownNounsInText(normalizedText: string) {
  const nouns = new Set<string>();
  for (const terms of Object.values(STRONG_PRODUCT_CATEGORY_TERMS)) {
    for (const term of terms) {
      if (!normalizedTextHasTerm(normalizedText, term)) continue;
      for (const token of tokenize(term)) {
        if (!NON_NOUN_TOKENS.has(token)) nouns.add(token);
      }
    }
  }
  return nouns;
}

function inferProductCategorySlug(title: string) {
  const normalizedTitle = normalizeReferenceQuery(title);
  let bestSlug: string | null = null;
  let bestScore = 0;
  let tied = false;

  for (const [slug, terms] of Object.entries(STRONG_PRODUCT_CATEGORY_TERMS)) {
    let score = 0;
    for (const term of terms) {
      if (!normalizedTextHasTerm(normalizedTitle, term)) continue;
      score += tokenize(term).length || 1;
    }
    if (score === 0) continue;
    if (score > bestScore) {
      bestSlug = slug;
      bestScore = score;
      tied = false;
    } else if (score === bestScore) {
      tied = true;
    }
  }

  return tied ? null : bestSlug;
}

function knownCategorySlug(slug: string | null | undefined) {
  if (!slug) return null;
  const normalizedSlug = normalizeBatchQuery(slug).replace(/\s+/g, "-");
  return categoriesBySlug.has(normalizedSlug) ? normalizedSlug : null;
}

function categorySlugsAreCompatible(itemSlug: string, productSlug: string) {
  if (itemSlug === productSlug) return true;
  return ancestorsForCategory(itemSlug).has(productSlug) || ancestorsForCategory(productSlug).has(itemSlug);
}

function ancestorsForCategory(slug: string) {
  const ancestors = new Set<string>();
  let current = categoriesBySlug.get(slug);
  while (current?.parent) {
    ancestors.add(current.parent);
    current = categoriesBySlug.get(current.parent);
  }
  return ancestors;
}

function hasLooseTransportQualifier(title: string) {
  const tokens = normalizeReferenceQuery(title).split(/\s+/).filter(Boolean);
  return tokens.some((token, index) => {
    if (index === 0 || !TRANSPORT_TOKENS.has(token)) return false;
    const previousToken = tokens[index - 1];
    if (previousToken === "de" && SERVICE_TOKENS.has(tokens[index - 2])) return false;
    return TRANSPORT_QUALIFIER_PREPOSITIONS.has(previousToken);
  });
}

function termsPresentInText(normalizedText: string, terms: readonly string[]) {
  const present = new Set<string>();
  for (const term of terms) {
    if (!normalizedTextHasTerm(normalizedText, term)) continue;
    for (const token of tokenize(term)) present.add(token);
  }
  return present;
}

function normalizedTextHasTerm(normalizedText: string, term: string) {
  const normalizedTerm = normalizeReferenceQuery(term);
  return new RegExp(`(^|\\s)${escapeRegExp(normalizedTerm)}(\\s|$)`).test(normalizedText);
}

function tokenSetsIntersect(left: Set<string>, right: Set<string>) {
  for (const leftToken of left) {
    for (const rightToken of right) {
      if (tokensMatch(leftToken, rightToken)) return true;
    }
  }
  return false;
}

function tokensMatch(left: string, right: string) {
  return left === right || left.startsWith(right) || right.startsWith(left);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TRANSPORT_NOUN_TERMS = [
  "onibus",
  "micro onibus",
  "fretamento",
  "veiculo",
  "van",
  "motorista",
  "caminhao"
];

const STRONG_PRODUCT_CATEGORY_TERMS: Record<string, string[]> = {
  transporte: [
    "onibus",
    "micro onibus",
    "fretamento",
    "veiculo",
    "van",
    "motorista",
    "caminhao",
    "gasolina",
    "diesel",
    "etanol",
    "pneu"
  ],
  "limpeza-higiene": [
    "porta escova",
    "escova",
    "escova de dente",
    "sabonete",
    "pasta de dente",
    "fio dental",
    "desinfetante",
    "detergente",
    "agua sanitaria",
    "papel higienico",
    "vassoura",
    "rodo",
    "balde",
    "esponja"
  ],
  utensilios: ["faca", "faqueiro", "panela", "talher", "garfo", "colher", "prato", "copo", "jarra"],
  construcao: ["cimento", "areia", "brita", "tijolo", "telha", "argamassa", "tinta", "janela", "parafuso"],
  "nao-pereciveis": ["cafe", "arroz", "feijao", "acucar", "oleo", "macarrao", "farinha", "sal"],
  "frutas-e-verduras": ["cenoura", "banana", "maca", "laranja", "tomate", "cebola", "batata", "alface"],
  "material-de-escritorio": ["papel", "resma", "caneta", "lapis", "borracha", "caderno", "clips", "pasta"],
  eletronicos: ["televisao", "tv", "geladeira", "fogao", "liquidificador", "ventilador"],
  informatica: ["computador", "notebook", "monitor", "mouse", "teclado", "impressora", "roteador"]
};

const TRANSPORT_TOKENS = new Set(["transporte", "transportes"]);
const TRANSPORT_QUALIFIER_PREPOSITIONS = new Set(["para", "em", "de", "a", "com"]);
const SERVICE_TOKENS = new Set(["servico", "servicos"]);

const NON_NOUN_TOKENS = new Set([
  "servico",
  "servicos",
  "contratacao",
  "contratar",
  "aquisicao",
  "fornecimento",
  "prestacao",
  "eventual",
  "continuo",
  "continua",
  "perfeito",
  "perfeita",
  "industrial",
  "novo",
  "nova",
  "escolar",
  "educativo",
  "educativa",
  "educativos",
  "educativas",
  "atividades",
  "atividade",
  "fins",
  "estudante",
  "estudantes",
  "aluno",
  "alunos",
  "lugar",
  "lugares",
  "proteca",
  "protecao",
  "unidades",
  "unidade",
  "embalagem",
  "preco",
  "unitario",
  "unitaria",
  "tradicional",
  "torrado",
  "moido",
  "extra",
  "forte"
]);

async function searchWithTimeout(
  search: SearchBestPriceFn,
  query: string,
  offerLimit: number,
  timeoutMs: number,
  isRelevantOffer?: BestPriceOfferPredicate,
  fallbackQuery?: string | null,
  fallbackLimit?: number
): Promise<BestPriceResult> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      search(query, offerLimit, isRelevantOffer, fallbackQuery, fallbackLimit),
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
