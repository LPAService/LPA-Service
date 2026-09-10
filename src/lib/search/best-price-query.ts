import { normalizeReferenceQuery } from "@/lib/catalog/reference-name-match";

const DESCRIPTION_PLACEHOLDER = /^descri[cç][aã]o do item\b/i;
const NON_PRODUCT_TAIL = /\s*(?:[-–—]\s*)?(?:entrega\b|pre[cç]o\s+m[eé]dio\b|valor\s+m[eé]dio\b|data\s+de\s+entrega\b)[\s\S]*$/i;

export function extractProductDescription(description: string) {
  const cleaned = description.replace(/\s+/g, " ").trim().replace(NON_PRODUCT_TAIL, "").trim();
  return cleaned && !DESCRIPTION_PLACEHOLDER.test(cleaned) ? cleaned : "";
}

export function buildBestPriceSearchQuery(name: string, description: string) {
  const cleanName = name.replace(/\s+/g, " ").trim();
  const productDescription = extractProductDescription(description);
  if (!productDescription) return cleanName;

  const normalizedName = normalizeReferenceQuery(cleanName);
  const normalizedDescription = normalizeReferenceQuery(productDescription);
  if (!normalizedDescription || normalizedDescription === normalizedName) return cleanName;
  return `${productDescription} ${cleanName}`.trim();
}
