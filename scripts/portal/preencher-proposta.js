/**
 * Preenche o formulário "Cadastrar Proposta" do SGD a partir de um pré-orçamento.
 *
 * Roda DENTRO da aba do portal (Claude in Chrome injeta via javascript_tool).
 * Os ids foram confirmados no formulário real (orçamento 2026200309):
 *   nuValueByItem_<ordem>         valor unitário — input com máscara de moeda
 *   totalValue_<ordem>            total da linha — readonly, o Angular calcula
 *   txItemObservation_<ordem>     observações — obrigatório, máx 2000
 *   txWarrantyDescription_<ordem> garantia — só existe quando o item exige
 * Os dois campos de prazo de entrega são <input type="text"> com placeholder
 * "dd/mm/yyyy", sem id, sem formcontrolname e sem min/max.
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
 * não preenche prazo de entrega. Medido no portal em 17/09/2026: o calendário
 * exibiu 42 dias e zero datas desabilitadas. Como o portal não bloqueia
 * nenhuma data, o prazo é decisão comercial do fornecedor, não do robô.
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

  // 6.9 -> "690": a máscara monta os centavos a partir dos dígitos digitados.
  const digitos = (valor) => String(Math.round(valor * 100));

  for (const item of proposta.items) {
    const campoValor = document.getElementById(`nuValueByItem_${item.itemOrder}`);
    const campoObs = document.getElementById(`txItemObservation_${item.itemOrder}`);
    const campoGarantia = document.getElementById(`txWarrantyDescription_${item.itemOrder}`);

    if (!campoValor || !campoObs) {
      rel.faltando.push({
        itemOrder: item.itemOrder,
        nome: item.name,
        motivo: motivoFaltando(item.itemOrder)
      });
      continue;
    }
    rel.encontrados++;

    // O valor sai na lista de digitação; textos podem ser escritos direto.
    rel.paraDigitar.push({
      itemOrder: item.itemOrder,
      campoId: `nuValueByItem_${item.itemOrder}`,
      seletor: `#nuValueByItem_${item.itemOrder}`,
      digitos: digitos(item.nuValueByItem),
      valor: item.nuValueByItem,
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
  const itens = [];
  const faltando = [];
  const divergencias = [];

  for (const item of proposta.items) {
    const campoTotal = document.getElementById(`totalValue_${item.itemOrder}`);
    const esperado = item.totalValue;
    if (!campoTotal) {
      itens.push({ itemOrder: item.itemOrder, esperado, lido: null, ok: false });
      faltando.push({ itemOrder: item.itemOrder, nome: item.name, motivo: motivoFaltando(item.itemOrder) });
      continue;
    }

    const lido = paraNumero(valorDoCampo(campoTotal));
    const ok = lido !== null && Math.abs(lido - esperado) <= 0.01;
    const linha = { itemOrder: item.itemOrder, esperado, lido, ok };
    itens.push(linha);
    if (!ok) {
      divergencias.push(linha);
    }
  }

  return {
    ok: faltando.length === 0 && divergencias.length === 0,
    itens,
    faltando,
    divergencias
  };
}

function motivoFaltando(itemOrder) {
  return temCamposDeOutrosItens(itemOrder) ? "fora-desta-pagina" : "inexistente";
}

function temCamposDeOutrosItens(itemOrder) {
  const sufixo = `_${itemOrder}`;
  const campos = document.querySelectorAll(
    "[id^='nuValueByItem_'], [id^='totalValue_'], [id^='txItemObservation_'], [id^='txWarrantyDescription_']"
  );
  return Array.from(campos).some((campo) => typeof campo.id === "string" && !campo.id.endsWith(sufixo));
}

function valorDoCampo(campo) {
  return "value" in campo ? campo.value : campo.textContent;
}

// "R$ 1.234,56" -> 1234.56
function paraNumero(texto) {
  const n = Number(String(texto ?? "").replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
