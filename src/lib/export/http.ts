import type { OpportunityFilters } from "@/lib/data/source";

const FILTER_KEYS = [
  "city",
  "category",
  "expenseGroup",
  "school",
  "periodStart",
  "periodEnd",
  "query"
] as const;

export function filtersFromSearchParams(searchParams: URLSearchParams): OpportunityFilters {
  return Object.fromEntries(
    FILTER_KEYS.flatMap((key) => {
      const value = searchParams.get(key)?.trim();
      return value ? [[key, value]] : [];
    })
  ) as OpportunityFilters;
}

export function csvDownloadHeaders(prefix: string) {
  const date = new Date().toISOString().slice(0, 10);
  return {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="${prefix}-${date}.csv"`,
    "cache-control": "no-store"
  };
}
