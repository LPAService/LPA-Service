import { describe, expect, it } from "vitest";
import { buildProposalPayload } from "@/lib/prequote/proposal-payload";

const line = (over: Partial<Parameters<typeof buildProposalPayload>[0]["items"][number]> = {}) => ({
  itemOrder: 1,
  name: "Açúcar cristal",
  description: "Açúcar cristal, pacote de 5 KG.",
  quantity: 100,
  unit: "KG",
  unitCost: 5,
  notes: "Açúcar cristal, 100 KG.",
  warranty: "Produto lacrado, validade mínima de 6 meses.",
  ...over
});

const preQuote = (over: Partial<Parameters<typeof buildProposalPayload>[0]> = {}) => ({
  id: 7,
  quotationExternalId: "702-8374-366251",
  marginPercent: 20,
  freightCost: 0,
  items: [line()],
  ...over
});

describe("proposta para o portal", () => {
  it("aplica a margem no valor unitário e ordena pelos itens do orçamento", () => {
    const result = buildProposalPayload(
      preQuote({
        items: [
          line({ itemOrder: 2, name: "Sal", unitCost: 2, quantity: 10 }),
          line({ itemOrder: 1, unitCost: 5, quantity: 100 })
        ]
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.items.map((item) => item.itemOrder)).toEqual([1, 2]);
    // 5 * 1,20 = 6,00 e 2 * 1,20 = 2,40 — mesma conta que a tela mostra
    expect(result.payload.items[0].nuValueByItem).toBe(6);
    expect(result.payload.items[0].totalValue).toBe(600);
    expect(result.payload.items[1].nuValueByItem).toBe(2.4);
    expect(result.payload.itemsTotal).toBe(624);
  });

  it("recusa quando falta preço: proposta pela metade vira lance errado", () => {
    const result = buildProposalPayload(
      preQuote({ items: [line({ itemOrder: 1 }), line({ itemOrder: 2, name: "Sal", unitCost: null })] })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.blockers).toEqual(["Item 2 (Sal): sem preço."]);
  });

  it("recusa quando falta observação, que o portal exige", () => {
    const result = buildProposalPayload(preQuote({ items: [line({ notes: "   " })] }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.blockers[0]).toContain("sem observações");
  });

  it("recusa texto acima do limite de 2000 do portal", () => {
    const longo = "x".repeat(2001);
    expect(buildProposalPayload(preQuote({ items: [line({ notes: longo })] })).ok).toBe(false);
    expect(buildProposalPayload(preQuote({ items: [line({ warranty: longo })] })).ok).toBe(false);
  });

  it("recusa ordem repetida: os dois itens disputariam o mesmo campo no portal", () => {
    const result = buildProposalPayload(
      preQuote({ items: [line({ itemOrder: 3 }), line({ itemOrder: 3, name: "Outro" })] })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.blockers[0]).toContain("ordem repetida");
  });

  it("garantia vazia passa: nem todo item do portal exige garantia", () => {
    const result = buildProposalPayload(preQuote({ items: [line({ warranty: null })] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.items[0].txWarrantyDescription).toBe("");
  });

  it("mantém identificador externo e campos que casam com os ids reais do DOM", () => {
    const result = buildProposalPayload(preQuote());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.quotationExternalId).toBe("702-8374-366251");
    expect(result.payload.items[0]).toMatchObject({
      itemOrder: 1,
      nuValueByItem: 6,
      totalValue: 600,
      txItemObservation: "Açúcar cristal, 100 KG.",
      txWarrantyDescription: "Produto lacrado, validade mínima de 6 meses.",
      brandOptions: [],
      chosenBrand: null
    });
  });

  it("inclui opções de marca e prefixa marca escolhida na garantia", () => {
    const result = buildProposalPayload(preQuote({
      items: [
        line({
          description: "Marcas: PERFA,MORATO,APOLLO .",
          chosenBrand: "Morato"
        })
      ]
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.items[0]).toMatchObject({
      brandOptions: ["Perfa", "Morato", "Apollo"],
      chosenBrand: "Morato",
      txWarrantyDescription: "Marca ofertada: Morato. Produto lacrado, validade mínima de 6 meses."
    });
  });

  it("recusa item com marca exigida sem marca escolhida", () => {
    const result = buildProposalPayload(preQuote({
      items: [line({ description: "Exigência de Marcas: Itambé, Porto Alegre e Quatá." })]
    }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.blockers).toEqual([
      "Item 1 (Açúcar cristal): exige marca ofertada e nenhuma foi escolhida."
    ]);
  });

  it("recusa marca escolhida fora das marcas exigidas", () => {
    const result = buildProposalPayload(preQuote({
      items: [
        line({
          description: "MARCAS EXIGIDAS : QUALY,DORIANA,DELICIA",
          chosenBrand: "Manteiga X"
        })
      ]
    }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.blockers).toEqual([
      "Item 1 (Açúcar cristal): marca ofertada \"Manteiga X\" não está entre as exigidas."
    ]);
  });

  it("junta todos os bloqueios de uma vez em vez de parar no primeiro", () => {
    const result = buildProposalPayload(
      preQuote({
        items: [
          line({ itemOrder: 1, unitCost: null }),
          line({ itemOrder: 2, name: "Sal", notes: "" }),
          line({ itemOrder: 3, name: "Arroz", unitCost: null })
        ]
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.blockers).toHaveLength(3);
  });

  it("pré-orçamento sem item nenhum não vira proposta", () => {
    const result = buildProposalPayload(preQuote({ items: [] }));
    expect(result.ok).toBe(false);
  });
});
