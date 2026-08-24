import { describe, expect, it } from "vitest";
import { matchCatalogItems, tokenize } from "@/lib/catalog/match";
import type { CatalogItemLite } from "@/lib/catalog/match";

const items: CatalogItemLite[] = [
  {
    id: 1,
    supplierId: 1,
    supplierName: "Papelaria Central",
    name: "Papel A4 branco 500 folhas",
    normalizedName: "papel a4 branco 500 folhas",
    unit: "CX",
    unitPrice: 35
  },
  {
    id: 2,
    supplierId: 1,
    supplierName: "Papelaria Central",
    name: "Papel A4 reciclado 500 folhas",
    normalizedName: "papel a4 reciclado 500 folhas",
    unit: "CX",
    unitPrice: 39
  },
  {
    id: 3,
    supplierId: 2,
    supplierName: "Atacadão de Papel",
    name: "Papel A4 branco 500 folhas",
    normalizedName: "papel a4 branco 500 folhas",
    unit: "CX",
    unitPrice: 31.9
  },
  {
    id: 4,
    supplierId: 3,
    supplierName: "Limpeza & Cia",
    name: "Detergente neutro 5 litros",
    normalizedName: "detergente neutro 5 litros",
    unit: "UN",
    unitPrice: 12
  }
];

describe("tokenize", () => {
  it("remove acentos, pontuação e stop words", () => {
    expect(tokenize("Caneta Esferográfica AZUL de 1.0mm, CX com 50 UN")).toEqual([
      "caneta",
      "esferografica",
      "azul",
      "0mm",
      "50"
    ]);
  });
});

describe("matchCatalogItems", () => {
  it("encontra papel a4 por cobertura de tokens", () => {
    const matches = matchCatalogItems("Papel A4 branco 500 folhas", items);

    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(matches[0].item.name).toContain("Papel A4 branco");
    expect(matches[0].score).toBeGreaterThan(0.5);
  });

  it("ordena empate de score pelo menor preço", () => {
    const matches = matchCatalogItems("Papel A4 branco 500 folhas", items);
    const top = matches[0];

    expect(top.item.supplierName).toBe("Atacadão de Papel");
    expect(top.item.unitPrice).toBe(31.9);
  });

  it("ignora itens sem cobertura mínima de tokens", () => {
    const matches = matchCatalogItems("Detergente neutro 5 litros", items);

    expect(matches).toHaveLength(1);
    expect(matches[0].item.name).toBe("Detergente neutro 5 litros");
  });

  it("retorna lista vazia para texto vazio ou catálogo vazio", () => {
    expect(matchCatalogItems("", items)).toEqual([]);
    expect(matchCatalogItems("papel a4", [])).toEqual([]);
  });
});
