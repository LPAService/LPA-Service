export type BestPriceOffer = {
  provider: string;
  title: string;
  price: number;
  currency: string;
  url: string;
  thumbnail: string | null;
  seller: string | null;
  condition: string | null;
  available: number | null;
};

export type BestPriceResult = {
  query: string;
  provider: string;
  offers: BestPriceOffer[];
  error: string | null;
};

export type BestPriceOfferPredicate = (offer: BestPriceOffer) => boolean;

type BestPriceProvider = {
  name: string;
  label: string;
  search: (query: string, limit: number) => Promise<BestPriceOffer[]>;
};

const MERCADO_LIVRE_API = "https://api.mercadolibre.com/sites/MLB/search";
const REALDIST_SEARCH_URL = "https://www.realdist.com.br/buscar";
const REALDIST_BASE_URL = "https://www.realdist.com.br";
const ZOOM_SEARCH_URL = "https://www.zoom.com.br/search";
const ZOOM_BASE_URL = "https://www.zoom.com.br";
const REQUEST_TIMEOUT_MS = 8000;
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const providers: Record<string, BestPriceProvider> = {
  realdist: {
    name: "realdist",
    label: "Real Distribuidora",
    search: searchRealdist
  },
  mercadolivre: {
    name: "mercadolivre",
    label: "Mercado Livre",
    search: searchMercadoLivre
  },
  zoom: {
    name: "zoom",
    label: "Zoom",
    search: searchZoom
  }
};

export function bestPriceProviderChain(): BestPriceProvider[] {
  const configured = process.env.WEB_SEARCH_PROVIDER?.trim().toLowerCase();
  if (!configured || configured === "auto") {
    // Mercado Livre saiu do auto: endpoint público retorna 403 sem OAuth, verificado em 2026-08-31.
    return [providers.realdist, providers.zoom];
  }
  if (configured === "none") return [];
  const provider = providers[configured];
  return provider ? [provider] : [providers.realdist, providers.zoom];
}

export function providerLabel(name: string) {
  return providers[name]?.label ?? name;
}

