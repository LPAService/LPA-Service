import { calcPreQuoteLineTotals } from "@/lib/prequote/calc";

/**
 * Traduz um pré-orçamento para o formato que o formulário de proposta do SGD espera.
 *
 * Os nomes dos campos vêm do bundle do portal (chunk-CWW7GISC.js): cada item do
 * orçamento vira um FormGroup com nuValueByItem, txItemObservation e
 * txWarrantyDescription, e os inputs no DOM têm id `<campo>_<nuItemOrder>`.
 * txItemObservation é obrigatório lá; txWarrantyDescription só quando o item
 * exige garantia. Manter esses nomes aqui é de propósito: é o contrato com a
 * tela do portal, não um nome nosso.
 */
export type ProposalItemPayload = {
  /** nuItemOrder — casa com o sufixo do id do campo no portal. */
  itemOrder: number;
  name: string;
  quantity: number;
  unit: string;
  /** nuValueByItem: custo unitário JÁ com a margem aplicada. */
  nuValueByItem: number;
  /** Só para conferência humana; no portal esse campo é readonly e calculado. */
  totalValue: number;
  /** txItemObservation — obrigatório no portal. */
  txItemObservation: string;
  /** txWarrantyDescription. */
  txWarrantyDescription: string;
};

export type ProposalPayload = {
  quotationExternalId: string;
  preQuoteId: number;
  marginPercent: number;
  itemCount: number;
  /** Soma dos totais de linha. NÃO inclui frete: o portal cobra valor por item. */
  itemsTotal: number;
  items: ProposalItemPayload[];
};

export type BuildProposalResult =
  | { ok: true; payload: ProposalPayload }
  | { ok: false; blockers: string[] };

type SourceLine = {
  itemOrder: number;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number | null;
  notes: string | null;
  warranty: string | null;
};

type SourcePreQuote = {
  id: number;
  quotationExternalId: string;
  marginPercent: number;
  freightCost: number;
  items: SourceLine[];
};

const MAX_TEXT = 2000;

/**
 * Monta a proposta ou recusa com a lista do que falta.
 *
 * Recusa de propósito: isso alimenta um lance real numa licitação pública.
 * Preencher o portal com um orçamento pela metade é a versão cara do bug que
 * mostrava "-90,3%" com 31 de 32 itens sem preço. Sem tudo pronto, não sai.
 */
export function buildProposalPayload(preQuote: SourcePreQuote): BuildProposalResult {
  const blockers: string[] = [];

  if (preQuote.items.length === 0) {
    return { ok: false, blockers: ["O pré-orçamento não tem nenhum item."] };
  }

  const items: ProposalItemPayload[] = [];
  const seenOrders = new Set<number>();

  for (const line of [...preQuote.items].sort((a, b) => a.itemOrder - b.itemOrder)) {
    const label = `Item ${line.itemOrder} (${line.name})`;

    if (seenOrders.has(line.itemOrder)) {
      // Ordem duplicada colidiria no id do campo (nuValueByItem_3) e um item
      // sobrescreveria o outro em silêncio.
      blockers.push(`${label}: ordem repetida — o portal identifica o campo pela ordem.`);
      continue;
    }
    seenOrders.add(line.itemOrder);

    const { unitFinalCost, lineTotal } = calcPreQuoteLineTotals(
      { quantity: line.quantity, unitCost: line.unitCost },
      preQuote.marginPercent
    );

    if (unitFinalCost === null || lineTotal === null) {
      blockers.push(`${label}: sem preço.`);
      continue;
    }

    const observation = (line.notes ?? "").trim();
    if (!observation) {
      // O portal marca txItemObservation como required; sem isso o form nem envia.
      blockers.push(`${label}: sem observações (o portal exige).`);
      continue;
    }
    if (observation.length > MAX_TEXT) {
      blockers.push(`${label}: observações com ${observation.length} caracteres (o portal aceita ${MAX_TEXT}).`);
      continue;
    }

    const warranty = (line.warranty ?? "").trim();
    if (warranty.length > MAX_TEXT) {
      blockers.push(`${label}: garantia com ${warranty.length} caracteres (o portal aceita ${MAX_TEXT}).`);
      continue;
    }

    items.push({
      itemOrder: line.itemOrder,
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
      nuValueByItem: unitFinalCost,
      totalValue: lineTotal,
      txItemObservation: observation,
      txWarrantyDescription: warranty
    });
  }

  if (blockers.length > 0) return { ok: false, blockers };

  return {
    ok: true,
    payload: {
      quotationExternalId: preQuote.quotationExternalId,
      preQuoteId: preQuote.id,
      marginPercent: preQuote.marginPercent,
      itemCount: items.length,
      itemsTotal: round2(items.reduce((total, item) => total + item.totalValue, 0)),
      items
    }
  };
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
