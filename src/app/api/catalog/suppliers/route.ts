import { NextResponse } from "next/server";
import { CatalogValidationError } from "@/lib/catalog/source";
import { catalogSource } from "@/lib/data/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const suppliers = await catalogSource.listSuppliers();
  return NextResponse.json({ suppliers });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supplier = await catalogSource.createSupplier(body ?? {});
    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error) {
    if (error instanceof CatalogValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Falha ao criar fornecedor." }, { status: 500 });
  }
}