export async function searchBestPrice(
  query: string,
  limit = 5,
  isRelevantOffer?: BestPriceOfferPredicate,
  fallbackQuery?: string | null,
  fallbackLimit = limit
): Promise<BestPriceResult> {
  const cleanQuery = query.trim();
  const safeLimit = Math.min(10, Math.max(1, Math.floor(Number.isFinite(limit) ? limit : 5)));
  const cleanFallbackQuery = fallbackQuery?.trim() ?? "";
  const safeFallbackLimit = Math.min(
    10,
    Math.max(1, Math.floor(Number.isFinite(fallbackLimit) ? fallbackLimit : safeLimit))
  );
  if (!cleanQuery) {
    return { query: "", provider: "none", offers: [], error: "Termo de busca vazio." };
  }
  const chain = bestPriceProviderChain();
  if (chain.length === 0) {
    return {
      query: cleanQuery,
      provider: "none",
      offers: [],
      error: "Busca de preço na internet está desativada (WEB_SEARCH_PROVIDER=none)."
    };
  }

  let lastError: string | null = null;
  for (const provider of chain) {
    try {
      const providerOffers = await provider.search(cleanQuery, safeLimit);
      const offers = isRelevantOffer ? providerOffers.filter(isRelevantOffer) : providerOffers;
      if (offers.length > 0) {
        return { query: cleanQuery, provider: provider.name, offers, error: null };
      }
      if (isRelevantOffer && providerOffers.length > 0 && cleanFallbackQuery && cleanFallbackQuery !== cleanQuery) {
        const fallbackOffers = (await provider.search(cleanFallbackQuery, safeFallbackLimit))
          .filter(isRelevantOffer)
          .slice(0, safeLimit);
        if (fallbackOffers.length > 0) {
          return { query: cleanQuery, provider: provider.name, offers: fallbackOffers, error: null };
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Falha na busca de preço.";
    }
  }
  return {
    query: cleanQuery,
    provider: chain.map((provider) => provider.name).join("+"),
    offers: [],
    error: lastError ?? "Nenhuma oferta encontrada para este item."
  };
}

async function searchMercadoLivre(query: string, limit: number): Promise<BestPriceOffer[]> {
  const url = new URL(MERCADO_LIVRE_API);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sort", "price_asc");

  const payload = await fetchJson(url.toString(), false);
  return parseMercadoLivreResponse(payload);
}

export function parseMercadoLivreResponse(payload: unknown): BestPriceOffer[] {
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  const offers: BestPriceOffer[] = [];
  for (const entry of results) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const title = readString(row.title);
    const price = readNumber(row.price);
    const currency = readString(row.currency_id) ?? "BRL";
    const permalink = readString(row.permalink);
    if (!title || price === null || !permalink) continue;
    const seller = readSellerName(row.seller);
    offers.push({
      provider: "mercadolivre",
      title,
      price,
      currency,
      url: permalink,
      thumbnail: readString(row.thumbnail),
      seller,
      condition: readString(row.condition),
      available: readNumber(row.available_quantity)
    });
  }
  return offers;
}

async function searchRealdist(query: string, limit: number): Promise<BestPriceOffer[]> {
  const url = new URL(REALDIST_SEARCH_URL);
  url.searchParams.set("q", query);
  const html = await fetchText(url.toString());
  const offers = parseRealdistSearchResponse(html);
  return offers.slice(0, limit);
}

export type RealdistBestPriceOffer = BestPriceOffer & {
  ean: string | null;
};

export function parseRealdistSearchResponse(html: string): RealdistBestPriceOffer[] {
  if (!html || typeof html !== "string") return [];
  const htmlWithoutTemplates = html.replace(/<li\b(?=[^>]*\bminicart-item-modelo\b)[\s\S]*?<\/li>/gi, "");
  const items = htmlWithoutTemplates.split(/<(?:li|div)\b(?=[^>]*\blistagem-item\b)/i);
  const offers: RealdistBestPriceOffer[] = [];
  for (const item of items.slice(1)) {
    const chunk = item;
    if (!chunk || chunk.includes("--PRODUTO_")) continue;
    const href = readFirstGroup(
      chunk,
      /<a\b(?=[^>]*\bnome-produto\b)[^>]*\bhref=["']([^"']+)["'][^>]*>/i
    );
    const titleHtml = readFirstGroup(
      chunk,
      /<a\b(?=[^>]*\bnome-produto\b)[^>]*>([\s\S]*?)<\/a>/i
    );
    const priceValue =
      readFirstGroup(
        chunk,
        /<(?:strong|span|div)\b(?=[^>]*\bpreco-promocional\b)[^>]*\bdata-sell-price=["']([^"']+)["'][^>]*>/i
      ) ??
      readFirstGroup(
        chunk,
        /<(?:strong|span|div)\b(?=[^>]*\bpreco-venda\b)[^>]*\bdata-sell-price=["']([^"']+)["'][^>]*>/i
      );
    const price = priceValue ? Number(priceValue) : null;
    if (!href || !titleHtml || !Number.isFinite(price) || price === null || price <= 0) continue;
    const thumbnail = readFirstGroup(
      chunk,
      /<img\b(?=[^>]*\bimagem-principal\b)[^>]*\bsrc=["']([^"']+)["'][^>]*>/i
    );
    const eanHtml = readFirstGroup(
      chunk,
      /<div\b(?=[^>]*\bproduto-sku\b)[^>]*>([\s\S]*?)<\/div>/i
    );
    offers.push({
      provider: "realdist",
      title: decodeEntities(stripTags(titleHtml)).trim(),
      price: Math.round(price * 100) / 100,
      currency: "BRL",
      url: new URL(decodeEntities(href), REALDIST_BASE_URL).toString(),
      thumbnail: thumbnail ? decodeEntities(thumbnail) : null,
      seller: "Real Distribuidora",
      condition: "new",
      available: null,
      ean: eanHtml ? decodeEntities(stripTags(eanHtml)).trim() || null : null
    });
  }
  offers.sort((a, b) => a.price - b.price);
  return offers;
}

async function searchZoom(query: string, limit: number): Promise<BestPriceOffer[]> {
  const url = new URL(ZOOM_SEARCH_URL);
  url.searchParams.set("q", query);
  const html = await fetchText(url.toString());
  const offers = parseZoomSearchResponse(html);
  return offers.slice(0, limit);
}

export function parseZoomSearchResponse(html: string): BestPriceOffer[] {
  if (!html || typeof html !== "string") return [];
  const cards = html.split(/<a class="ClickableArea_OrqProductCard[^"]*"/);
  const offers: BestPriceOffer[] = [];
  for (const chunk of cards.slice(1)) {
    const href = readFirstGroup(chunk, /\bhref="([^"]+)"/);
    if (!href) continue;
    const title = decodeEntities(readFirstGroup(chunk, /data-testid="product-card::name"[^>]*>([\s\S]*?)<\/h2>/) ?? "");
    const priceText = readFirstGroup(chunk, /data-testid="product-card::price"[^>]*>[\s\S]*?<strong>\s*([^<]+)/);
    const seller = decodeEntities(readFirstGroup(chunk, /BestOfferMerchant[^>]*>[^<]*<span>([^<]*)<\/span>/) ?? "");
    const thumbnail = readFirstGroup(chunk, /\ssrc="(https:\/\/i\.zst\.com\.br[^"]+)"/);
    if (!title || !priceText) continue;
    const price = parseBrazilianPrice(priceText);
    if (price === null) continue;
    offers.push({
      provider: "zoom",
      title: decodeEntities(stripTags(title)).trim(),
      price,
      currency: "BRL",
      url: new URL(decodeEntities(href), ZOOM_BASE_URL).toString(),
      thumbnail,
      seller: seller || null,
      condition: null,
      available: null
    });
  }
  offers.sort((a, b) => a.price - b.price);
  return offers;
}

