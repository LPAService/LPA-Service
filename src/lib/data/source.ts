import { db } from "@/lib/db";
import {
  createPostgresOpportunitySource,
  sanitizePageParam
} from "@/lib/data/postgres-source";
import { createPostgresQuotationSource } from "@/lib/data/quotation-source";
import type { NormalizedOpportunity } from "@/lib/contracts/opportunity";

export type OpportunityFilters = {
  city?: string;
  category?: string;
  expenseGroup?: string;
  school?: string;
  periodStart?: string;
  periodEnd?: string;
  query?: string;
  situation?: "open" | "closed" | "all";
};

export type OpportunityPage = {
  page: number;
  pageSize: number;
};

export type CategoryFacet = {
  slug: string;
  name: string;
};

export type OpportunityListResult = {
  data: NormalizedOpportunity[];
  total: number;
  totalAvailable: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: {
    cities: string[];
    categories: CategoryFacet[];
    expenseGroups: string[];
    schools: string[];
  };
};

export interface OpportunitySource {
  listOpportunities(
    filters?: OpportunityFilters,
    page?: Partial<OpportunityPage>
  ): Promise<OpportunityListResult>;
  getOpportunity(externalId: string): Promise<NormalizedOpportunity | null>;
}

export { sanitizePageParam };

export function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

export const opportunitySource: OpportunitySource =
  createPostgresOpportunitySource(db);
export const quotationSource: OpportunitySource =
  createPostgresQuotationSource(db);
