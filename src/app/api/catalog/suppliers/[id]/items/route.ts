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
  if (!id) return NextResponse.json({ error: "Fornecedor inválido." }, { status: 400 });
  const supplier = await catalogSource.getSupplier(id);
  if (!supplier) return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
  const items = await catalogSource.listSupplierItems(id);
  return NextResponse.json({ supplier, items });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: "Fornecedor inválido." }, { status: 400 });
    const supplier = await catalogSource.getSupplier(id);
    if (!supplier) return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
    const body = await request.json();
    const itemId = await catalogSource.upsertCatalogItem(id, body ?? {});
    const items = await catalogSource.listSupplierItems(id);
    return NextResponse.json({ itemId, items }, { status: 201 });
  } catch (error) {
    if (error instanceof CatalogValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Falha ao salvar item." }, { status: 500 });
  }
}
