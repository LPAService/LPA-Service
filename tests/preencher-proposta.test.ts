// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { preencherProposta } from "../scripts/portal/preencher-proposta.js";

/**
 * Monta um DOM com a mesma forma do formulário do portal: por item, os ids
 * nuValueByItem_<ordem>, txItemObservation_<ordem> e txWarrantyDescription_<ordem>.
 */
function montarFormulario(ordens: number[], opcoes: { semGarantia?: number[] } = {}) {
  document.body.innerHTML = ordens
    .map((ordem) => {
      const garantia = opcoes.semGarantia?.includes(ordem)
        ? ""
        : `<textarea id="txWarrantyDescription_${ordem}"></textarea>`;
      return `
        <input id="nuValueByItem_${ordem}" type="text" />
        <textarea id="txItemObservation_${ordem}"></textarea>
        ${garantia}`;
    })
    .join("");
}

const item = (ordem: number, over: Record<string, unknown> = {}) => ({
  itemOrder: ordem,
  name: `Item ${ordem}`,
  quantity: 10,
  unit: "UN",
  nuValueByItem: 6,
  totalValue: 60,
  txItemObservation: `Observação do item ${ordem}`,
  txWarrantyDescription: `Garantia do item ${ordem}`,
  ...over
});

describe("preenchimento da proposta no portal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("dry run não escreve nada, só confere se os campos existem", () => {
    montarFormulario([1, 2]);
    const relatorio = preencherProposta({ items: [item(1), item(2)] }, { dryRun: true });

    expect(relatorio).toMatchObject({ dryRun: true, encontrados: 2, preenchidos: 0 });
    expect(relatorio.faltando).toEqual([]);
    expect((document.getElementById("nuValueByItem_1") as HTMLInputElement).value).toBe("");
  });

  it("preenche valor, observação e garantia de cada item", () => {
    montarFormulario([1, 2]);
    const relatorio = preencherProposta({ items: [item(1), item(2, { nuValueByItem: 2.4 })] });

    expect(relatorio.ok).toBe(true);
    expect(relatorio.preenchidos).toBe(2);
    expect((document.getElementById("nuValueByItem_1") as HTMLInputElement).value).toBe("6");
    expect((document.getElementById("nuValueByItem_2") as HTMLInputElement).value).toBe("2,4");
    expect((document.getElementById("txItemObservation_2") as HTMLTextAreaElement).value).toBe("Observação do item 2");
    expect((document.getElementById("txWarrantyDescription_1") as HTMLTextAreaElement).value).toBe("Garantia do item 1");
  });

  it("item fora da pagina atual do portal é reportado, não ignorado em silêncio", () => {
    montarFormulario([1]);
    const relatorio = preencherProposta({ items: [item(1), item(2)] });

    expect(relatorio.ok).toBe(false);
    expect(relatorio.preenchidos).toBe(1);
    expect(relatorio.faltando).toEqual([
      { itemOrder: 2, nome: "Item 2", motivo: "campo de valor não encontrado" }
    ]);
  });

  it("acusa divergência quando o campo ficou com valor diferente do pedido", () => {
    montarFormulario([1]);
    // Simula a máscara de moeda reescrevendo o campo depois do input.
    const campo = document.getElementById("nuValueByItem_1") as HTMLInputElement;
    campo.addEventListener("blur", () => { campo.value = "R$ 9,99"; });

    const relatorio = preencherProposta({ items: [item(1, { nuValueByItem: 6 })] });

    expect(relatorio.ok).toBe(false);
    expect(relatorio.divergencias).toEqual([
      { itemOrder: 1, campo: "valor", esperado: 6, noCampo: "R$ 9,99" }
    ]);
  });

  it("aceita o valor quando a máscara só reformata sem mudar o número", () => {
    montarFormulario([1]);
    const campo = document.getElementById("nuValueByItem_1") as HTMLInputElement;
    campo.addEventListener("blur", () => { campo.value = "R$ 1.234,56"; });

    const relatorio = preencherProposta({ items: [item(1, { nuValueByItem: 1234.56 })] });

    expect(relatorio.divergencias).toEqual([]);
    expect(relatorio.ok).toBe(true);
  });

  it("item sem campo de garantia no portal não quebra o preenchimento", () => {
    montarFormulario([1], { semGarantia: [1] });
    const relatorio = preencherProposta({ items: [item(1)] });

    expect(relatorio.ok).toBe(true);
    expect(relatorio.preenchidos).toBe(1);
  });
});
