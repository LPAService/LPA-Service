import { describe, expect, it } from "vitest";
import { hasAnyCriteria, matchesSubscription } from "@/lib/notify/match";

const quotation = {
  categoryId: 3,
  city: "Belo Horizonte",
  school: "E.E. Santos Dumont",
  headline: "Aquisição de notebooks para o laboratório",
  summary: "Modernização do laboratório de informática",
  topItems: ["Notebook i5 8 GB", "Projetor multimídia"]
};

function sub(partial: Partial<Parameters<typeof matchesSubscription>[0]>) {
  return { categoryId: null, city: null, school: null, keyword: null, active: true, ...partial };
}

describe("matchesSubscription", () => {
  it("assinatura sem critérios (curinga total) bate em qualquer cotação", () => {
    expect(matchesSubscription(sub({}), quotation)).toBe(true);
  });

  it("categoria errada não bate; categoria certa bate", () => {
    expect(matchesSubscription(sub({ categoryId: 9 }), quotation)).toBe(false);
    expect(matchesSubscription(sub({ categoryId: 3 }), quotation)).toBe(true);
  });

  it("cidade bate normalizado (sem acento, sem case)", () => {
    expect(matchesSubscription(sub({ city: "belo horizonte" }), quotation)).toBe(true);
    expect(matchesSubscription(sub({ city: "BELO HORIZONTE" }), quotation)).toBe(true);
    expect(matchesSubscription(sub({ city: "Contagem" }), quotation)).toBe(false);
  });

  it("escola bate por pedaço do nome", () => {
    expect(matchesSubscription(sub({ school: "Santos Dumont" }), quotation)).toBe(true);
    expect(matchesSubscription(sub({ school: "santos dumont" }), quotation)).toBe(true);
    expect(matchesSubscription(sub({ school: "Rui Barbosa" }), quotation)).toBe(false);
  });

  it("palavra-chave busca em escola, título, resumo e itens", () => {
    expect(matchesSubscription(sub({ keyword: "notebook" }), quotation)).toBe(true);
    expect(matchesSubscription(sub({ keyword: "projetor" }), quotation)).toBe(true);
    expect(matchesSubscription(sub({ keyword: "informática" }), quotation)).toBe(true);
    expect(matchesSubscription(sub({ keyword: "arroz" }), quotation)).toBe(false);
  });

  it("critérios combinados exigem que TODOS batam", () => {
    expect(
      matchesSubscription(sub({ categoryId: 3, city: "Belo Horizonte", keyword: "notebook" }), quotation)
    ).toBe(true);
    expect(
      matchesSubscription(sub({ categoryId: 3, city: "Contagem" }), quotation)
    ).toBe(false);
  });

  it("assinatura inativa nunca bate", () => {
    expect(matchesSubscription(sub({ keyword: "notebook", active: false }), quotation)).toBe(false);
  });
});

describe("hasAnyCriteria", () => {
  it("rejeita assinatura vazia e aceita qualquer critério preenchido", () => {
    expect(hasAnyCriteria({ categoryId: null, city: null, school: null, keyword: null })).toBe(false);
    expect(hasAnyCriteria({ categoryId: null, city: "  ", school: null, keyword: null })).toBe(false);
    expect(hasAnyCriteria({ categoryId: 3, city: null, school: null, keyword: null })).toBe(true);
    expect(hasAnyCriteria({ categoryId: null, city: null, school: null, keyword: "tinta" })).toBe(true);
  });
});
