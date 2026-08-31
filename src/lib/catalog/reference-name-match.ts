import { tokenize } from "@/lib/catalog/match";

export function normalizeReferenceQuery(value: string) {
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

export function firstReferenceCoreToken(queryTokens: string[]) {
  return queryTokens.find((token) => !REFERENCE_CORE_STOP_WORDS.has(token) && !/^\d+$/.test(token)) ?? null;
}

export function referenceCoreTokens(queryTokens: string[], fallbackToken: string) {
  const coreTokens = queryTokens.filter(
    (token) => !REFERENCE_CORE_STOP_WORDS.has(token) && !REFERENCE_ATTRIBUTE_TOKENS.has(token) && !/^\d+$/.test(token)
  );
  return coreTokens.length > 0 ? coreTokens : [fallbackToken];
}

export function hasReferenceDistinctiveTokenMatch(queryTokens: string[], coreToken: string, matchedTokens: string[]) {
  const distinctiveTokens = queryTokens.filter(
    (token) => token !== coreToken && !REFERENCE_ATTRIBUTE_TOKENS.has(token) && !/^\d+$/.test(token)
  );
  if (distinctiveTokens.length === 0) return true;

  const matchedTokenSet = new Set(matchedTokens);
  return distinctiveTokens.some((token) => matchedTokenSet.has(token));
}

export function isRelevantReferenceTitle(itemText: string, offerTitle: string) {
  const queryTokens = tokenize(normalizeReferenceQuery(itemText));
  if (queryTokens.length === 0) return false;

  const coreToken = firstReferenceCoreToken(queryTokens);
  if (!coreToken) return false;

  const titleTokens = tokenize(normalizeReferenceQuery(offerTitle));
  const titleCoreToken = firstReferenceCoreToken(titleTokens);
  if (!titleCoreToken || !referenceTokenMatches(coreToken, titleCoreToken)) return false;

  const matchedTokens = queryTokens.filter((token) =>
    titleTokens.some((titleToken) => referenceTokenMatches(token, titleToken))
  );
  return hasReferenceDistinctiveTokenMatch(queryTokens, coreToken, matchedTokens);
}

function referenceTokenMatches(queryToken: string, candidateToken: string) {
  return candidateToken === queryToken || candidateToken.startsWith(queryToken);
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
  "refinado",
  "refinada",
  "tamanho",
  "tipo",
  "torrado",
  "tradicional"
]);
