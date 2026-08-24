import { NextResponse } from "next/server";
import { CatalogValidationError } from "@/lib/catalog/source";
import { catalogSource } from "@/lib/data/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const preQuotes = await catalogSource.listPreQuotes();
  return NextResponse.json({ preQuotes });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = await catalogSource.createPreQuote(body ?? { quotationExternalId: "" });
    const preQuote = await catalogSource.getPreQuote(id);
    return NextResponse.json({ preQuote }, { status: 201 });
  } catch (error) {
    if (error instanceof CatalogValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Falha ao criar pré-orçamento." }, { status: 500 });
  }
}
