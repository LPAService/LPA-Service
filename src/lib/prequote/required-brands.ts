import { normalize } from "@/lib/text/normalize";

const REQUIRED_BRANDS_PATTERN =
  /(?:exig[eê]ncia\s+de\s+marcas|marcas\s+exigidas|marcas|marca)\s*:\s*([^\n\r.]+)/iu;
const LOWERCASE_WORDS = new Set(["de", "da", "das", "do", "dos"]);

export function extractRequiredBrands(description: string | null | undefined): string[] {
  if (!description) return [];

  const match = description.match(REQUIRED_BRANDS_PATTERN);
  const rawList = match?.[1]?.trim();
  if (!rawList) return [];

  const seen = new Set<string>();
  const brands: string[] = [];

  for (const part of rawList.split(/\s*(?:,|\be\b)\s*/iu)) {
    const brand = displayBrand(part);
    if (!brand) continue;

    const key = normalize(brand);
    if (seen.has(key)) continue;
    seen.add(key);
    brands.push(brand);
  }

  return brands;
}

function displayBrand(value: string) {
  const clean = value
    .replace(/^[\s,;:.-]+/u, "")
    .replace(/[\s,;:.-]+$/u, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (!clean) return "";

  const titled = clean
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|[\s'’-])([\p{L}\p{N}])/gu, (_match, prefix: string, char: string) => (
      `${prefix}${char.toLocaleUpperCase("pt-BR")}`
    ));

  return titled
    .split(" ")
    .map((word, index) => (index > 0 && LOWERCASE_WORDS.has(word.toLocaleLowerCase("pt-BR"))
      ? word.toLocaleLowerCase("pt-BR")
      : word))
    .join(" ");
}
