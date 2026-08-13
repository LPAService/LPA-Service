import { NextResponse } from "next/server";
import { quotationSource } from "@/lib/data/source";

type RouteContext = {
  params: Promise<{ externalId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { externalId } = await context.params;
  const quotation = await quotationSource.getOpportunity(externalId);
  if (!quotation || quotation.kind !== "quotation") {
    return NextResponse.json({ error: "Cotação não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ quotation });
}
