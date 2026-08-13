import { describe, expect, it } from "vitest";
import { extractReferencePrice, parseReferencePrice } from "@/lib/parsing/reference-price";

describe("extractReferencePrice", () => {
  it.each([
    ["Preço de referência R$14,15", 14.15],
    ["Preco de referencia R$ 14,15", 14.15],
    ["Preço de referência R$1.234,56", 1234.56],
    ["Preço de referência R$ 1.234,56", 1234.56],
    ["LARANJA PERA RIO- PREÇO R$ 4,81", 4.81],
    ["PO CREAM CRAKER - PREÇO R$ 2,65", 2.65],
    ["INHAME - PREÇO R$ 7,46", 7.46],
    ["CANJICA DE MILHO R$ 2,96", 2.96],
    ["AZEITE R$ 34,20", 34.2],
    ["QUEIJO MEIA CURA R$ 58,45", 58.45],
    ["ROX. 20 A 25grs - PREÇO MÉDIO APURADO R$3,17", 3.17],
    ["PACOTE - VALOR DE REFERÊNCIA APURADO: R$161,94", 161.94],
    ["3mm – COR PRETO - PREÇO MÉDIO DE REFERÊNCIA: R$335,61", 335.61],
    ["sem preço publicado", null]
  ])("extrai preço de referência: %s", (text, expected) => {
    expect(extractReferencePrice(text)).toBe(expected);
  });

  it.each([
    ["O VALOR DE REFERENCIA E DE R$1.200,00 MÊS.", "different-basis"],
    ["VALOR MENSAL DE REFERÊNCIA APURADO PELA ESCOLA: R$273,xx", "no-price"],
    ["obrará o valor de R$ 125,00 por ônibus , sendo que", "different-basis"],
    ["Preço R$ 10,00 e desconto R$ 2,00", "ambiguous"]
  ])("bloqueia preço não unitário ou ambíguo: %s", (text, reason) => {
    expect(parseReferencePrice(text)).toEqual({ value: null, reason });
  });
});
