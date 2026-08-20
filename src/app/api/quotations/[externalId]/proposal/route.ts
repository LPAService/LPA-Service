import { NextResponse } from "next/server";
import { quotationSource } from "@/lib/data/source";

const PORTAL_PROFILE_URL = "https://caixaescolar.educacao.mg.gov.br/selecionar-perfil";

type RouteContext = {
  params: Promise<{ externalId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { externalId } = await params;
  const quotation = await quotationSource.getOpportunity(externalId);
  if (!quotation || quotation.kind !== "quotation") {
    return NextResponse.json({ error: "Cotação não encontrada" }, { status: 404 });
  }

  return NextResponse.redirect(PORTAL_PROFILE_URL, 302);
}
