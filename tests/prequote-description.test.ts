import { describe, expect, it } from "vitest";
import { generatePrequoteDescription } from "@/lib/prequote/generate-description";

describe("descrição automática do pré-orçamento", () => {
  it("remove marca, ruído administrativo e inclui quantidade/unidade", () => {
    const result = generatePrequoteDescription(
      "Caixa de Som ativa",
      "Caixa de Som ativa DBR ID 15 2500W - Bivolt automática - Além da caixa deve vir com manual e cabo de alimentação. VALOR",
      2,
      "UN",
      ["DBR"]
    );

    expect(result).toBe(
      "Caixa de Som ativa ID 15 2500W Bivolt automática Além da caixa deve vir com manual e cabo de alimentação — 2 UN"
    );
    expect(result).not.toContain("DBR");
    expect(result).not.toContain("VALOR");
  });

  it("remove regularização do sistema sem perder os dados do produto", () => {
    const result = generatePrequoteDescription(
      "Feijão preto",
      "Feijão carioca/carioquinha tipo 1. pct 1 Kg Regularização sistema",
      25,
      "KG",
      []
    );

    expect(result).toContain("Feijão preto");
    expect(result).toContain("Feijão carioca/carioquinha tipo 1. pct 1 Kg");
    expect(result).toContain("25 KG");
    expect(result).not.toContain("Regularização");
  });

  it("usa nome e quantidade quando a descrição só contém lixo", () => {
    expect(generatePrequoteDescription("Maçã", "Regularização", 600, "KG", [])).toBe("Maçã — 600 KG");
  });

  it("deixa vazio quando não há conteúdo de produto", () => {
    expect(generatePrequoteDescription("", "VALOR", 1, "UN", [])).toBe("");
  });
});
