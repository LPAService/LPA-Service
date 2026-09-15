/**
 * Preenche o formulário "Cadastrar Proposta" do SGD a partir de um pré-orçamento.
 *
 * Roda DENTRO da aba do portal (Claude in Chrome injeta via javascript_tool).
 * Os ids foram confirmados no formulário real (orçamento 2026200309):
 *   nuValueByItem_<ordem>         valor unitário — input com máscara de moeda
 *   totalValue_<ordem>            total da linha — readonly, o Angular calcula
 *   txItemObservation_<ordem>     observações — obrigatório, máx 2000
 *   txWarrantyDescription_<ordem> garantia — só existe quando o item exige
 *   #dtGoodsDelivery input        prazo de entrega de bens
 *   #dtServiceDelivery input      prazo de execução de serviços
 *
 * O QUE ESTE SCRIPT NÃO FAZ, E POR QUÊ:
 * não escreve no campo de valor. Medido no portal em 15/09/2026: atribuir
 * `input.value = "6,9"` e disparar input/change/blur deixou "6,9" na tela mas
 * o Angular NÃO registrou nada — totalValue ficou em "R$ 0,00". Uma conferência
 * que lesse só o texto do campo teria aprovado um lance vazio. O valor precisa
 * ser DIGITADO (o campo monta a máscara a partir dos dígitos: "690" vira
 * R$ 6,90), e quem digita é a ferramenta de teclado, não este script.
 *
 * Por isso a prova de que o valor entrou é totalValue, que vem do modelo do
 * Angular — nunca o texto do próprio campo.
 *
 * NUNCA marca o aceite nem clica em enviar. O portal separa update-proposal de
 * send-proposal; mandar a proposta é decisão de humano.
 */
export function preencherProposta(proposta, options = {}) {
  const dryRun = options.dryRun === true;
  const rel = { dryRun, encontrados: 0, textosPreenchidos: 0, paraDigitar: [], faltando: [], divergencias: [] };

  const setNativo = (el, valor) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, valor);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  };

  // "R$ 1.234,56" -> 1234.56
  const paraNumero = (texto) => {
    const n = Number(String(texto ?? "").replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  // 6.9 -> "690": a máscara monta os centavos a partir dos dígitos digitados.
  const digitos = (valor) => String(Math.round(valor * 100));

  for (const item of proposta.items) {
    const campoValor = document.getElementById(`nuValueByItem_${item.itemOrder}`);
    const campoObs = document.getElementById(`txItemObservation_${item.itemOrder}`);
    const campoGarantia = document.getElementById(`txWarrantyDescription_${item.itemOrder}`);

    if (!campoValor || !campoObs) {
      // Item fora da página atual (o portal pagina de 100 em 100) ou ordem que
      // não existe nesse orçamento. Não inventa: reporta.
      rel.faltando.push({
        itemOrder: item.itemOrder,
        nome: item.name,
        motivo: !campoValor ? "campo de valor não encontrado" : "campo de observação não encontrado"
      });
      continue;
    }
    rel.encontrados++;

    // O valor sai na lista de digitação; textos podem ser escritos direto.
    rel.paraDigitar.push({
      itemOrder: item.itemOrder,
      seletor: `#nuValueByItem_${item.itemOrder}`,
      digitos: digitos(item.nuValueByItem),
      valorEsperado: item.nuValueByItem
    });

    if (dryRun) continue;

    setNativo(campoObs, item.txItemObservation);
    if (campoGarantia && item.txWarrantyDescription) {
      setNativo(campoGarantia, item.txWarrantyDescription);
    }
    rel.textosPreenchidos++;
  }

  rel.pronto = rel.faltando.length === 0;
  return rel;
}

/**
 * Confere o que REALMENTE entrou no formulário.
 *
 * Olha totalValue (vem do modelo do Angular) em vez do texto do campo de valor:
 * o campo pode exibir um número que o Angular nunca recebeu.
 */
export function conferirProposta(proposta) {
  const paraNumero = (texto) => {
    const n = Number(String(texto ?? "").replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  const divergencias = [];

  for (const item of proposta.items) {
    const campoValor = document.getElementById(`nuValueByItem_${item.itemOrder}`);
    const campoTotal = document.getElementById(`totalValue_${item.itemOrder}`);
    const campoObs = document.getElementById(`txItemObservation_${item.itemOrder}`);
    if (!campoValor || !campoObs) {
      divergencias.push({ itemOrder: item.itemOrder, campo: "formulário", motivo: "campo não encontrado" });
      continue;
    }

    const totalNaTela = paraNumero(campoTotal?.value);
    const totalEsperado = item.totalValue;
    if (totalNaTela === null || Math.abs(totalNaTela - totalEsperado) > 0.01) {
      divergencias.push({
        itemOrder: item.itemOrder,
        campo: "valor",
        motivo: "o total da linha não bate — o Angular pode não ter registrado o valor",
        esperado: totalEsperado,
        noCampo: campoTotal?.value ?? null,
        valorDigitado: campoValor.value
      });
    }

    if (campoObs.value.trim() !== item.txItemObservation.trim()) {
      divergencias.push({ itemOrder: item.itemOrder, campo: "observações", noCampo: campoObs.value.slice(0, 70) });
    }
  }

  return {
    ok: divergencias.length === 0,
    divergencias,
    // Deixado de fora de propósito: marcar o aceite é passo do envio.
    aceiteMarcado: document.getElementById("invalidCheck")?.checked ?? null
  };
}
