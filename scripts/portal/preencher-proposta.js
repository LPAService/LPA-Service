/**
 * Preenche o formulário "Cadastrar Proposta" do SGD a partir de um pré-orçamento.
 *
 * Roda DENTRO da aba do portal (Claude in Chrome injeta via javascript_tool).
 * Os ids vêm do bundle do portal: cada item do orçamento gera os campos
 *   nuValueByItem_<ordem>        valor unitário (input com máscara de moeda)
 *   txItemObservation_<ordem>    observações (obrigatório, máx 2000)
 *   txWarrantyDescription_<ordem> garantia (obrigatório só se o item exigir)
 *
 * NUNCA clica em enviar. O portal separa salvar (update-proposal) de enviar
 * (send-proposal); mandar a proposta é decisão de humano e fica de fora daqui.
 *
 * Uso:
 *   preencherProposta({ items: [...] }, { dryRun: true })  -> só relatório
 *   preencherProposta({ items: [...] })                    -> preenche e confere
 */
function preencherProposta(proposta, options = {}) {
  const dryRun = options.dryRun === true;
  const relatorio = { dryRun, encontrados: 0, preenchidos: 0, faltando: [], divergencias: [] };

  const setNativo = (el, valor) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, valor);
    // Angular escuta input; blur fecha a máscara de moeda.
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  };

  // "R$ 1.234,56" -> 1234.56
  const paraNumero = (texto) => {
    const limpo = String(texto ?? "").replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(limpo);
    return Number.isFinite(n) ? n : null;
  };

  for (const item of proposta.items) {
    const campos = {
      valor: document.getElementById(`nuValueByItem_${item.itemOrder}`),
      observacao: document.getElementById(`txItemObservation_${item.itemOrder}`),
      garantia: document.getElementById(`txWarrantyDescription_${item.itemOrder}`)
    };

    if (!campos.valor || !campos.observacao) {
      // Item fora da página atual (o portal pagina de 100 em 100) ou ordem que
      // não existe nesse orçamento. Não inventa: reporta.
      relatorio.faltando.push({
        itemOrder: item.itemOrder,
        nome: item.name,
        motivo: !campos.valor ? "campo de valor não encontrado" : "campo de observação não encontrado"
      });
      continue;
    }
    relatorio.encontrados++;
    if (dryRun) continue;

    setNativo(campos.valor, String(item.nuValueByItem).replace(".", ","));
    setNativo(campos.observacao, item.txItemObservation);
    if (campos.garantia && item.txWarrantyDescription) {
      setNativo(campos.garantia, item.txWarrantyDescription);
    }
    relatorio.preenchidos++;
  }

  if (!dryRun) {
    // Confere o que ficou no campo. A máscara de moeda pode reformatar o que
    // foi escrito; sem reler, um preço errado passaria batido.
    for (const item of proposta.items) {
      const campoValor = document.getElementById(`nuValueByItem_${item.itemOrder}`);
      const campoObs = document.getElementById(`txItemObservation_${item.itemOrder}`);
      if (!campoValor || !campoObs) continue;

      const lido = paraNumero(campoValor.value);
      if (lido === null || Math.abs(lido - item.nuValueByItem) > 0.005) {
        relatorio.divergencias.push({
          itemOrder: item.itemOrder,
          campo: "valor",
          esperado: item.nuValueByItem,
          noCampo: campoValor.value
        });
      }
      if (campoObs.value.trim() !== item.txItemObservation.trim()) {
        relatorio.divergencias.push({ itemOrder: item.itemOrder, campo: "observações", esperado: item.txItemObservation, noCampo: campoObs.value });
      }
    }
  }

  relatorio.ok = relatorio.faltando.length === 0 && relatorio.divergencias.length === 0;
  return relatorio;
}
