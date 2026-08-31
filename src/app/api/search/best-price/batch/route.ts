import { NextResponse } from "next/server";
import {
  BestPriceBatchLimitError,
  searchBestPriceBatch
} from "@/lib/search/best-price-batch";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!isBatchPayload(payload)) {
    return NextResponse.json({ error: "Body deve ser { queries: string[] }." }, { status: 400 });
  }

  try {
    const result = await searchBestPriceBatch(payload.queries);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BestPriceBatchLimitError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Falha na busca em lote." }, { status: 500 });
  }
}

function isBatchPayload(payload: unknown): payload is { queries: string[] } {
  if (!payload || typeof payload !== "object") return false;
  const queries = (payload as { queries?: unknown }).queries;
  return Array.isArray(queries) && queries.every((query) => typeof query === "string");
}
