import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  buildQuotationPortalUrl,
  getQuotationProposalTarget
} from "@/lib/data/quotation-source";

const PORTAL_PROFILE_URL = "https://caixaescolar.educacao.mg.gov.br/selecionar-perfil";

type RouteContext = {
  params: Promise<{ externalId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { externalId } = await params;
  const target = await getQuotationProposalTarget(db, externalId);
  if (!target) return NextResponse.redirect(PORTAL_PROFILE_URL, 302);

  return NextResponse.redirect(buildQuotationPortalUrl(target), 302);
}
