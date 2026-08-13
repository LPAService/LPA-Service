const REFERENCE_PRICE_RE = /pre[cç]o\s+de\s+refer[eê]ncia\s*r\$\s*((?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})?)/iu;

export function extractReferencePrice(text: string | null | undefined) {
  const match = text?.match(REFERENCE_PRICE_RE);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) ? value : null;
}
