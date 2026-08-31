import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { tokenize } from "@/lib/catalog/match";
import categoriesRaw from "@/lib/classification/categories.json";
import type * as schema from "@/lib/db/schema";

export type ReferenceProductLite = {
  id: number;
  source: string;
  name: string;
  normalizedName: string;
  ean: string | null;
  brand: string | null;
  department: string | null;
  url: string | null;
};

export type ReferenceMatch = {
  item: ReferenceProductLite;
  score: number;
  matchedTokens: string[];
};

type ReferenceDatabase = NodePgDatabase<typeof schema>;
type ReferenceDomain = "produce" | "food" | "cleaning" | "personal-care" | "stationery" | "footwear" | "automotive" | "unknown";

export type ReferenceMatchContext = {
  categorySlug?: string | null;
  categoryName?: string | null;
  expenseGroup?: string | null;
};

const CESCOM_SOURCE = "cescom";
const MIN_SCORE = 1.5;

type ReferenceMatchRow = {
  id: number;
  source: string;
  name: string;
  normalized_name: string;
  ean: string | null;
  brand: string | null;
  department: string | null;
  url: string | null;
  score: number;
};

export async function matchReferenceProducts(
  database: ReferenceDatabase,
  itemText: string,
  limit = 3,
  context: ReferenceMatchContext = {}
): Promise<ReferenceMatch[]> {
  const normalizedQuery = normalizeReferenceQuery(itemText);
  const queryTokens = tokenize(normalizedQuery);
  if (queryTokens.length === 0) return [];

  const coreToken = firstCoreToken(queryTokens);
  if (!coreToken) return [];

  const coreTokenArray = buildCoreTokenArray(queryTokens, coreToken);
  const rankQuery = buildRankQuery(normalizedQuery, queryTokens);
  const tsQuery = buildTsQuery(queryTokens);
  const tokenArray = sql`array[${sql.join(queryTokens.map((token) => sql`${token}`), sql`, `)}]::text[]`;
  const safeLimit = Math.max(1, Math.floor(limit));
  const candidateLimit = Math.max(safeLimit * 30, 60);
  const blockedDomains = blockedReferenceDomainsForContext(context, queryTokens);
  const result = await database.execute<ReferenceMatchRow>(sql`
    with input as (
      select
        ${rankQuery}::text as rank_query,
        ${coreToken}::text as core_token,
        ${coreTokenArray} as core_tokens,
        ${tsQuery}::text as ts_query,
        ${tokenArray} as tokens
    ),
    ranked as (
      select
        rp.id,
        rp.source,
        rp.name,
        rp.normalized_name,
        rp.ean,
        rp.brand,
        rp.department,
        rp.url,
        (
          similarity(rp.normalized_name, input.rank_query) * 2.5
          + word_similarity(rp.normalized_name, input.rank_query) * 1.5
          + ts_rank_cd(to_tsvector('portuguese', rp.normalized_name), to_tsquery('portuguese', input.ts_query)) * 8
          + coalesce((
              select sum(
                case
                  when token = any(product.tokens)
                    then greatest(length(token), 2)
                  else 0
                end
              )::double precision / nullif(sum(greatest(length(token), 2)), 0)
              from unnest(input.tokens) as token
            ), 0) * 3
          + case when rp.normalized_name ilike input.core_token || '%' then 1 else 0 end
        )::double precision as score
      from reference_products rp
      cross join input
      cross join lateral regexp_split_to_array(trim(rp.normalized_name), '\\s+') as product(tokens)
      where rp.source = ${CESCOM_SOURCE}
        and product.tokens[1] = any(input.core_tokens)
        and (
          rp.normalized_name % input.rank_query
          or to_tsvector('portuguese', rp.normalized_name) @@ to_tsquery('portuguese', input.ts_query)
          or rp.normalized_name ilike input.core_token || '%'
        )
    )
    select *
    from ranked
    where score >= ${MIN_SCORE}
    order by score desc, normalized_name asc, id asc
    limit ${candidateLimit}
  `);

  const matches: ReferenceMatch[] = [];
  for (const row of result.rows) {
    const item = {
      id: row.id,
      source: row.source,
      name: row.name,
      normalizedName: row.normalized_name,
      ean: row.ean,
      brand: row.brand,
      department: row.department,
      url: row.url
    };
    if (referenceDepartmentBlocked(item.department, blockedDomains)) continue;
    const itemTokens = tokenize(`${item.name} ${item.brand ?? ""} ${item.department ?? ""}`);
    if (itemTokens.length === 0) continue;
    const itemTokenSet = new Set(itemTokens);
    const matchedTokens = queryTokens.filter((token) => itemTokenSet.has(token));
    if (!hasDistinctiveTokenMatch(queryTokens, coreToken, matchedTokens)) continue;
    matches.push({ item, score: row.score, matchedTokens });
    if (matches.length >= safeLimit) break;
  }

  return matches;
}

