import { describe, expect, it } from "vitest";
import { generatePrequoteWarranty } from "@/lib/prequote/generate-warranty";

describe("generatePrequoteWarranty", () => {
  it.each([
    ["nao-pereciveis", "validade mínima"],
    ["frutas-e-verduras", "frescor"],
    ["material-de-escritorio", "Produto novo"],
    ["informatica", "3 meses"],
    ["servicos", "Execução"],
    ["transporte", "Execução"]
  ])("gera garantia coerente para %s", (categorySlug, expectedText) => {
    expect(generatePrequoteWarranty(categorySlug)).toContain(expectedText);
  });

  it("remove marcas do texto gerado", () => {
    expect(generatePrequoteWarranty("nao-pereciveis", ["Garantia"])).toContain("validade mínima");
  });

  it("retorna texto neutro para categoria desconhecida", () => {
    expect(generatePrequoteWarranty("categoria-inexistente")).toContain("conformidade");
  });
});
