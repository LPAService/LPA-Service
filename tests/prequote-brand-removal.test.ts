import { describe, expect, it } from "vitest";
import { removeBrandFromText } from "@/lib/prequote/remove-brand";

describe("removeBrandFromText", () => {
  const brands = ["BARÃO", "CONDOR", "PERSONAL", "BIC"];

  it("remove marca ignorando case e acento", () => {
    expect(removeBrandFromText("Café Barão Tradicional 250Gr", brands)).toBe(
      "Café Tradicional 250Gr"
    );
  });

  it("não remove marca no meio de outra palavra", () => {
    expect(removeBrandFromText("Produto personalizado escolar resistente", brands)).toBe(
      "Produto personalizado escolar resistente"
    );
  });

  it("remove marca comum só como token isolado", () => {
    expect(removeBrandFromText("Papel higiênico Personal folha dupla", brands)).toBe(
      "Papel higiênico folha dupla"
    );
  });

  it("preserva texto quando a remoção deixaria menos de três palavras", () => {
    expect(removeBrandFromText("Vassoura Condor", brands)).toBe("Vassoura Condor");
  });
});
