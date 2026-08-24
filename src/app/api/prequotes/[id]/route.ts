import { NextResponse } from "next/server";
import { CatalogValidationError } from "@/lib/catalog/source";
import { catalogSource } from "@/lib/data/catalog";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "Pré-orçamento inválido." }, { status: 400 });
  const preQuote = await catalogSource.getPreQuote(id);
  if (!preQuote) return NextResponse.json({ error: "Pré-orçamento não encontrado." }, { status: 404 });
  return NextResponse.json({ preQuote });
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: "Pré-orçamento inválido." }, { status: 400 });
    const body = await request.json();
    const updatedId = await catalogSource.savePreQuote(id, body ?? { quotationExternalId: "" });
    if (!updatedId) return NextResponse.json({ error: "Pré-orçamento não encontrado." }, { status: 404 });
    const preQuote = await catalogSource.getPreQuote(updatedId);
    return NextResponse.json({ preQuote });
  } catch (error) {
    if (error instanceof CatalogValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Falha ao salvar pré-orçamento." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "Pré-orçamento inválido." }, { status: 400 });
  const deleted = await catalogSource.deletePreQuote(id);
  if (!deleted) return NextResponse.json({ error: "Pré-orçamento não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