export function parseBrazilianPrice(value: string) {
  const clean = value.replace(/R\$/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const number = Number(clean);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : null;
}

function readFirstGroup(value: string, pattern: RegExp) {
  const match = pattern.exec(value);
  return match?.[1] ?? null;
}

function readSellerName(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const seller = value as Record<string, unknown>;
  return readString(seller.nickname) ?? readString(seller.official_store_name) ?? readString(seller.id);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, " ");
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function fetchJson(url: string, browserHeaders = false) {
  return (await fetchWithRetry(url, browserHeaders)) as unknown;
}

async function fetchText(url: string) {
  return (await fetchWithRetry(url, true)) as string;
}

async function fetchWithRetry(url: string, browserHeaders: boolean) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await performFetch(url, browserHeaders);
    } catch (error) {
      lastError = error;
      const isRateLimited = error instanceof BestPriceHttpError && error.status === 429;
      if (!isRateLimited || attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha na requisição de busca.");
}

async function performFetch(url: string, browserHeaders: boolean) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: browserHeaders
        ? {
            accept: "text/html,application/xhtml+xml",
            "accept-language": "pt-BR,pt;q=0.9",
            "user-agent": BROWSER_USER_AGENT
          }
        : {
            accept: "application/json",
            "user-agent": "lpa-leo/0.1 (pre-budget price lookup)"
          },
      signal: controller.signal,
      cache: "no-store"
    });
    if (!response.ok) {
      throw new BestPriceHttpError(`Busca indisponível (HTTP ${response.status}).`, response.status);
    }
    return browserHeaders ? await response.text() : ((await response.json()) as unknown);
  } catch (error) {
    if (error instanceof BestPriceHttpError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Busca excedeu o tempo limite. Tente novamente.");
    }
    throw error instanceof Error ? error : new Error("Falha na requisição de busca.");
  } finally {
    clearTimeout(timeout);
  }
}

class BestPriceHttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "BestPriceHttpError";
    this.status = status;
  }
}
