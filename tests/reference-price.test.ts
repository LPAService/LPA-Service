import { describe, expect, it } from "vitest";
import { extractReferencePrice } from "@/lib/parsing/reference-price";

describe("extractReferencePrice", () => {
  it.each([
    ["Preço de referência R$14,15", 14.15],
    ["Preco de referencia R$ 14,15", 14.15],
    ["Preço de referência R$1.234,56", 1234.56],
    ["Preço de referência R$ 1.234,56", 1234.56],
    ["sem preço publicado", null]
  ])("extrai preço de referência: %s", (text, expected) => {
    expect(extractReferencePrice(text)).toBe(expected);
  });
});
