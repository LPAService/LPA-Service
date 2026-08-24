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

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: "Fornecedor inválido." }, { status: 400 });
    const body = await request.json();
    const updatedId = await catalogSource.updateSupplier(id, body ?? {});
    if (!updatedId) return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
    const supplier = await catalogSource.getSupplier(updatedId);
    return NextResponse.json({ supplier });
  } catch (error) {
    if (error instanceof CatalogValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Falha ao atualizar fornecedor." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "Fornecedor inválido." }, { status: 400 });
  const deleted = await catalogSource.deleteSupplier(id);
  if (!deleted) return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