function normalizeReferenceQuery(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\b(\d+)\s*(metros?|mts?|mt|m)\b/g, "$1 metros")
    .replace(/\b(\d+)\s*(kgs?|kg)\b/g, "$1 kg")
    .replace(/\b(\d+)\s*(mls?|ml)\b/g, "$1 ml")
    .replace(/\b(\d+)\s*(grs?|gramas?|g)\b/g, "$1 g")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildRankQuery(normalizedQuery: string, queryTokens: string[]) {
  return [...new Set(queryTokens)].join(" ") || normalizedQuery;
}

function buildTsQuery(queryTokens: string[]) {
  return queryTokens.map((token) => `${token}:*`).join(" | ");
}

function firstCoreToken(queryTokens: string[]) {
  return queryTokens.find((token) => !REFERENCE_CORE_STOP_WORDS.has(token) && !/^\d+$/.test(token)) ?? null;
}

function buildCoreTokenArray(queryTokens: string[], fallbackToken: string) {
  const coreTokens = queryTokens.filter(
    (token) => !REFERENCE_CORE_STOP_WORDS.has(token) && !REFERENCE_ATTRIBUTE_TOKENS.has(token) && !/^\d+$/.test(token)
  );
  const values = coreTokens.length > 0 ? coreTokens : [fallbackToken];
  return sql`array[${sql.join(values.map((token) => sql`${token}`), sql`, `)}]::text[]`;
}

function hasDistinctiveTokenMatch(queryTokens: string[], coreToken: string, matchedTokens: string[]) {
  const distinctiveTokens = queryTokens.filter(
    (token) => token !== coreToken && !REFERENCE_ATTRIBUTE_TOKENS.has(token) && !/^\d+$/.test(token)
  );
  if (distinctiveTokens.length === 0) return true;

  const matchedTokenSet = new Set(matchedTokens);
  return distinctiveTokens.some((token) => matchedTokenSet.has(token));
}

function blockedReferenceDomainsForContext(context: ReferenceMatchContext, queryTokens: string[]): Set<ReferenceDomain> | null {
  const contextText = normalizeReferenceQuery(
    [context.categorySlug, context.categoryName, context.expenseGroup].filter(Boolean).join(" ")
  );
  if (queryLooksLikeProduce(queryTokens)) {
    return new Set(["food", "cleaning", "personal-care", "stationery", "footwear", "automotive"]);
  }

  if (!contextText) return null;

  const tokens = new Set(tokenize(contextText));
  if (
    context.categorySlug === "frutas-e-verduras" ||
    hasAny(tokens, ["fruta", "frutas", "verdura", "verduras", "legume", "legumes", "hortalica", "hortalicas", "hortifruti", "perecivel", "pereciveis"])
  ) {
    return new Set(["food", "cleaning", "personal-care", "stationery", "footwear", "automotive"]);
  }

  if (
    context.categorySlug === "alimentos" ||
    hasAny(tokens, ["alimento", "alimentos", "alimenticio", "alimenticios", "genero", "generos", "merenda"])
  ) {
    return new Set(["cleaning", "personal-care", "footwear", "automotive"]);
  }

  if (
    context.categorySlug === "limpeza-higiene" ||
    hasAny(tokens, ["limpeza", "higiene", "higienico", "higienica"])
  ) {
    return new Set(["food", "stationery", "footwear", "automotive"]);
  }

  if (hasAny(tokens, ["papelaria", "material", "escolar", "expediente"])) {
    return new Set(["food", "cleaning", "personal-care", "footwear", "automotive"]);
  }

  return null;
}

