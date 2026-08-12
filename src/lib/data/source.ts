import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  NormalizedOpportunity,
  OpportunityItem
} from "@/lib/contracts/opportunity";

export type OpportunityFilters = {
  city?: string;
  category?: string;
  expenseGroup?: string;
  school?: string;
  periodStart?: string;
  periodEnd?: string;
  query?: string;
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

type ListingOrder = {
  orderId: string;
  year: string;
  school: string;
  subprogram: string;
  expenseGroup: string;
  accountabilityStatus: string | null;
  accountabilitySent: boolean;
  purchaseDate: string | null;
  idSubprogram: number;
  idSchool: number;
  idBudget: number;
  idSupplier: number | null;
};

type DetailPayload = {
  budgetOrder: string;
  purchaseOrderStatus: string | null;
  initiativeDescription: string | null;
  expenseGroupDescription: string;
  dtProposalSubmission: string | null;
  dtDelivery: string | null;
  supplierName: string | null;
  supplierDocument: string | null;
};

type ItemsPayload = {
  data: PortalItem[];
  meta?: {
    total?: number;
  };
};

type PortalItem = {
  nuItemOrder: number;
  txDescription: string;
  inPermanent: boolean;
  txExpenseCategory: string;
  txBudgetItemType: string;
  txBudgetItemUnit: string;
  nuQuantity: number;
  nuValueByItem: number | null;
};

const SOURCE_BASE_URL = "https://caixaescolar.educacao.mg.gov.br";
const FIXTURES_DIR = join(projectRoot(), "research", "portal", "fixtures");

const categoryByExpenseGroup: Record<string, CategoryFacet> = {
  "Gêneros Alimentícios": { slug: "alimentos", name: "Alimentos" },
  "Manutenção e Reformas": { slug: "manutencao", name: "Manutenção predial" }
};

const listingOrders = readFixture<{ data: ListingOrder[] }>("pagesize_1000.json")
  .data.slice(0, 40)
  .map((order) => ({ ...order }));

const fixtureDetails = new Map<string, ReturnType<typeof detailFixture>>(
  [
    ["2027075592", detailFixture("detail_1.json", "items_1.json")],
    ["2027075587", detailFixture("detail_2.json", "items_2.json")],
    ["2027075586", detailFixture("detail_3.json", "items_3.json")]
  ]
);

const opportunities = listingOrders.map(normalizeOrder);

export const opportunitySource: OpportunitySource = {
  async listOpportunities(filters = {}, page = {}) {
    const pageNumber = sanitizePositiveInteger(page.page, 1);
    const pageSize = Math.min(48, sanitizePositiveInteger(page.pageSize, 12));
    const filtered = opportunities.filter((opportunity) =>
      matchesFilters(opportunity, filters)
    );
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const currentPage = Math.min(pageNumber, totalPages);
    const offset = (currentPage - 1) * pageSize;

    return {
      data: filtered.slice(offset, offset + pageSize),
      total: filtered.length,
      totalAvailable: opportunities.length,
      page: currentPage,
      pageSize,
      totalPages,
      facets: buildFacets(opportunities)
    };
  },
  async getOpportunity(externalId) {
    return (
      opportunities.find((opportunity) => opportunity.externalId === externalId) ??
      null
    );
  }
};

export function sanitizePageParam(value: string | readonly string[] | undefined) {
  if (Array.isArray(value)) return 1;
  return sanitizePositiveInteger(value, 1);
}

function normalizeOrder(order: ListingOrder): NormalizedOpportunity {
  const fixture = fixtureDetails.get(order.orderId);
  const category = fixture
    ? categoryByExpenseGroup[order.expenseGroup] ?? null
    : null;
  const items = fixture ? normalizeItems(fixture.items) : [];
  const itemCount = fixture?.items.meta?.total ?? items.length;
  const hasFullItemPage = itemCount === items.length;
  const totalValue = hasFullItemPage ? sumItems(items) : null;
  const summary = fixture?.detail.initiativeDescription ?? "Resumo não informado.";

  return {
    externalId: order.orderId,
    orderId: order.orderId,
    sourceUrl: `${SOURCE_BASE_URL}/public/purchase-orders/${order.orderId}`,
    idSubprogram: order.idSubprogram,
    idSchool: order.idSchool,
    idBudget: order.idBudget,
    idSupplier: order.idSupplier,
    school: order.school,
    city: null,
    regional: null,
    expenseGroup: order.expenseGroup,
    subprogram: order.subprogram,
    year: order.year,
    purchaseDate: order.purchaseDate,
    proposalDate: fixture?.detail.dtProposalSubmission ?? null,
    deliveryDate: fixture?.detail.dtDelivery ?? null,
    purchaseOrderStatus: fixture?.detail.purchaseOrderStatus ?? null,
    accountabilityStatus: order.accountabilityStatus,
    supplierName: fixture?.detail.supplierName ?? null,
    supplierDocument: fixture?.detail.supplierDocument ?? null,
    initiativeDescription: fixture?.detail.initiativeDescription ?? null,
    items,
    attachments: [],
    totalValue,
    itemCount,
    category: category
      ? {
          ...category,
          confidence: 1,
          needsFallback: false
        }
      : null,
    headline: category?.name ?? order.expenseGroup,
    summary,
    topItems: items.slice(0, 5).map((item) => item.name.toLowerCase()),
    rawJson: order
  };
}

function normalizeItems(payload: ItemsPayload): OpportunityItem[] {
  return payload.data.map((item) => {
    const totalValue =
      isFiniteNumber(item.nuValueByItem) && isFiniteNumber(item.nuQuantity)
        ? roundMoney(item.nuQuantity * item.nuValueByItem)
        : null;

    return {
      order: item.nuItemOrder,
      name: item.txBudgetItemType,
      description: item.txDescription,
      unit: item.txBudgetItemUnit,
      quantity: item.nuQuantity,
      unitValue: item.nuValueByItem,
      totalValue,
      isPermanent: item.inPermanent,
      expenseCategory: item.txExpenseCategory
    };
  });
}

function matchesFilters(
  opportunity: NormalizedOpportunity,
  filters: OpportunityFilters
) {
  return (
    matchesText(opportunity.city, filters.city) &&
    matchesText(opportunity.category?.slug, filters.category) &&
    matchesText(opportunity.expenseGroup, filters.expenseGroup) &&
    matchesText(opportunity.school, filters.school) &&
    matchesPeriod(opportunity.purchaseDate, filters.periodStart, filters.periodEnd) &&
    matchesQuery(opportunity, filters.query)
  );
}

function matchesText(value: string | null | undefined, filter: string | undefined) {
  if (!filter) return true;
  return normalize(value ?? "") === normalize(filter);
}

function matchesPeriod(
  value: string | null,
  periodStart: string | undefined,
  periodEnd: string | undefined
) {
  if (!periodStart && !periodEnd) return true;
  if (!value) return false;

  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;

  if (periodStart && time < new Date(`${periodStart}T00:00:00.000Z`).getTime()) {
    return false;
  }
  if (periodEnd && time > new Date(`${periodEnd}T23:59:59.999Z`).getTime()) {
    return false;
  }
  return true;
}

function matchesQuery(opportunity: NormalizedOpportunity, query: string | undefined) {
  if (!query) return true;
  const haystack = [
    opportunity.school,
    opportunity.city,
    opportunity.expenseGroup,
    opportunity.headline,
    opportunity.summary,
    opportunity.initiativeDescription,
    opportunity.supplierName,
    ...opportunity.topItems,
    ...opportunity.items.flatMap((item) => [item.name, item.description])
  ]
    .filter(Boolean)
    .join(" ");

  return normalize(haystack).includes(normalize(query));
}

function buildFacets(opportunities: NormalizedOpportunity[]) {
  return {
    cities: uniqueSorted(opportunities.map((opportunity) => opportunity.city)),
    categories: uniqueCategories(opportunities),
    expenseGroups: uniqueSorted(
      opportunities.map((opportunity) => opportunity.expenseGroup)
    ),
    schools: uniqueSorted(opportunities.map((opportunity) => opportunity.school))
  };
}

function uniqueCategories(opportunities: NormalizedOpportunity[]) {
  const categories = new Map<string, string>();

  for (const opportunity of opportunities) {
    if (opportunity.category) {
      categories.set(opportunity.category.slug, opportunity.category.name);
    }
  }

  return [...categories.entries()]
    .map(([slug, name]) => ({ slug, name }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort(
    (left, right) => left.localeCompare(right, "pt-BR")
  );
}

export function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function detailFixture(detailFile: string, itemsFile: string) {
  return {
    detail: readFixture<DetailPayload>(detailFile),
    items: readFixture<ItemsPayload>(itemsFile)
  };
}

function readFixture<T>(file: string): T {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, file), "utf8")) as T;
}

function projectRoot() {
  const cwd = process.cwd();
  const marker = "/.worktrees/dashboard";

  if (cwd.endsWith(marker)) {
    return cwd.slice(0, -marker.length);
  }

  return cwd;
}

function sumItems(items: OpportunityItem[]) {
  if (items.length === 0) return null;
  return roundMoney(items.reduce((sum, item) => sum + (item.totalValue ?? 0), 0));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function sanitizePositiveInteger(value: unknown, fallback: number) {
  const numericValue =
    typeof value === "string" && value.trim() !== ""
      ? Number(value.trim())
      : value;

  if (
    typeof numericValue !== "number" ||
    !Number.isInteger(numericValue) ||
    numericValue < 1
  ) {
    return fallback;
  }

  return numericValue;
}
