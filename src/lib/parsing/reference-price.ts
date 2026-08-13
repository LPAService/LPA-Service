const MONEY_RE = /r\$\s*((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})/giu;
const PRICE_MARKER_RE = /(?:pre[cç]o(?:\s+m[eé]dio)?(?:\s+(?:apurado|de\s+refer[eê]ncia))*|valor(?:\s+mensal)?\s+de\s+refer[eê]ncia(?:\s+apurado)?)(?:\s+apurado)?(?:\s+(?:e\s+de|de))?\s*:?\s*$/iu;
const DIFFERENT_BASIS_RE = /\b(?:m[eê]s|mensal|por\s+(?!unidade\b|unid\b|un\b|kg\b|quilo\b|pacote\b|pct\b|litro\b|l\b|metro\b|m\b|caixa\b|cx\b)(?:[a-zà-ú]+))/iu;

export type ReferencePriceParseResult = {
  value: number | null;
  reason: "ok" | "no-price" | "ambiguous" | "different-basis";
};

export function extractReferencePrice(text: string | null | undefined) {
  return parseReferencePrice(text).value;
}

export function parseReferencePrice(text: string | null | undefined): ReferencePriceParseResult {
  if (!text) return { value: null, reason: "no-price" };
  const matches = [...text.matchAll(MONEY_RE)];
  if (matches.length === 0) return { value: null, reason: "no-price" };
  if (matches.length > 1) return { value: null, reason: "ambiguous" };

  const match = matches[0]!;
  const beforeMoney = text.slice(0, match.index).trim();
  const afterMoney = text.slice(match.index + match[0].length);
  const context = `${beforeMoney.slice(-80)} ${afterMoney.slice(0, 40)}`;
  if (DIFFERENT_BASIS_RE.test(context)) return { value: null, reason: "different-basis" };

  const value = parseBrazilianMoney(match[1]);
  if (value === null) return { value: null, reason: "no-price" };

  const hasMarker = PRICE_MARKER_RE.test(beforeMoney);
  return hasMarker || matches.length === 1 ? { value, reason: "ok" } : { value: null, reason: "no-price" };
}

function parseBrazilianMoney(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
