import { normalize } from "@/lib/text/normalize";

export type CatalogItemLite = {
  id: number;
  supplierId: number;
  supplierName: string;
  name: string;
  normalizedName: string;
  unit: string;
  unitPrice: number;
};

export type CatalogMatch = {
  item: CatalogItemLite;
  score: number;
  matchedTokens: string[];
};

const MIN_TOKEN_LENGTH = 2;
const MIN_SCORE = 0.5;

/**
 * Pontua itens do catálogo contra o texto de um item da licitação.
 * Score = cobertura dos tokens do pedido que aparecem no item do catálogo.
 */
export function matchCatalogItems(itemText: string, catalogItems: CatalogItemLite[], limit = 3): CatalogMatch[] {
  const queryTokens = tokenize(itemText);
  if (queryTokens.length === 0 || catalogItems.length === 0) return [];

  const matches: CatalogMatch[] = [];
  for (const item of catalogItems) {
    const itemTokens = tokenize(`${item.name} ${item.unit}`);
    if (itemTokens.length === 0) continue;
    const itemTokenSet = new Set(itemTokens);
    const matchedTokens = queryTokens.filter((token) => itemTokenSet.has(token));
    const score = matchedTokens.length / queryTokens.length;
    if (score >= MIN_SCORE) {
      matches.push({ item, score, matchedTokens });
    }
  }
  matches.sort((a, b) => b.score - a.score || a.item.unitPrice - b.item.unitPrice);
  return matches.slice(0, limit);
}

export function tokenize(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= MIN_TOKEN_LENGTH && !STOP_WORDS.has(token));
}

const STOP_WORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "com", "para", "por", "sem", "ou",
  "un", "und", "unid", "unidade", "cx", "pct", "kg", "ml", "lt", "l", "g", "m"
]);
