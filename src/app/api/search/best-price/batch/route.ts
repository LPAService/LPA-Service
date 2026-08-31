import { NextResponse } from "next/server";
import {
  BestPriceBatchLimitError,
  type SearchBestPriceBatchQuery,
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
    return NextResponse.json({ error: "Body deve ser { queries: (string | { query: string })[] }." }, { status: 400 });
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

function isBatchPayload(payload: unknown): payload is { queries: SearchBestPriceBatchQuery[] } {
  if (!payload || typeof payload !== "object") return false;
  const queries = (payload as { queries?: unknown }).queries;
  return Array.isArray(queries) && queries.every(isBatchQuery);
}

function isBatchQuery(query: unknown): query is SearchBestPriceBatchQuery {
  if (typeof query === "string") return true;
  if (!query || typeof query !== "object") return false;
  const value = query as Record<string, unknown>;
  return (
    typeof value.query === "string" &&
    isOptionalString(value.categorySlug) &&
    isOptionalString(value.categoryName) &&
    isOptionalString(value.expenseGroup)
  );
}

function isOptionalString(value: unknown) {
  return value === undefined || value === null || typeof value === "string";
}
