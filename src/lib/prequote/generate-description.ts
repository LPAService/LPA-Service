import { extractProductDescription } from "@/lib/search/best-price-query";
import { removeBrandFromText } from "@/lib/prequote/remove-brand";
import { formatQuantityWithUnit } from "@/lib/quantity-format";

const ADMINISTRATIVE_TEXT = /^(?:regulariza(?:ção|cao)(?:\s+(?:do\s+)?sistema)?|valor)$/i;
const GENERIC_TEXT = /^(?:item|produto|descri[cç][aã]o(?:\s+do\s+item)?)$/i;

export function generatePrequoteDescription(
  name: string,
  description: string,
  quantity: number,
  unit: string,
  brands: readonly string[]
): string {
  const cleanName = cleanText(name);
  const cleanDescription = cleanText(extractProductDescription(description));
  const usefulDescription = isUsefulProductText(cleanDescription) ? cleanDescription : "";
  const combined = combineProductText(cleanName, usefulDescription);
  if (!isUsefulProductText(combined)) return "";

  const withoutBrand = cleanText(removeBrandFromText(combined, brands));
  if (!isUsefulProductText(withoutBrand)) return "";

  return `${withoutBrand} — ${formatQuantityWithUnit(quantity, unit)}`;
}

function combineProductText(name: string, description: string) {
  if (!name) return description;
  if (!description) return name;
  if (normalizeForComparison(description).includes(normalizeForComparison(name))) return description;
  return `${name} — ${description}`;
}

function cleanText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*(?:[-–—]\s*)?regulariza(?:ção|cao)(?:\s+(?:do\s+)?sistema)?[\s\S]*$/i, "")
    .replace(/\s*(?:[-–—]\s*)?valor\s*$/i, "")
    .replace(/[\s,.;:–—-]+$/, "")
    .trim();
}

function isUsefulProductText(value: string) {
  if (!value || GENERIC_TEXT.test(value) || ADMINISTRATIVE_TEXT.test(value)) return false;
  return /[\p{L}\p{N}]/u.test(value);
}

function normalizeForComparison(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
