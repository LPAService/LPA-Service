import { db } from "@/lib/db";
import {
  createPostgresOpportunitySource,
  sanitizePageParam
} from "@/lib/data/postgres-source";
import { createPostgresQuotationSource } from "@/lib/data/quotation-source";
import { normalize } from "@/lib/text/normalize";
import type { NormalizedOpportunity } from "@/lib/contracts/opportunity";

export type OpportunityFilters = {
  city?: string;
  category?: string;
  expenseGroup?: string;
  school?: string;
  periodStart?: string;
  periodEnd?: string;
  query?: string;
  situation?: "open" | "actionable" | "blocked" | "closed" | "watched" | "all";
  userId?: number;
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
  getOpportunity(identifier: string): Promise<NormalizedOpportunity | null>;
}

export { sanitizePageParam };

export { normalize };

export const opportunitySource: OpportunitySource =
  createPostgresOpportunitySource(db);
export const quotationSource: OpportunitySource =
  createPostgresQuotationSource(db);
