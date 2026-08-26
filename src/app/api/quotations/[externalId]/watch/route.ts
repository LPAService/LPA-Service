import { NextResponse } from "next/server";
import { quotationSource } from "@/lib/data/source";
import { getCurrentUserId } from "@/lib/session";
import { watchStore } from "@/lib/watch";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ externalId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { externalId } = await context.params;
  const quotation = await quotationSource.getOpportunity(externalId);
  if (!quotation || quotation.kind !== "quotation") {
    return NextResponse.json({ error: "Cotação não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ watched: await watchStore.isWatched(userId, quotation.externalId) });
}

export async function POST(request: Request, context: RouteContext) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { externalId } = await context.params;
  const quotation = await quotationSource.getOpportunity(externalId);
  if (!quotation || quotation.kind !== "quotation") {
    return NextResponse.json({ error: "Cotação não encontrada" }, { status: 404 });
  }

  let watched: boolean | null = null;
  try {
    const body = (await request.json()) as { watched?: unknown } | null;
    if (body && typeof body.watched === "boolean") watched = body.watched;
  } catch {
    watched = null;
  }
  if (watched === null) watched = !(await watchStore.isWatched(userId, quotation.externalId));

  const nextWatched = await watchStore.setWatched(userId, quotation.externalId, watched);
  return NextResponse.json({ watched: nextWatched });
}
