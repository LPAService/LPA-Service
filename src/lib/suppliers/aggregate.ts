import { normalizar } from "@/lib/classification/classify";

const PRODUCT_VARIANT_WORDS = new Set(["branco", "branca"]);

export function normalizeProductName(value: string): string {
  return normalizar(value)
    .split(" ")
    .filter((word) => word.length > 0 && !PRODUCT_VARIANT_WORDS.has(word))
    .join(" ");
}

export function preferredName(names: Iterable<string>): string {
  return [...names].sort((a, b) => a.length - b.length || a.localeCompare(b, "pt-BR"))[0] ?? "";
}
