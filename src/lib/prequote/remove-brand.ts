import { normalize } from "@/lib/text/normalize";

const TOKEN_PATTERN = /[\p{L}\p{N}]+|&/gu;

type TextToken = {
  normalized: string;
  start: number;
  end: number;
};

export function removeBrandFromText(text: string, brands: readonly string[]): string {
  const original = text.trim();
  if (!original) return original;

  const textTokens = tokenize(original);
  if (textTokens.length === 0) return original;

  const brandTokens = [...new Set(
    brands
      .map((brand) => tokenize(brand).map((token) => token.normalized))
      .filter((tokens) => tokens.length > 0)
      .map((tokens) => tokens.join("\u0000"))
  )]
    .map((key) => key.split("\u0000"))
    .sort((left, right) => right.length - left.length);

  const removalRanges: Array<{ start: number; end: number }> = [];
  for (let index = 0; index < textTokens.length; index++) {
    for (const candidate of brandTokens) {
      if (candidate.length > textTokens.length - index) continue;
      const matches = candidate.every(
        (token, offset) => textTokens[index + offset].normalized === token
      );
      if (!matches) continue;
      removalRanges.push({
        start: textTokens[index].start,
        end: textTokens[index + candidate.length - 1].end
      });
      index += candidate.length - 1;
      break;
    }
  }

  if (removalRanges.length === 0) return original;

  let result = original;
  for (const range of removalRanges.reverse()) {
    result = `${result.slice(0, range.start)}${result.slice(range.end)}`;
  }
  result = result
    .replace(/\(\s*\)|\[\s*\]|\{\s*\}/g, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/(^|\s)[|,:;.!?-]+(?=\s|$)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  const remainingWordCount = (result.match(/[\p{L}\p{N}]+/gu) ?? []).length;
  return remainingWordCount >= 3 ? result : original;
}

function tokenize(value: string): TextToken[] {
  return [...value.matchAll(TOKEN_PATTERN)].map((match) => ({
    normalized: normalize(match[0]),
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length
  }));
}
