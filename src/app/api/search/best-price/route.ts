import { NextResponse } from "next/server";
import { searchBestPriceWithContext } from "@/lib/search/best-price-batch";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? 5);
  const result = await searchBestPriceWithContext(
    query,
    {
      categorySlug: url.searchParams.get("categorySlug"),
      categoryName: url.searchParams.get("categoryName"),
      expenseGroup: url.searchParams.get("expenseGroup")
    },
    limit
  );
  return NextResponse.json(result);
}
