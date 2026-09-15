// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { conferirProposta, preencherProposta } from "../scripts/portal/preencher-proposta.js";

/** DOM com a mesma forma do formulário real do portal. */
function montarFormulario(ordens: number[], opcoes: { semGarantia?: number[] } = {}) {
  document.body.innerHTML =
    ordens
      .map((ordem) => {
        const garantia = opcoes.semGarantia?.includes(ordem)
          ? ""
          : `<textarea id="txWarrantyDescription_${ordem}"></textarea>`;
        return `
          <input id="nuValueByItem_${ordem}" type="text" />
          <input id="totalValue_${ordem}" type="text" readonly value="R$ 0,00" />
          <textarea id="txItemObservation_${ordem}"></textarea>
          ${garantia}`;
      })
      .join("") + `<input id="invalidCheck" type="checkbox" />`;
}

const item = (ordem: number, over: Record<string, unknown> = {}) => ({
  itemOrder: ordem,
  name: `Item ${ordem}`,
  quantity: 330,
  unit: "Pacote",
  nuValueByItem: 6.9,
  totalValue: 2277,
  txItemObservation: `Observação do item ${ordem}`,
  txWarrantyDescription: `Garantia do item ${ordem}`,
  ...over
});

describe("preenchimento da proposta no portal", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("não escreve no campo de valor: entrega os dígitos para serem digitados", () => {
    montarFormulario([1]);
    const rel = preencherProposta({ items: [item(1)] });

    // 6,90 -> "690": a máscara monta os centavos a partir dos dígitos
    expect(rel.paraDigitar).toEqual([
      { itemOrder: 1, seletor: "#nuValueByItem_1", digitos: "690", valorEsperado: 6.9 }
    ]);
    expect((document.getElementById("nuValueByItem_1") as HTMLInputElement).value).toBe("");
  });

  it("preenche os textos, que aceitam escrita direta", () => {
    montarFormulario([1]);
    preencherProposta({ items: [item(1)] });

    expect((document.getElementById("txItemObservation_1") as HTMLTextAreaElement).value).toBe("Observação do item 1");
    expect((document.getElementById("txWarrantyDescription_1") as HTMLTextAreaElement).value).toBe("Garantia do item 1");
  });

  it("dry run não escreve nem os textos", () => {
    montarFormulario([1]);
    const rel = preencherProposta({ items: [item(1)] }, { dryRun: true });

    expect(rel).toMatchObject({ dryRun: true, encontrados: 1, textosPreenchidos: 0 });
    expect((document.getElementById("txItemObservation_1") as HTMLTextAreaElement).value).toBe("");
  });

  it("item fora da pagina atual do portal é reportado, não ignorado", () => {
    montarFormulario([1]);
    const rel = preencherProposta({ items: [item(1), item(2)] });

    expect(rel.pronto).toBe(false);
    expect(rel.faltando).toEqual([
      { itemOrder: 2, nome: "Item 2", motivo: "campo de valor não encontrado" }
    ]);
  });

  it("CONFERÊNCIA: total zerado reprova mesmo com o campo de valor preenchido", () => {
    // Caso medido no portal: o campo mostrava "6,9" e o Angular não registrou
    // nada — totalValue ficou em R$ 0,00. Ler só o campo aprovaria um lance vazio.
    montarFormulario([1]);
    (document.getElementById("nuValueByItem_1") as HTMLInputElement).value = "6,9";
    (document.getElementById("txItemObservation_1") as HTMLTextAreaElement).value = "Observação do item 1";

    const conf = conferirProposta({ items: [item(1)] });

    expect(conf.ok).toBe(false);
    expect(conf.divergencias[0]).toMatchObject({
      itemOrder: 1,
      campo: "valor",
      esperado: 2277,
      noCampo: "R$ 0,00",
      valorDigitado: "6,9"
    });
  });

  it("CONFERÊNCIA: aprova quando o total bate com o esperado", () => {
    montarFormulario([1]);
    (document.getElementById("nuValueByItem_1") as HTMLInputElement).value = "R$ 6,90";
    (document.getElementById("totalValue_1") as HTMLInputElement).value = "R$ 2.277,00";
    (document.getElementById("txItemObservation_1") as HTMLTextAreaElement).value = "Observação do item 1";

    expect(conferirProposta({ items: [item(1)] })).toMatchObject({ ok: true, aceiteMarcado: false });
  });

  it("item sem campo de garantia no portal não quebra", () => {
    montarFormulario([1], { semGarantia: [1] });
    expect(preencherProposta({ items: [item(1)] }).pronto).toBe(true);
  });
});
