import { describe, expect, it } from "vitest";
import { buildBestPriceSearchQuery, extractProductDescription } from "@/lib/search/best-price-query";

describe("best-price query", () => {
  it("inclui o trecho que descreve o produto e remove data/preço administrativo", () => {
    const description =
      "SANDUÍCHE EM PÃO DE FORMA, COM FATIA DE PRESUNTO E MUÇARELA EMBALADO INDIVIDUALMENTE - ENTREGA NA ESCOLA NO DIA 24/09/2026 - PREÇO MÉDIO APURADO: R$ 6,16";

    expect(extractProductDescription(description)).toBe(
      "SANDUÍCHE EM PÃO DE FORMA, COM FATIA DE PRESUNTO E MUÇARELA EMBALADO INDIVIDUALMENTE"
    );
    const query = buildBestPriceSearchQuery("Alimentação externa para estudantes", description);
    expect(query).toContain("SANDUÍCHE EM PÃO DE FORMA");
    expect(query).toContain("Alimentação externa para estudantes");
    expect(query).not.toContain("24/09/2026");
    expect(query).not.toContain("PREÇO MÉDIO APURADO");
  });
});