function referenceDepartmentBlocked(department: string | null, blockedDomains: Set<ReferenceDomain> | null) {
  if (!blockedDomains) return false;
  return blockedDomains.has(referenceDomainForDepartment(department));
}

function referenceDomainForDepartment(department: string | null): ReferenceDomain {
  const text = normalizeReferenceQuery(department ?? "");
  const tokens = new Set(tokenize(text));
  if (tokens.size === 0) return "unknown";

  if (hasAny(tokens, ["hortifruti", "verduras", "legumes", "hortalicas"])) return "produce";
  if (hasAny(tokens, ["havaianas"])) return "footwear";
  if (hasAny(tokens, ["automotivos", "automotivo"])) return "automotive";

  if (
    hasAny(tokens, [
      "achocolatados",
      "atomatados",
      "azeite",
      "azeites",
      "barras",
      "bebidas",
      "biscoitos",
      "bomboniere",
      "caldos",
      "catchup",
      "cereais",
      "chocolates",
      "condimentos",
      "conservas",
      "doces",
      "farinaceos",
      "graos",
      "laticinios",
      "macarrao",
      "massas",
      "molhos",
      "oleos",
      "salgadinhos",
      "snacks",
      "sobremesas",
      "temperos"
    ])
  ) {
    return "food";
  }

  if (
    hasAny(tokens, [
      "absorventes",
      "cabelos",
      "fraldas",
      "higiene",
      "infantil",
      "maos",
      "rosto",
      "sabonetes",
      "saude"
    ])
  ) {
    return "personal-care";
  }

  if (
    hasAny(tokens, [
      "banheiro",
      "cozinha",
      "desinfetantes",
      "detergentes",
      "lava",
      "limpeza",
      "lixo",
      "panos",
      "roupas",
      "sabao",
      "sacos",
      "utilitarios",
      "vassouras"
    ])
  ) {
    return "cleaning";
  }

  if (hasAny(tokens, ["acessorios", "canetas", "colas", "fitas", "papel", "papelaria"])) return "stationery";

  return "unknown";
}

function hasAny(values: Set<string>, candidates: string[]) {
  return candidates.some((candidate) => values.has(candidate));
}

const REFERENCE_CORE_STOP_WORDS = new Set([
  "tipo",
  "folha",
  "dupla",
  "simples",
  "preto",
  "preta",
  "colorido",
  "colorida",
  "leve",
  "pague",
  "metros"
]);

const REFERENCE_ATTRIBUTE_TOKENS = new Set([
  "branco",
  "branca",
  "desidratado",
  "desidratada",
  "forte",
  "integral",
  "liquido",
  "moido",
  "neutro",
  "premium",
  "tamanho",
  "tipo",
  "torrado",
  "tradicional"
]);

function queryLooksLikeProduce(queryTokens: string[]) {
  return queryTokens.some((token) => REFERENCE_PRODUCE_TOKENS.has(token));
}

const REFERENCE_PRODUCE_CATEGORY = (categoriesRaw as Array<{
  slug: string;
  keywords?: string[];
  exemplos_itens?: string[];
}>).find((category) => category.slug === "frutas-e-verduras");

const REFERENCE_PRODUCE_TOKENS = new Set([
  ...(REFERENCE_PRODUCE_CATEGORY?.keywords ?? [])
    .map((keyword) => tokenize(keyword))
    .filter((tokens) => tokens.length === 1)
    .map((tokens) => tokens[0]),
  ...(REFERENCE_PRODUCE_CATEGORY?.exemplos_itens ?? [])
    .map((example) => firstCoreToken(tokenize(example)))
    .filter((token): token is string => Boolean(token))
]);
