import { NextResponse } from "next/server";
import { searchBestPrice } from "@/lib/search/best-price";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? 5);
  const result = await searchBestPrice(query, limit);
  return NextResponse.json(result);
}
