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

export function quotationSituation(value: string | undefined) {
  return value === "closed" || value === "all" || value === "watched" ? value : "open";
}

export function filtersFromSearchParams(
  searchParams: URLSearchParams,
  currentUserId: number | null = null
): OpportunityFilters {
  const filters = Object.fromEntries(
    FILTER_KEYS.flatMap((key) => {
      const value = searchParams.get(key)?.trim();
      return value ? [[key, value]] : [];
    })
  ) as OpportunityFilters;
  filters.situation = searchParams.get("view")?.trim() === "history"
    ? undefined
    : quotationSituation(searchParams.get("situation")?.trim());
  // Acompanhadas pertencem à sessão; nunca confiar em userId da URL.
  filters.userId = currentUserId ?? undefined;
  return filters;
}

export function csvDownloadHeaders(prefix: string) {
  const date = new Date().toISOString().slice(0, 10);
  return {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="${prefix}-${date}.csv"`,
    "cache-control": "no-store"
  };
}
