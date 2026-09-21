import { NextResponse } from "next/server";
import { catalogSource } from "@/lib/data/catalog";
import { buildProposalPayload } from "@/lib/prequote/proposal-payload";
import { loadChosenBrandMap } from "../chosen-brand";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Entrega o pré-orçamento já traduzido para os campos do formulário de proposta
 * do SGD, para a automação do navegador preencher item a item.
 *
 * 409 com a lista de bloqueios quando o pré-orçamento ainda não está fechado:
 * é melhor a automação não começar do que deixar uma proposta pela metade
 * dentro do portal.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "Pré-orçamento inválido." }, { status: 400 });

  const preQuote = await catalogSource.getPreQuote(id);
  if (!preQuote) return NextResponse.json({ error: "Pré-orçamento não encontrado." }, { status: 404 });
  const choices = await loadChosenBrandMap(id);

  const result = buildProposalPayload({
    id: preQuote.id,
    quotationExternalId: preQuote.quotationExternalId,
    marginPercent: preQuote.marginPercent,
    freightCost: preQuote.freightCost,
    items: preQuote.items.map((item) => ({
      itemOrder: item.itemOrder,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitCost: item.unitCost,
      notes: item.notes,
      warranty: item.warranty,
      chosenBrand: choices.get(item.itemOrder) ?? null
    }))
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Pré-orçamento ainda não está pronto para virar proposta.", blockers: result.blockers },
      { status: 409 }
    );
  }

  return NextResponse.json({
    proposta: result.payload,
    portal: {
      proposalUrl: `/api/quotations/${encodeURIComponent(preQuote.quotationExternalId)}/proposal`,
      orderId: preQuote.orderId ?? preQuote.quotationExternalId,
      quotationExternalId: preQuote.quotationExternalId
    }
  });
}
